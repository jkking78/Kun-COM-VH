-- ==============================================================================
-- SCHÉMA DE BASE DE DONNÉES SUPABASE (POSTGRESQL) - DÉPARTEMENT COMMUNICATION
-- Application Mobile Kun COM VH (Sécurité & Triggers Renforcés)
-- ==============================================================================

DROP VIEW IF EXISTS v_vedettes_hall_of_fame CASCADE;
DROP VIEW IF EXISTS v_bilan_feed_active CASCADE;
DROP VIEW IF EXISTS v_notes_public CASCADE;

DROP TABLE IF EXISTS bilan_feed CASCADE;
DROP TABLE IF EXISTS notes_section CASCADE;
DROP TABLE IF EXISTS resolutions CASCADE;
DROP TABLE IF EXISTS debriefings CASCADE;
DROP TABLE IF EXISTS services_cultes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sections CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS statut_service CASCADE;
DROP TYPE IF EXISTS statut_resolution CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
    'GRAND_RESPONSABLE',
    'RESP_SECTION',
    'MEMBRE',
    'STAGIAIRE'
);

CREATE TYPE statut_service AS ENUM (
    'A_VENIR',
    'EN_COURS',
    'CLOTURE'
);

CREATE TYPE statut_resolution AS ENUM (
    'EN_COURS',
    'REALISE'
);

-- ------------------------------------------------------------------------------
-- 2. TABLES & RELATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(50) UNIQUE NOT NULL,
    icon_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    photo_url TEXT,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    role user_role NOT NULL DEFAULT 'STAGIAIRE',
    trust_score DOUBLE PRECISION NOT NULL DEFAULT 100.0 CHECK (trust_score >= 0.0 AND trust_score <= 100.0),
    is_stagiaire_badge BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services_cultes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    num_culte INT NOT NULL CHECK (num_culte IN (1, 2, 3)),
    statut statut_service NOT NULL DEFAULT 'A_VENIR',
    responsable_cloture_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp_cloture TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_culte_per_day UNIQUE (date, num_culte)
);

CREATE TABLE debriefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_culte_id UUID NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_forts TEXT[] NOT NULL DEFAULT '{}',
    points_amelioration TEXT[] NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    libelle TEXT NOT NULL,
    statut statut_resolution NOT NULL DEFAULT 'EN_COURS',
    avancement INT NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notes_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_culte_id UUID NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
    section_cible_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    notateur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_valeur DOUBLE PRECISION NOT NULL CHECK (note_valeur >= 1.0 AND note_valeur <= 5.0),
    poids_note INT NOT NULL CHECK (poids_note IN (1, 3, 5)),
    is_confidentiel BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_notation_per_culte UNIQUE (service_culte_id, section_cible_id, notateur_id)
);

CREATE TABLE bilan_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_culte_id UUID NOT NULL REFERENCES services_cultes(id) ON DELETE CASCADE,
    section_vedette_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    publication_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_timestamp TIMESTAMPTZ NOT NULL,
    valide_par_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TRIGGERS SÉCURITÉ RENFORCÉS
-- ------------------------------------------------------------------------------

-- RÈGLE 1: INTERDICTION DE S'AUTO-NOTER (Self-Rating Protection)
CREATE OR REPLACE FUNCTION trg_fn_prevent_self_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_user_section_id UUID;
BEGIN
    SELECT section_id INTO v_user_section_id FROM users WHERE id = NEW.notateur_id;
    
    IF v_user_section_id IS NOT NULL AND v_user_section_id = NEW.section_cible_id THEN
        RAISE EXCEPTION 'SÉCURITÉ: Auto-notation interdite. Un membre ne peut pas noter sa propre section (Section ID: %).', NEW.section_cible_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_self_rating
BEFORE INSERT OR UPDATE ON notes_section
FOR EACH ROW EXECUTE FUNCTION trg_fn_prevent_self_rating();

-- RÈGLE 4: PONDÉRATION INFALSIFIABLE CÔTÉ SERVEUR
CREATE OR REPLACE FUNCTION trg_fn_set_note_metadata()
RETURNS TRIGGER AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = NEW.notateur_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Notateur introuvable dans la base de données.';
    END IF;

    -- Le client ne peut pas forcer le poids_note ou la confidentialité
    IF v_role = 'GRAND_RESPONSABLE' THEN
        NEW.poids_note := 5;
        NEW.is_confidentiel := TRUE;
    ELSIF v_role = 'RESP_SECTION' THEN
        NEW.poids_note := 3;
        NEW.is_confidentiel := TRUE;
    ELSE
        NEW.poids_note := 1;
        NEW.is_confidentiel := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_note_metadata
BEFORE INSERT OR UPDATE ON notes_section
FOR EACH ROW EXECUTE FUNCTION trg_fn_set_note_metadata();

-- RÈGLE 3: ÉPHÉMÉRITÉ 24H AUTOMATIQUE DU BILAN FEED
CREATE OR REPLACE FUNCTION trg_fn_set_bilan_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.publication_timestamp IS NULL THEN
        NEW.publication_timestamp := NOW();
    END IF;
    NEW.expiration_timestamp := NEW.publication_timestamp + INTERVAL '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_bilan_expiration
BEFORE INSERT ON bilan_feed
FOR EACH ROW EXECUTE FUNCTION trg_fn_set_bilan_expiration();

-- Synchronisation du badge stagiaire
CREATE OR REPLACE FUNCTION trg_fn_sync_user_badge()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_stagiaire_badge := (NEW.role = 'STAGIAIRE');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_badge
BEFORE INSERT OR UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION trg_fn_sync_user_badge();

-- ------------------------------------------------------------------------------
-- 4. VUES SÉCURISÉES POUR LE FILTRAGE DYNAMIQUE (RÈGLE 2 & RÈGLE 3)
-- ------------------------------------------------------------------------------

-- RÈGLE 2: Vue publique des notes pour MEMBRE & STAGIAIRE (Exclut is_confidentiel = TRUE)
CREATE VIEW v_notes_public AS
SELECT 
    id,
    service_culte_id,
    section_cible_id,
    notateur_id,
    note_valeur,
    poids_note,
    created_at
FROM notes_section
WHERE is_confidentiel = FALSE;

-- RÈGLE 3: Vue Fil d'Actualité 24h actif (Non expiré & validé par admin)
CREATE VIEW v_bilan_feed_active AS
SELECT 
    id,
    service_culte_id,
    section_vedette_id,
    publication_timestamp,
    expiration_timestamp,
    valide_par_admin,
    created_at
FROM bilan_feed
WHERE valide_par_admin = TRUE 
  AND NOW() BETWEEN publication_timestamp AND expiration_timestamp;

-- RÈGLE 3: Vue Hall of Fame (Publications validées ayant dépassé 24h)
CREATE VIEW v_vedettes_hall_of_fame AS
SELECT 
    id,
    service_culte_id,
    section_vedette_id,
    publication_timestamp,
    expiration_timestamp,
    valide_par_admin,
    created_at
FROM bilan_feed
WHERE valide_par_admin = TRUE 
  AND NOW() > expiration_timestamp;

-- Fonction de requêtage sécurisé des notes selon l'utilisateur connecté
CREATE OR REPLACE FUNCTION fn_get_notes_for_user(p_user_id UUID, p_section_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    service_culte_id UUID,
    section_cible_id UUID,
    notateur_id UUID,
    note_valeur DOUBLE PRECISION,
    poids_note INT,
    is_confidentiel BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE users.id = p_user_id;

    IF v_role IN ('GRAND_RESPONSABLE', 'RESP_SECTION') THEN
        RETURN QUERY
        SELECT n.id, n.service_culte_id, n.section_cible_id, n.notateur_id, n.note_valeur, n.poids_note, n.is_confidentiel, n.created_at
        FROM notes_section n
        WHERE (p_section_id IS NULL OR n.section_cible_id = p_section_id);
    ELSE
        RETURN QUERY
        SELECT n.id, n.service_culte_id, n.section_cible_id, n.notateur_id, n.note_valeur, n.poids_note, n.is_confidentiel, n.created_at
        FROM notes_section n
        WHERE n.is_confidentiel = FALSE 
          AND (p_section_id IS NULL OR n.section_cible_id = p_section_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
