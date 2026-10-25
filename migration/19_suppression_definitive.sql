-- Migration 19 : une publication supprimée le reste.
--
-- Audit synchro : pour l'auteur ou l'Admin, le serveur prend le contenu envoyé
-- tel quel, status compris. Un appareil qui avait encore la publication en
-- cache (épingler, modifier, file hors ligne rejouée...) la faisait revenir en
-- ligne, texte et médias compris. Désormais, une ligne marquée supprimée garde
-- son marqueur, quelle que soit l'écriture qui arrive ensuite.
-- Le déclencheur de la migration 16 est complété (même nom, toujours le
-- dernier à s'exécuter). Idempotente.

create or replace function public.kc_posts_pierre_tombale()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c jsonb;
  garde jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'UPDATE' and jsonb_typeof(old.content) = 'object' and old.content ->> 'status' = 'deleted' then
    new.content := old.content;
    return new;
  end if;
  c := new.content;
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
