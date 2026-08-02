#!/usr/bin/env python3
"""
Service et Middleware de Sécurité API - Département Communication (Kun COM VH)
Implémente la logique métier d'autorisation, de filtrage dynamique et de pondération.
"""

from datetime import datetime, timedelta

class SecurityError(Exception):
    """Exception levée en cas de violation d'une règle de sécurité backend."""
    pass

class SecurityService:
    def __init__(self, db_adapter=None):
        self.db = db_adapter

    def submit_note(self, notateur, section_cible_id, note_valeur, service_culte_id):
        """
        RÈGLE 1 & RÈGLE 4: Soumission sécurisée d'une note de section.
        - Interdit l'auto-notation (notateur.section_id == section_cible_id).
        - Attribue de façon infalsifiable le poids_note et la confidentialité selon le rôle vérifié.
        """
        # 1. Vérification de l'auto-notation (Self-Rating Protection)
        if notateur.get("section_id") and notateur["section_id"] == section_cible_id:
            raise SecurityError(
                f"INTERDICTION DE S'AUTO-NOTER: L'utilisateur '{notateur['nom']}' "
                f"ne peut pas évaluer la section '{section_cible_id}' à laquelle il appartient."
            )

        # 2. Validation de la plage de note
        if not (1.0 <= float(note_valeur) <= 5.0):
            raise SecurityError("VALEUR INVALIDE: La note doit être comprise entre 1.0 et 5.0.")

        # 3. Attribution infalsifiable du poids et de la confidentialité selon le JWT/Rôle
        role = notateur.get("role", "STAGIAIRE")
        if role == "GRAND_RESPONSABLE":
            poids_note = 5
            is_confidentiel = True
        elif role == "RESP_SECTION":
            poids_note = 3
            is_confidentiel = True
        else:
            poids_note = 1
            is_confidentiel = False

        note_document = {
            "service_culte_id": service_culte_id,
            "section_cible_id": section_cible_id,
            "notateur_id": notateur["id"],
            "notateur_role": role,
            "note_valeur": float(note_valeur),
            "poids_note": poids_note,              # Forcé par le serveur
            "is_confidentiel": is_confidentiel,    # Forcé par le serveur
            "created_at": datetime.now().isoformat()
        }

        return note_document

    def filter_notes_for_user(self, requester, all_notes):
        """
        RÈGLE 2: Filtrage dynamique de confidentialité selon le rôle.
        - GRAND_RESPONSABLE / RESP_SECTION : Accès complet.
        - MEMBRE / STAGIAIRE : Exclusion des notes confidentielles, affichage de la moyenne publique.
        """
        role = requester.get("role", "STAGIAIRE")
        
        if role in ["GRAND_RESPONSABLE", "RESP_SECTION"]:
            # Accès à l'intégralité des données (membres + responsables)
            visible_notes = list(all_notes)
        else:
            # Filtrage strict : Exclusion du détail des notes is_confidentiel == true
            visible_notes = [n for n in all_notes if not n.get("is_confidentiel", False)]

        # Calcul de la moyenne pondérée sur les notes visibles
        if visible_notes:
            total_weighted_points = sum(n["note_valeur"] * n["poids_note"] for n in visible_notes)
            total_weights = sum(n["poids_note"] for n in visible_notes)
            public_average = round(total_weighted_points / total_weights, 2)
        else:
            public_average = 0.0

        return {
            "requester_role": role,
            "notes_detail": visible_notes,
            "public_average": public_average,
            "total_notes_count": len(visible_notes),
            "is_full_access": role in ["GRAND_RESPONSABLE", "RESP_SECTION"]
        }

    def get_feed_and_hall_of_fame(self, requester, feed_items, current_time=None):
        """
        RÈGLE 3: Filtrage d'éphémérité 24h du Bilan Feed et orientation Hall of Fame.
        - Feed Général : Seules les cartes avec valide_par_admin == True ET now < expiration_timestamp.
        - Hall of Fame : Cartes validées ayant dépassé 24h.
        """
        if current_time is None:
            current_time = datetime.now()

        active_feed = []
        hall_of_fame = []

        for item in feed_items:
            # La validation admin est obligatoire dans tous les cas
            if not item.get("valide_par_admin", False):
                continue

            pub_time = datetime.fromisoformat(item["publication_timestamp"])
            exp_time = datetime.fromisoformat(item["expiration_timestamp"])

            if current_time < exp_time:
                active_feed.append(item)
            else:
                hall_of_fame.append(item)

        return {
            "active_feed": active_feed,
            "hall_of_fame": hall_of_fame,
            "server_timestamp": current_time.isoformat()
        }
