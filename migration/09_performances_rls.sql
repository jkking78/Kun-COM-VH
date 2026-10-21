-- ============================================================
-- MIGRATION 09 — RÈGLES D'ACCÈS PLUS RAPIDES (Supabase)
-- À exécuter après la 08. Ne change AUCUN droit : chaque règle garde
-- exactement le même sens. Seule l'écriture change : auth.uid() et
-- auth.jwt() sont placés dans un « (select …) » pour que Postgres les calcule
-- une fois par requête au lieu d'une fois par ligne (alerte de performance
-- « auth_rls_initplan » de Supabase). Ré-exécutable sans effet de bord.
-- ============================================================

alter policy "posts_insert_auteur" on public.kun_com_posts
  with check (
    (select public.kc_compte_approuve())
    and (
      public.kc_post_existe(id)
      or (
        content ->> 'userId' = (select auth.uid())::text
        and id ~ '^[A-Za-z0-9_-]{1,64}$'
        and (content ->> 'type' is distinct from 'EVALUATION' or (select public.jwt_role()) = 'GRAND_RESPONSABLE')
        and (coalesce(content ->> 'type', '') not in ('EVENT', 'EVENT_ARCHIVED')
             or (select public.jwt_role()) in ('GRAND_RESPONSABLE', 'RESP_SECTION'))
      )
    )
  );

alter policy "posts_delete_auteur_ou_admin" on public.kun_com_posts
  using (
    (select public.kc_compte_approuve())
    and (content ->> 'userId' = (select auth.uid())::text
         or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE')
  );

alter policy "profils_select_authentifie" on public.kun_com_profiles
  using (id = (select auth.uid())::text or (select public.kc_compte_approuve()));

alter policy "profils_insert_proprietaire" on public.kun_com_profiles
  with check (id = (select auth.uid())::text or ((select public.kc_compte_approuve()) and public.kc_profil_existe(id)));

alter policy "profils_update_membres" on public.kun_com_profiles
  using (id = (select auth.uid())::text or (select public.kc_compte_approuve()))
  with check (id = (select auth.uid())::text or (select public.kc_compte_approuve()));

alter policy p_dms_select on public.kun_com_dms
  using (
    (select public.kc_compte_approuve())
    and (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text or public.kc_membre_du_pole(to_id))
  );

alter policy p_dms_insert on public.kun_com_dms
  with check (
    from_id = (select auth.uid())::text and (select public.kc_compte_approuve())
    and (to_id not like 'pole:%' or public.kc_membre_du_pole(to_id))
  );

alter policy p_dms_delete on public.kun_com_dms
  using (from_id = (select auth.uid())::text);

alter policy push_ses_abonnements on public.kun_com_push_abonnements
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text and (select public.kc_compte_approuve()));
