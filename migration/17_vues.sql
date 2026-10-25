-- Migration 17 : les vues des publications sont enregistrées sur le serveur.
--
-- Jusqu'ici « viewedBy » n'était tenu que sur chaque appareil : renvoyer toute
-- la publication à chaque carte vue risquait d'écraser les écritures des
-- autres. Chacun ne voyait donc que sa propre vue.
--
-- kc_marquer_vues(ids) ajoute la personne connectée à viewedBy, et rien
-- d'autre. Elle s'exécute avec les droits de l'appelant (security invoker) :
-- RLS (compte validé, publication visible) et le déclencheur de la migration 06
-- (un membre ne peut ajouter ou retirer QUE son propre identifiant) s'appliquent.
-- L'auteur ne se compte pas ; supprimées et enregistrements internes ignorés.
-- Idempotente.

create or replace function public.kc_marquer_vues(p_ids text[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  moi text := auth.uid()::text;
  n integer;
begin
  if moi is null or p_ids is null then return 0; end if;
  update public.kun_com_posts
     set content = jsonb_set(content, '{viewedBy}',
           (case when jsonb_typeof(content -> 'viewedBy') = 'array' then content -> 'viewedBy' else '[]'::jsonb end)
           || jsonb_build_array(moi))
   where id = any (p_ids[1:100])
     and jsonb_typeof(content) = 'object'
     and content ->> 'userId' is distinct from moi
     and coalesce(content ->> 'status', '') <> 'deleted'
     and coalesce(content ->> 'type', '') not in ('TASK_DONE', 'EVENT_ARCHIVED')
     and not (case when jsonb_typeof(content -> 'viewedBy') = 'array' then content -> 'viewedBy' else '[]'::jsonb end)
             @> jsonb_build_array(moi);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.kc_marquer_vues(text[]) from public, anon;
grant execute on function public.kc_marquer_vues(text[]) to authenticated;
