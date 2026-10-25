-- Tests de la migration 18 (après 06, 15 et 18).
\set ON_ERROR_STOP 1
\set QUIET 1

create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;

insert into kun_com_posts (id, content) values
  ('svg', jsonb_build_object('id','svg','type','POST','caption','x','mediaUrls', jsonb_build_array('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='))),
  ('svg2', jsonb_build_object('id','svg2','type','POST','caption','x','mediaUrls', jsonb_build_array('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), 'videoPoster', 'data:image/png;base64,iVBORw0KGgo=')),
  ('png', jsonb_build_object('id','png','type','POST','caption','x','mediaUrls', jsonb_build_array('data:image/jpeg;base64,/9j/4AAQ'))),
  ('plus_tard', jsonb_build_object('id','plus_tard','type','POST','caption','Surprise','status','scheduled','scheduled_at', 9e15));

set role anon;
select tst_verifier(kc_apercu_publication('svg') -> 'image' = 'null'::jsonb, 'une image SVG n''est jamais renvoyée');
select tst_verifier(kc_apercu_publication('svg2') ->> 'image' = 'data:image/png;base64,iVBORw0KGgo=', 'à défaut, la photo suivante est prise');
select tst_verifier(kc_apercu_publication('png') ->> 'image' like 'data:image/jpeg;base64,%', 'une photo reste renvoyée');
select tst_verifier(kc_apercu_publication('plus_tard') is null, 'une publication programmée n''a pas d''aperçu');
reset role;

\echo 'Tous les tests de la migration 18 sont passés.'
