-- Migration 16 : une publication supprimée ne garde plus son contenu.
--
-- La suppression est « douce » : la ligne reste en base avec status 'deleted',
-- pour que chaque appareil apprenne la suppression (voir mergePostsWithLocal).
-- Jusqu'ici la ligne gardait TOUT (texte, sondage, commentaires, assignations…),
-- lisible par n'importe quel membre qui interroge la base directement.
--
-- Désormais, à l'écriture du marqueur, la base ne garde que ce qui sert à
-- propager la suppression :
--   id, status, type, userId (droits de l'auteur), timestamp (tri),
--   eventDate (les appareils relisent les événements à venir par cette date),
--   recurrenceGroupId, deletedAt.
-- Le déclencheur passe après ceux de la migration 06 (ordre alphabétique) : un
-- membre qui n'a pas le droit de supprimer y a déjà vu son marqueur annulé.
-- Idempotente.

create or replace function public.kc_posts_pierre_tombale()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c jsonb := new.content;
  garde jsonb := '{}'::jsonb;
  k text;
begin
  if jsonb_typeof(c) is distinct from 'object' or c ->> 'status' is distinct from 'deleted' then
    return new;
  end if;
  foreach k in array array['id', 'status', 'type', 'userId', 'timestamp', 'eventDate', 'recurrenceGroupId', 'deletedAt'] loop
    if c ? k then garde := garde || jsonb_build_object(k, c -> k); end if;
  end loop;
  if not garde ? 'id' then garde := garde || jsonb_build_object('id', new.id); end if;
  if not garde ? 'deletedAt' then
    garde := garde || jsonb_build_object('deletedAt', (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  new.content := garde;
  return new;
end $$;

drop trigger if exists trg_kc_posts_zz_pierre_tombale on public.kun_com_posts;
create trigger trg_kc_posts_zz_pierre_tombale
  before insert or update on public.kun_com_posts
  for each row execute function public.kc_posts_pierre_tombale();

-- Les publications déjà supprimées sont vidées de la même façon.
update public.kun_com_posts set content = content
 where content ->> 'status' = 'deleted'
   and exists (select 1 from jsonb_object_keys(content) k
               where k not in ('id', 'status', 'type', 'userId', 'timestamp', 'eventDate', 'recurrenceGroupId', 'deletedAt'));
