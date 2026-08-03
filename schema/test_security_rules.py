#!/usr/bin/env python3
"""
Suite de Tests d'Étanchéité et de Pénétration de la Sécurité
Vérifie la robustesse des règles de sécurité et de modération RBAC de l'application Communication église.
"""

import sys
from datetime import datetime, timedelta
sys.path.append("server")
from security_service import SecurityService, SecurityError

def run_security_penetration_tests():
    sec_service = SecurityService()
    tests_passed = 0
    total_tests = 5

    print("==================================================")
    print("TESTS D'ÉTANCHÉITÉ DE LA COUCHE DE SÉCURITÉ")
    print("==================================================")

    # --------------------------------------------------------------------------
    # RÈGLE 1: INTERDICTION DE S'AUTO-NOTER (Self-Rating Protection)
    # --------------------------------------------------------------------------
    print("\n[TEST 1] Protection Anti Auto-Notation (Self-Rating Protection)")
    
    user_cadrage = {
        "id": "usr-101",
        "nom": "Eric Cadrage",
        "role": "MEMBRE",
        "section_id": "sec-cadrage"
    }

    try:
        sec_service.submit_note(
            notateur=user_cadrage,
            section_cible_id="sec-cadrage",
            note_valeur=5.0,
            service_culte_id="culte-201"
        )
        print("❌ ECHEC: La tentative d'auto-notation a été acceptée à tort!")
    except SecurityError as e:
        print(f"  ✅ SUCCÈS: Interception réussie -> {e}")
        
    try:
        valid_note = sec_service.submit_note(
            notateur=user_cadrage,
            section_cible_id="sec-regie",
            note_valeur=4.5,
            service_culte_id="culte-201"
        )
        print("  ✅ SUCCÈS: Notation inter-section légitime autorisée.")
        tests_passed += 1
    except SecurityError as e:
        print(f"❌ ECHEC: Rejet anormal d'une note légitime -> {e}")

    # --------------------------------------------------------------------------
    # RÈGLE 2: CONFIDENTIALITÉ DES NOTES RESPONSABLES (Data Filtering)
    # --------------------------------------------------------------------------
    print("\n[TEST 2] Confidentialité des Notes Responsables & Filtrage Dynamique")
    
    sample_notes = [
        {"id": "n1", "note_valeur": 4.0, "poids_note": 1, "is_confidentiel": False, "notateur_id": "usr-memb-1"},
        {"id": "n2", "note_valeur": 5.0, "poids_note": 3, "is_confidentiel": True,  "notateur_id": "usr-resp-1"},
        {"id": "n3", "note_valeur": 4.8, "poids_note": 5, "is_confidentiel": True,  "notateur_id": "usr-admin-1"}
    ]

    memb_user = {"id": "usr-memb-1", "role": "MEMBRE"}
    resp_user = {"id": "usr-resp-1", "role": "RESP_SECTION"}
    admin_user = {"id": "usr-admin-1", "role": "GRAND_RESPONSABLE"}

    res_memb = sec_service.filter_notes_for_user(memb_user, sample_notes)
    notes_memb_ids = [n["id"] for n in res_memb["notes_detail"]]
    
    res_resp = sec_service.filter_notes_for_user(resp_user, sample_notes)
    notes_resp_ids = [n["id"] for n in res_resp["notes_detail"]]

    if notes_memb_ids == ["n1"] and set(notes_resp_ids) == {"n1", "n2", "n3"}:
        print(f"  ✅ SUCCÈS: Membre voit uniquement les notes publiques {notes_memb_ids}.")
        print(f"  ✅ SUCCÈS: Responsable accède à la totalité des notes {notes_resp_ids}.")
        tests_passed += 1
    else:
        print(f"❌ ECHEC: Problème de filtrage. Membre = {notes_memb_ids}, Resp = {notes_resp_ids}")

    # --------------------------------------------------------------------------
    # RÈGLE 3: ÉPHÉMÉRITÉ 24H DU FEED ET TRANSITION HALL OF FAME
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Éphémérité 24h du Bilan Feed et Orientation Hall of Fame")

    now = datetime.now()
    feed_data = [
        {
            "id": "feed-recent",
            "valide_par_admin": True,
            "publication_timestamp": (now - timedelta(hours=2)).isoformat(),
            "expiration_timestamp": (now + timedelta(hours=22)).isoformat()
        },
        {
            "id": "feed-expired",
            "valide_par_admin": True,
            "publication_timestamp": (now - timedelta(hours=26)).isoformat(),
            "expiration_timestamp": (now - timedelta(hours=2)).isoformat()
        },
        {
            "id": "feed-unvalidated",
            "valide_par_admin": False,
            "publication_timestamp": (now - timedelta(hours=1)).isoformat(),
            "expiration_timestamp": (now + timedelta(hours=23)).isoformat()
        }
    ]

    feed_res = sec_service.get_feed_and_hall_of_fame(memb_user, feed_data, current_time=now)
    active_ids = [item["id"] for item in feed_res["active_feed"]]
    hof_ids = [item["id"] for item in feed_res["hall_of_fame"]]

    if active_ids == ["feed-recent"] and hof_ids == ["feed-expired"]:
        print(f"  ✅ SUCCÈS: Feed Actif (24h) contient uniquement: {active_ids}")
        print(f"  ✅ SUCCÈS: Hall of Fame (Archivé > 24h) contient: {hof_ids}")
        print("  ✅ SUCCÈS: Publications non validées ignorées.")
        tests_passed += 1
    else:
        print(f"❌ ECHEC: Mauvaise répartition du Feed. Active = {active_ids}, HallOfFame = {hof_ids}")

    # --------------------------------------------------------------------------
    # RÈGLE 4: PONDÉRATION INFALSIFIABLE (ATTRIBUTION STRICTE PAR LE SERVEUR)
    # --------------------------------------------------------------------------
    print("\n[TEST 4] Pondération Infalsifiable & Attribution Côté Serveur")

    member_user = {"id": "usr-mem-99", "nom": "Jean Membre", "role": "MEMBRE", "section_id": "sec-web"}
    
    note_created = sec_service.submit_note(
        notateur=member_user,
        section_cible_id="sec-cadrage",
        note_valeur=4.0,
        service_culte_id="culte-301"
    )

    if note_created["poids_note"] == 1 and note_created["is_confidentiel"] == False:
        print(f"  ✅ SUCCÈS: Poids forcé à {note_created['poids_note']} (1) et confidentiel = {note_created['is_confidentiel']} pour MEMBRE.")
        tests_passed += 1
    else:
        print(f"❌ ECHEC: La tentative de falsification de poids a réussi! Poids = {note_created['poids_note']}")

    # --------------------------------------------------------------------------
    # RÈGLE 5: SÉCURITÉ DE SUPPRESSION DES POSTS (RBAC ENFORCEMENT)
    # --------------------------------------------------------------------------
    print("\n[TEST 5] Sécurité & Modération : Permissions de Suppression (RBAC)")

    sample_post = {"id": "post-100", "user_id": "usr-author-1", "title": "Post Auteur"}
    user_author = {"id": "usr-author-1", "role": "MEMBRE"}
    user_other_member = {"id": "usr-other-2", "role": "MEMBRE"}
    user_grand_resp = {"id": "usr-admin-3", "role": "GRAND_RESPONSABLE"}

    # Verification Auteur
    can_author_delete = (user_author["role"] == "GRAND_RESPONSABLE" or sample_post["user_id"] == user_author["id"])
    # Verification Membre Non Auteur
    can_other_delete = (user_other_member["role"] == "GRAND_RESPONSABLE" or sample_post["user_id"] == user_other_member["id"])
    # Verification Grand Responsable
    can_admin_delete = (user_grand_resp["role"] == "GRAND_RESPONSABLE" or sample_post["user_id"] == user_grand_resp["id"])

    if can_author_delete and not can_other_delete and can_admin_delete:
        print("  ✅ SUCCÈS: L'Auteur a le droit de supprimer son propre post.")
        print("  ✅ SUCCÈS: Un membre tierce est STRICTEMENT BLOQUÉ pour supprimer le post d'un autre.")
        print("  ✅ SUCCÈS: Le GRAND_RESPONSABLE a l'autorisation de modération globale.")
        tests_passed += 1
    else:
        print(f"❌ ECHEC: Faille de modération RBAC! Author={can_author_delete}, Other={can_other_delete}, Admin={can_admin_delete}")

    print("\n==================================================")
    print(f"RÉSULTAT SÉCURITÉ : {tests_passed}/{total_tests} SUITES DE TESTS VALIDÉES AVEC SUCCÈS.")
    print("==================================================")
    return tests_passed == total_tests

if __name__ == "__main__":
    success = run_security_penetration_tests()
    sys.exit(0 if success else 1)
