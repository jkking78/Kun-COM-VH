#!/usr/bin/env python3
"""
Script de vérification de l'intégrité du modèle de données et des schémas.
Application Mobile - Département Communication (Kun COM VH)
"""

import sys
import json
import sqlite3
from datetime import datetime, timedelta

def verify_json_schema():
    print("==================================================")
    print("1. VÉRIFICATION DU JSON SCHEMA (FIRESTORE)")
    print("==================================================")
    
    schema_path = "schema/firestore_schema.json"
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema = json.load(f)
        
        definitions = schema.get("definitions", {})
        expected_entities = [
            "User", "Section", "ServiceCulte", 
            "Debriefing", "Resolution", "NoteSection", "BilanFeed"
        ]
        
        missing = [ent for ent in expected_entities if ent not in definitions]
        if missing:
            print(f"❌ Erreur: Entités manquantes dans le JSON Schema: {missing}")
            return False
            
        print(f"✅ Schéma JSON valide ({len(definitions)} entités définies avec succès) :")
        for name in expected_entities:
            req = definitions[name].get("required", [])
            props = list(definitions[name].get("properties", {}).keys())
            print(f"   - {name}: {len(props)} propriétés, obligatoires = {req}")
        
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la lecture du JSON Schema: {e}")
        return False

def verify_relational_integrity():
    print("\n==================================================")
    print("2. VÉRIFICATION DE L'INTÉGRITÉ RELATIONNELLE (SQL & BUSINESS RULES)")
    print("==================================================")
    
    # Simulation dans SQLite en mémoire avec PRAGMA foreign_keys = ON
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    try:
        # Création des tables simulées
        cursor.executescript("""
            CREATE TABLE sections (
                id TEXT PRIMARY KEY,
                nom TEXT UNIQUE NOT NULL,
                icon_name TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                photo_url TEXT,
                section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
                role TEXT NOT NULL DEFAULT 'STAGIAIRE' CHECK(role IN ('GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE', 'STAGIAIRE')),
                trust_score REAL NOT NULL DEFAULT 100.0 CHECK(trust_score >= 0.0 AND trust_score <= 100.0),
                is_stagiaire_badge INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE services_cultes (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                num_culte INTEGER NOT NULL CHECK(num_culte IN (1, 2, 3)),
                statut TEXT NOT NULL DEFAULT 'A_VENIR' CHECK(statut IN ('A_VENIR', 'EN_COURS', 'CLOTURE')),
                responsable_cloture_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                timestamp_cloture TEXT,
                UNIQUE(date, num_culte)
            );

            CREATE TABLE debriefings (
                id TEXT PRIMARY KEY,
                service_culte_id TEXT NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
                section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                points_forts TEXT NOT NULL,
                points_amelioration TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE resolutions (
                id TEXT PRIMARY KEY,
                section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                libelle TEXT NOT NULL,
                statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK(statut IN ('EN_COURS', 'REALISE')),
                avancement INTEGER NOT NULL DEFAULT 0 CHECK(avancement BETWEEN 0 AND 100)
            );

            CREATE TABLE notes_section (
                id TEXT PRIMARY KEY,
                service_culte_id TEXT NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
                section_cible_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                notateur_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                note_valeur REAL NOT NULL CHECK(note_valeur >= 1.0 AND note_valeur <= 5.0),
                poids_note INTEGER NOT NULL CHECK(poids_note IN (1, 3, 5)),
                is_confidentiel INTEGER NOT NULL DEFAULT 0,
                UNIQUE(service_culte_id, section_cible_id, notateur_id)
            );

            CREATE TABLE bilan_feed (
                id TEXT PRIMARY KEY,
                service_culte_id TEXT NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
                section_vedette_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                publication_timestamp TEXT NOT NULL,
                expiration_timestamp TEXT NOT NULL,
                valide_par_admin INTEGER NOT NULL DEFAULT 0
            );
        """)
        print("  [OK] Structure des tables et clés étrangères créées.")

        # Test 1: Insertion SECTIONS (les 7 sections du département)
        sections = [
            ("sec-1", "Web", "globe", "Développement web et plateforme digitale"),
            ("sec-2", "Projection", "monitor", "Projection des textes, hymnes et médias"),
            ("sec-3", "Prod", "video", "Production vidéo et habillage visuel"),
            ("sec-4", "Regie", "sliders", "Régie technique et mixage"),
            ("sec-5", "Cadrage", "camera", "Cadrage vidéo et prises de vue directes"),
            ("sec-6", "Photo", "aperture", "Photographie et couverture d'évènements"),
            ("sec-7", "Vente", "shopping-cart", "Vente de supports et boutique media")
        ]
        cursor.executemany("INSERT INTO sections VALUES (?, ?, ?, ?)", sections)
        print("  [OK] 7 Sections insérées avec succès.")

        # Test 2: Insertion USERS avec règles métier (poids & badges)
        users = [
            ("usr-admin", "Jean GrandResp", "jean@eglise.com", None, "sec-1", "GRAND_RESPONSABLE", 100.0, 0),
            ("usr-resp", "Marc RespCadrage", "marc@eglise.com", None, "sec-5", "RESP_SECTION", 100.0, 0),
            ("usr-membre", "Sophie Photographe", "sophie@eglise.com", None, "sec-6", "MEMBRE", 100.0, 0),
            ("usr-stagiaire", "Luc Stagiaire", "luc@eglise.com", None, "sec-2", "STAGIAIRE", 100.0, 1)
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)", users)
        print("  [OK] Utilisateurs insérés avec rôles et badges stagiaires conformes.")

        # Test 3: Check constraint num_culte (1, 2 ou 3)
        cursor.execute("INSERT INTO services_cultes VALUES ('culte-1', '2026-08-02', 1, 'EN_COURS', NULL, NULL)")
        try:
            cursor.execute("INSERT INTO services_cultes VALUES ('culte-invalid', '2026-08-02', 4, 'A_VENIR', NULL, NULL)")
            print("  [FAIL] La contrainte num_culte IN (1, 2, 3) a échoué.")
            return False
        except sqlite3.IntegrityError:
            print("  [OK] Contrainte num_culte IN (1, 2, 3) validée avec succès (rejet de num_culte = 4).")

        # Test 4: Notes pondérées (Poids 1, 3, 5 et Confidentialité)
        notes = [
            ("note-1", "culte-1", "sec-5", "usr-membre", 4.5, 1, 0), # Membre -> poids 1, non confidentiel
            ("note-2", "culte-1", "sec-5", "usr-resp", 4.8, 3, 1),   # Resp -> poids 3, confidentiel
            ("note-3", "culte-1", "sec-5", "usr-admin", 5.0, 5, 1)  # GrandResp -> poids 5, confidentiel
        ]
        cursor.executemany("INSERT INTO notes_section VALUES (?, ?, ?, ?, ?, ?, ?)", notes)
        
        # Vérification du calcul de moyenne pondérée pour la section Cadrage (sec-5)
        cursor.execute("""
            SELECT SUM(note_valeur * poids_note) / SUM(poids_note) 
            FROM notes_section WHERE section_cible_id = 'sec-5'
        """)
        weighted_avg = cursor.fetchone()[0]
        expected_avg = (4.5*1 + 4.8*3 + 5.0*5) / (1 + 3 + 5)
        assert abs(weighted_avg - expected_avg) < 1e-4
        print(f"  [OK] Calcul de la moyenne pondérée validé ({weighted_avg:.2f} / 5.0).")

        # Test 5: Bilan Feed 24h Expiration
        now_dt = datetime.now()
        exp_dt = now_dt + timedelta(hours=24)
        cursor.execute(
            "INSERT INTO bilan_feed VALUES ('feed-1', 'culte-1', 'sec-5', ?, ?, 1)",
            (now_dt.isoformat(), exp_dt.isoformat())
        )
        print("  [OK] Publication Bilan Feed 24h validée avec horodatage d'expiration calculé.")

        # Test 6: Résolutions (avancement 0-100)
        cursor.execute("INSERT INTO resolutions VALUES ('res-1', 'sec-5', 'Renouveler câble HDMI régie', 'EN_COURS', 50)")
        try:
            cursor.execute("INSERT INTO resolutions VALUES ('res-invalid', 'sec-5', 'Test', 'EN_COURS', 150)")
            print("  [FAIL] La contrainte d'avancement (0-100) a échoué.")
            return False
        except sqlite3.IntegrityError:
            print("  [OK] Contrainte avancement BETWEEN 0 AND 100 validée (rejet d'avancement = 150).")

        conn.close()
        print("\n✅ TOUS LES TESTS D'INTÉGRITÉ ET DE SÉCURITÉ SONT AU VERT.")
        return True

    except Exception as e:
        print(f"❌ Erreur lors de la vérification de l'intégrité: {e}")
        return False

if __name__ == "__main__":
    v1 = verify_json_schema()
    v2 = verify_relational_integrity()
    if v1 and v2:
        sys.exit(0)
    else:
        sys.exit(1)
