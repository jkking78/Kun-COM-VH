-- ============================================================================
-- Désigne le PREMIER Grand Responsable — À LANCER APRÈS ta 1re inscription.
-- Remplace l'e-mail par le tien. Écrit le rôle dans le JWT (app_metadata) ET
-- dans la fiche (pour l'affichage). Reconnecte-toi ensuite pour rafraîchir le JWT.
-- ============================================================================
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('role', 'GRAND_RESPONSABLE')
 where email = 'REMPLACE_PAR_TON_EMAIL';

update public.kun_com_profiles
   set content = jsonb_set(content, '{role}', '"GRAND_RESPONSABLE"')
 where content->>'email' = 'REMPLACE_PAR_TON_EMAIL';
