-- ============================================================
-- MIGRATION 14 — LOT D3 : VISIBILITÉ CIBLÉE CÔTÉ SERVEUR (Supabase)
-- À exécuter après la 13. Ré-exécutable sans effet de bord, sans DROP.
--  S14 : une publication réservée à certains pôles (visibility = 'sections')
--        ou programmée (status = 'scheduled', date à venir) n'était filtrée
--        que par l'application : l'API et le cache local la livraient à tous.
--        Désormais la base ne la livre qu'à son auteur, à l'Admin et, une
--        fois publiée, aux membres des pôles visés.
-- ============================================================

create or replace function public.kc_publication_visible(c jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  moi text := auth.uid()::text;
begin
  if jsonb_typeof(c) is distinct from 'object' then return true; end if;
  if public.jwt_role() = 'GRAND_RESPONSABLE' or c ->> 'userId' = moi then return true; end if;
  if c ->> 'status' = 'scheduled' and public.kc_num(c -> 'scheduled_at') > public.kc_maintenant_ms() then
    return false;
  end if;
  if c ->> 'visibility' = 'sections' and jsonb_typeof(c -> 'targetSections') = 'array'
     and jsonb_array_length(c -> 'targetSections') > 0 then
    return exists (select 1 from jsonb_array_elements_text(c -> 'targetSections') x
                   where public.kc_membre_du_pole('pole:' || x));
  end if;
  return true;
end $$;
revoke all on function public.kc_publication_visible(jsonb) from public, anon;
grant execute on function public.kc_publication_visible(jsonb) to authenticated;

alter policy "posts_select_authentifie" on public.kun_com_posts
  using ((select public.kc_compte_approuve()) and public.kc_publication_visible(content));
