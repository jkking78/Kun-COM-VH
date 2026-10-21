-- Tests de la migration 07 (après 06 et 07). Même principe que ceux de la 06.
\set ON_ERROR_STOP 1
\set QUIET 1

-- B : membre déjà validé ; P : inscription en attente ; R : Responsable
-- (validé par son rôle) ; Z : Admin.
insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'p@x', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom
    when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'P' then 'eeeeeeee-0000-0000-0000-000000000005'
    when 'R' then 'cccccccc-0000-0000-0000-000000000003'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case nom when 'R' then 'RESP_SECTION'
                                                       when 'Z' then 'GRAND_RESPONSABLE'
                                                       else 'MEMBRE' end))::text, false);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
$$;
create function public.tst_profil(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_profiles where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

set role authenticated;

-- ---------- Réponses aux convocations ----------
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object(
  'id','ev1','type','EVENT','userId', tst_qui('R'), 'eventTitle','Culte',
  'assignments', jsonb_build_array(jsonb_build_object('userId', tst_qui('B'), 'task', 'Caméra'))));
select tst_verifier(tst_post('ev1') is not null, 'un Responsable sans indicateur de validation est validé par son rôle');

select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || jsonb_build_object('reponsesConvocation', jsonb_build_object(
  tst_qui('B'), jsonb_build_object('statut', 'decline', 'motif', 'Voyage'),
  tst_qui('R'), jsonb_build_object('statut', 'confirme'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> array['reponsesConvocation', tst_qui('B'), 'statut'] = 'decline', 'un membre enregistre sa réponse à une convocation');
select tst_verifier(not (tst_post('ev1') -> 'reponsesConvocation' ? tst_qui('R')), 'un membre ne répond pas à la place d''un autre');

-- L'auteur réécrit l'événement depuis une copie périmée : la réponse de B reste.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', (tst_post('ev1') - 'reponsesConvocation') || '{"eventTitle":"Culte du dimanche"}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') ->> 'eventTitle' = 'Culte du dimanche'
  and tst_post('ev1') #>> array['reponsesConvocation', tst_qui('B'), 'motif'] = 'Voyage', 'la copie périmée de l''auteur n''efface pas les réponses');

-- ---------- Compte en attente ----------
select tst_en_tant_que('P');
select tst_verifier((select count(*) from kun_com_posts) = 0, 'un compte en attente ne voit aucune publication');
insert into kun_com_profiles (id, content) values (tst_qui('P'), jsonb_build_object('id', tst_qui('P'), 'prenom', 'Paul', 'approuve', true));
select tst_verifier(tst_profil(tst_qui('P')) -> 'approuve' = 'false'::jsonb, 'un compte en attente ne peut pas se déclarer validé');
select tst_verifier((select count(*) from kun_com_profiles) = 1, 'un compte en attente ne voit que sa propre fiche');
do $$ begin
  insert into kun_com_posts (id, content) values ('pp1', jsonb_build_object('id','pp1','userId', tst_qui('P'), 'caption', 'coucou'));
  raise exception 'ÉCHEC : publication d''un compte en attente acceptée';
exception when insufficient_privilege then raise notice 'ok — un compte en attente ne publie pas';
end $$;
do $$ begin
  insert into kun_com_dms (id, from_id, to_id, content) values ('dm1', tst_qui('P'), tst_qui('B'), '{}');
  raise exception 'ÉCHEC : message d''un compte en attente accepté';
exception when insufficient_privilege then raise notice 'ok — un compte en attente n''envoie pas de message';
end $$;

-- Les responsables voient la demande (fiche marquée « non validée »).
select tst_en_tant_que('R');
select tst_verifier((select content -> 'approuve' from kun_com_profiles where id = tst_qui('P')) = 'false'::jsonb, 'un responsable voit la demande en attente');

-- Validation (écrite par l'Edge Function set-role) : effet immédiat.
reset role;
select set_config('request.jwt.claims', '', false);
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"approuve": true}' where id = tst_qui('P')::uuid;
set role authenticated;
select tst_en_tant_que('P');
select tst_verifier((select count(*) from kun_com_posts) = 1, 'une fois validé, le compte voit les publications sans se reconnecter');
update kun_com_profiles set content = content || '{"bio":"Bonjour"}' where id = tst_qui('P');
select tst_verifier(tst_profil(tst_qui('P')) -> 'approuve' = 'true'::jsonb, 'sa fiche passe à « validé » à la prochaine écriture');

-- Un membre validé continue de tout voir.
select tst_en_tant_que('B');
select tst_verifier((select count(*) from kun_com_profiles) >= 1 and (select count(*) from kun_com_posts) = 1, 'un membre validé voit fiches et publications');

\echo 'Tous les tests de la migration 07 sont passés.'
