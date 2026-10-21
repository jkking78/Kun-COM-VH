-- Tests de la migration 09 (après 06, 07, 08 et 09). Les droits eux-mêmes
-- sont revérifiés par test_08 rejoué sur la même pile de migrations.
\set ON_ERROR_STOP 1
\set QUIET 1

do $$
declare
  restantes text;
begin
  select string_agg(policyname, ', ') into restantes
  from pg_policies
  where schemaname = 'public'
    and policyname in ('posts_insert_auteur', 'posts_delete_auteur_ou_admin', 'profils_select_authentifie',
                       'profils_insert_proprietaire', 'profils_update_membres', 'p_dms_select', 'p_dms_insert',
                       'p_dms_delete', 'push_ses_abonnements')
    and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                       'SELECT auth\.(uid|jwt)\(\) AS (uid|jwt)', '', 'g') ~ 'auth\.(uid|jwt)\(\)';
  if restantes is not null then
    raise exception 'ÉCHEC : auth.uid()/auth.jwt() recalculé à chaque ligne dans %', restantes;
  end if;
  raise notice 'ok — les 9 règles calculent l''identité une fois par requête';
end $$;

do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public'
      and policyname in ('posts_insert_auteur', 'posts_delete_auteur_ou_admin', 'profils_select_authentifie',
                         'profils_insert_proprietaire', 'profils_update_membres', 'p_dms_select', 'p_dms_insert',
                         'p_dms_delete', 'push_ses_abonnements')) <> 9 then
    raise exception 'ÉCHEC : une des 9 règles a disparu';
  end if;
  raise notice 'ok — les 9 règles sont toujours là';
end $$;

\echo 'Tous les tests de la migration 09 sont passés.'
