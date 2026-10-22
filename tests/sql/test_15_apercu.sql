-- Tests de la migration 15 (après 06 et 15).
\set ON_ERROR_STOP 1
\set QUIET 1

create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;

insert into kun_com_posts (id, content) values
  ('p1', '{"id":"p1","author":"Awa","caption":"Bonjour","type":"POST"}'),
  ('s0', jsonb_build_object('id','s0','type','EVENT','author','A','eventTitle','1er Culte','eventDate','2020-01-05','eventStart','07:00','recurrenceGroupId','s0','eventImage','https://x/affiche.jpg','eventLocation','Secret','assignments','[{"userId":"u"}]'::jsonb)),
  ('s1', jsonb_build_object('id','s1','type','EVENT','eventTitle','1er Culte','eventDate','2099-01-04','eventStart','07:00','recurrenceGroupId','s0')),
  ('s2', jsonb_build_object('id','s2','type','EVENT','eventTitle','1er Culte','eventDate','2099-01-11','eventStart','07:00','recurrenceGroupId','s0')),
  ('s3', jsonb_build_object('id','s3','type','EVENT','eventTitle','1er Culte','eventDate','2099-01-18','eventStart','07:00','recurrenceGroupId','s0','status','deleted')),
  ('v0', jsonb_build_object('id','v0','type','EVENT','eventTitle','Vieux','eventDate','2020-01-01','recurrenceGroupId','v0')),
  ('v1', jsonb_build_object('id','v1','type','EVENT','eventTitle','Vieux','eventDate','2020-01-08','recurrenceGroupId','v0')),
  ('e1', jsonb_build_object('id','e1','type','EVENT','eventTitle','Seul','eventDate','2099-02-01','eventStart','<b>'));

set role anon;
select tst_verifier(kc_apercu_publication('p1') ->> 'caption' = 'Bonjour' and kc_apercu_publication('p1') -> 'eventTitle' = 'null'::jsonb, 'une publication ordinaire reste inchangée');
select tst_verifier(kc_apercu_publication('s1') ->> 'eventTitle' = '1er Culte' and kc_apercu_publication('s1') ->> 'eventDate' = '2099-01-04' and kc_apercu_publication('s1') ->> 'eventStart' = '07:00', 'titre, date et heure d''un événement');
select tst_verifier(kc_apercu_publication('s0') ->> 'image' = 'https://x/affiche.jpg', 'l''affiche sert d''image');
select tst_verifier(kc_apercu_publication('s0')::text not like '%Secret%' and kc_apercu_publication('s0')::text not like '%assignments%', 'ni le lieu ni l''équipe');
select tst_verifier(kc_apercu_publication('s0') -> 'serie' = '{"nb":2,"debut":"2099-01-04","fin":"2099-01-11"}'::jsonb, 'série : seulement les dates à venir, sans les supprimées');
select tst_verifier((kc_apercu_publication('v1') -> 'serie' ->> 'nb')::int = 2, 'série entièrement passée : toutes ses dates');
select tst_verifier(kc_apercu_publication('e1') -> 'serie' = 'null'::jsonb and kc_apercu_publication('e1') -> 'eventStart' = 'null'::jsonb, 'événement seul : pas de série, heure invalide écartée');
