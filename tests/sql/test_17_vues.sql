-- Tests de la migration 17 (après 06, 07, 14 et 17).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x', '{"role":"MEMBRE","approuve":true}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@x', '{"role":"MEMBRE","approuve":false}');
create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'A' then 'aaaaaaaa-0000-0000-0000-000000000001' when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'C' then 'cccccccc-0000-0000-0000-000000000003' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'MEMBRE'))::text, false);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

-- Publications de A : une ordinaire (déjà aimée et commentée), une ciblée sur un pôle.
insert into kun_com_posts (id, content) values
  ('p1', jsonb_build_object('id', 'p1', 'userId', tst_qui('A'), 'caption', 'Bonjour',
     'likedBy', jsonb_build_array(tst_qui('A')), 'comments', '[{"id":"c1","userId":"x","text":"Super"}]'::jsonb)),
  ('p_pole', jsonb_build_object('id', 'p_pole', 'userId', tst_qui('A'), 'visibility', 'sections', 'targetSections', '["photo"]'::jsonb));
insert into kun_com_profiles (id, content) values (tst_qui('B'), '{"sections":["cadrage"]}');
set role authenticated;

select tst_en_tant_que('B');
select tst_verifier(kc_marquer_vues(array['p1', 'p_pole']) = 1, 'B marque une vue sur ce qu''il peut voir, pas sur la publication ciblée d''un autre pôle');
select tst_verifier(tst_post('p1') -> 'viewedBy' = jsonb_build_array(tst_qui('B')), 'la vue de B est enregistrée');
select tst_verifier(tst_post('p1') ->> 'caption' = 'Bonjour' and tst_post('p1') -> 'likedBy' = jsonb_build_array(tst_qui('A'))
    and jsonb_array_length(tst_post('p1') -> 'comments') = 1, 'rien d''autre n''est modifié');
select tst_verifier(kc_marquer_vues(array['p1']) = 0, 'une seconde vue ne compte pas');
select tst_verifier(tst_post('p_pole') -> 'viewedBy' is null, 'la publication ciblée n''est pas touchée');

select tst_en_tant_que('A');
select tst_verifier(kc_marquer_vues(array['p1']) = 0, 'l''auteur ne se compte pas');

select tst_en_tant_que('C');
select tst_verifier(kc_marquer_vues(array['p1']) = 0, 'un compte en attente ne compte pas');

reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select tst_verifier(kc_marquer_vues(array['p1']) = 0, 'sans connexion, aucune vue');
reset role;

\echo 'Tous les tests de la migration 17 sont passés.'
