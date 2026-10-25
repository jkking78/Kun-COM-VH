-- Tests de la migration 20 (après 06 et 20 ; la migration est rejouée par le banc).
\set ON_ERROR_STOP 1
\set QUIET 1
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
insert into kun_com_posts (id, content) values
  ('lourde', '{"id":"lourde","caption":"x","avatar_url":"data:image/jpeg;base64,AAAA"}'),
  ('legere', '{"id":"legere","caption":"y","avatar_url":"https://x/photo.jpg"}');
\i migration/20_publications_sans_photo_copiee.sql
select tst_verifier((select not (content ? 'avatar_url') and content ->> 'caption' = 'x' from kun_com_posts where id = 'lourde'), 'la copie base64 est retirée, le reste est intact');
select tst_verifier((select content ->> 'avatar_url' = 'https://x/photo.jpg' from kun_com_posts where id = 'legere'), 'une adresse hébergée est gardée');
\echo 'Tous les tests de la migration 20 sont passés.'
