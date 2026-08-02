-- ==============================================================================
-- JEU DE DONNÉES INITIALES (SEED DATA) - DÉPARTEMENT COMMUNICATION
-- Application Mobile Kun COM VH
-- ==============================================================================

-- 1. SECTIONS DU DÉPARTEMENT (7 Sections)
INSERT INTO sections (id, nom, icon_name, description) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Web', 'globe', 'Développement du site web, réseaux sociaux et plateforme digitale'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Projection', 'monitor', 'Projection des chants, versets, annonces et médias lors des cultes'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Prod', 'video', 'Production audiovisuelle, montages vidéo et visuels animés'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Regie', 'sliders', 'Régie technique son, lumière et diffusion en direct'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Cadrage', 'camera', 'Prise de vue vidéo, cadrage multi-caméras et captation live'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Photo', 'aperture', 'Photographie officielle des cultes et évènements de l''église'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Vente', 'shopping-cart', 'Gestion de la boutique média et diffusion des supports enregistrés')
ON CONFLICT (nom) DO NOTHING;

-- 2. EXEMPLES D'UTILISATEURS (Les 4 Rôles)
INSERT INTO users (id, nom, email, photo_url, section_id, role, trust_score) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'Pasteur Daniel (Chef Dept)', 'daniel.com@eglise.org', 'https://example.com/photos/daniel.jpg', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'GRAND_RESPONSABLE', 100.0),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'Éric Kouamé (Resp Cadrage)', 'eric.cadrage@eglise.org', 'https://example.com/photos/eric.jpg', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'RESP_SECTION', 100.0),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'Sarah Yao (Membre Photo)', 'sarah.photo@eglise.org', 'https://example.com/photos/sarah.jpg', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'MEMBRE', 98.5),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'Kevin Boni (Stagiaire Projection)', 'kevin.proj@eglise.org', NULL, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'STAGIAIRE', 100.0)
ON CONFLICT (email) DO NOTHING;

-- 3. EXEMPLE DE SERVICE CULTE (Culte n°1 du Dimanche)
INSERT INTO services_cultes (id, date, num_culte, statut) VALUES
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', CURRENT_DATE, 1, 'EN_COURS')
ON CONFLICT (date, num_culte) DO NOTHING;

-- 4. EXEMPLE DE DEBRIEFING
INSERT INTO debriefings (id, service_culte_id, section_id, user_id, points_forts, points_amelioration) VALUES
(
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 
    ARRAY['Excellente fluidité sur les plans serrés', 'Mise en place à l''heure'], 
    ARRAY['Anticiper les déplacements du prédicateur', 'Ajuster la balance des blancs caméra 2']
);

-- 5. EXEMPLE DE RÉSOLUTION
INSERT INTO resolutions (id, section_id, libelle, statut, avancement) VALUES
(
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380e01',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
    'Former l''équipe de cadrage à l''utilisation du stabilisateur Gimbal',
    'EN_COURS',
    60
);

-- 6. EXEMPLES DE NOTES DE SECTION (Trigger calcule auto le poids et la confidentialité)
INSERT INTO notes_section (id, service_culte_id, section_cible_id, notateur_id, note_valeur) VALUES
-- Note de Sarah (MEMBRE) -> Poids 1, Confidentiel FALSE
('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 4.5),
-- Note de Éric (RESP_SECTION) -> Poids 3, Confidentiel TRUE
('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 4.8),
-- Note de Pasteur Daniel (GRAND_RESPONSABLE) -> Poids 5, Confidentiel TRUE
('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 5.0)
ON CONFLICT (service_culte_id, section_cible_id, notateur_id) DO NOTHING;

-- 7. EXEMPLE DE BILAN FEED (24h Expiration Trigger auto)
INSERT INTO bilan_feed (id, service_culte_id, section_vedette_id, valide_par_admin) VALUES
(
    'g6eebc99-9c0b-4ef8-bb6d-6bb9bd380g01',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
    TRUE
);
