-- Migration 22 : les notifications quittent les fiches.
--
-- Audit (sécurité et performance) : les notifications vivaient dans le JSON de
-- la fiche du destinataire. Conséquences :
--   - toute fiche était lisible en entier par les membres validés,
--     notifications comprises (extraits de commentaires, mentions) ;
--   - chaque notification, chaque « lu », chaque battement de présence
--     renvoyait la fiche ENTIÈRE (jusqu'à 50 notifications) à tous les
--     membres connectés, par le temps réel.
--
-- Désormais : table kun_com_notifications (une ligne par notification).
--   - Lecture, « lu » et suppression : le destinataire seul.
--   - Création : un membre validé, signée par la base (expéditeur = lui ;
--     nom tiré de sa fiche ; type connu ; texte borné ; 150 par heure).
--   - 100 notifications gardées par destinataire.
--   - Diffusée en temps réel (chacun ne reçoit que les siennes, RLS).
-- Les notifications existantes sont copiées, puis retirées des fiches.
-- Une ancienne version de l'application qui écrit encore une notification
-- dans la fiche d'un autre voit son écriture convertie en ligne de la table.
-- Idempotente.

create table if not exists public.kun_com_notifications (
  destinataire text not null references public.kun_com_profiles(id) on delete cascade,
  id text not null,
  content jsonb not null,
  cree_le timestamptz not null default now(),
  primary key (destinataire, id)
);
create index if not exists kun_com_notifications_recentes on public.kun_com_notifications (destinataire, cree_le desc);
alter table public.kun_com_notifications enable row level security;

-- Notification signée par la base, ou null (refusée / limite atteinte).
create or replace function public.kc_signer_notification(nv jsonb, acteur text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  types_connus text[] := array['ARRIVAL','CANAL','COMMENT','CONVOCATION','ECHANGE','EVALUATION','EVENT',
    'EVENT_ASSIGNED','EVENT_CANCELLED','EVENT_PARTICIPATION','EVENT_SECTION','FOLLOW','LIKE','MENTION',
    'MESSAGE','NEW_MEMBER','POST_SECTION','REPLY','REPOST','TASK_DONE'];
  fiche jsonb;
  nom text;
begin
  if jsonb_typeof(nv) is distinct from 'object' or acteur is null then return null; end if;
  if coalesce(nv ->> 'id', '') !~ '^[A-Za-z0-9_\-]{1,80}$' then return null; end if;
  if not public.kc_limite('notif:' || acteur, 150, interval '1 hour') then return null; end if;
  select p.content into fiche from public.kun_com_profiles p where p.id = acteur;
  nom := trim(coalesce(fiche ->> 'prenom', '') || ' ' ||
              case when coalesce(fiche ->> 'nom', '') <> '' then left(fiche ->> 'nom', 1) || '.' else '' end);
  if nom = '' then nom := 'Membre'; end if;
  return jsonb_build_object(
    'id', nv ->> 'id',
    'senderId', acteur,
    'senderName', nom,
    'senderAvatar', case when nv ->> 'senderAvatar' like 'https://%' then to_jsonb(left(nv ->> 'senderAvatar', 500)) else 'null'::jsonb end,
    'senderColor', case when coalesce(nv ->> 'senderColor', '') ~ '^#[0-9A-Fa-f]{3,8}$' then nv -> 'senderColor' else '"#0B5FE0"'::jsonb end,
    'type', case when nv ->> 'type' = any (types_connus) then nv ->> 'type' else 'EVENT' end,
    'title', left(coalesce(nv ->> 'title', ''), 80),
    'text', left(coalesce(nv ->> 'text', ''), 300),
    'targetId', case when jsonb_typeof(nv -> 'targetId') = 'string' then to_jsonb(left(nv ->> 'targetId', 120)) else 'null'::jsonb end,
    'commentId', case when jsonb_typeof(nv -> 'commentId') = 'string' then to_jsonb(left(nv ->> 'commentId', 80)) else 'null'::jsonb end,
    'timestamp', (extract(epoch from now()) * 1000)::bigint,
    'read', false);
end $$;
revoke all on function public.kc_signer_notification(jsonb, text) from public, anon, authenticated;

-- Création : signée par la base (un appel du serveur, sans utilisateur, passe tel quel).
create or replace function public.kc_notifications_avant_insertion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acteur text := auth.uid()::text;
  signee jsonb;
begin
  if acteur is null then
    new.content := new.content || jsonb_build_object('id', new.id);
    return new;
  end if;
  signee := public.kc_signer_notification(new.content || jsonb_build_object('id', new.id), acteur);
  if signee is null then return null; end if;          -- ignorée sans erreur
  new.content := signee;
  new.cree_le := now();
  return new;
end $$;
drop trigger if exists trg_kc_notifications_avant_insertion on public.kun_com_notifications;
create trigger trg_kc_notifications_avant_insertion
  before insert on public.kun_com_notifications
  for each row execute function public.kc_notifications_avant_insertion();

-- Mise à jour par le destinataire : seul l'état « lu » change.
create or replace function public.kc_notifications_avant_maj()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  new.destinataire := old.destinataire;
  new.id := old.id;
  new.cree_le := old.cree_le;
  new.content := old.content || jsonb_build_object('read', coalesce((new.content ->> 'read')::boolean, false));
  return new;
end $$;
drop trigger if exists trg_kc_notifications_avant_maj on public.kun_com_notifications;
create trigger trg_kc_notifications_avant_maj
  before update on public.kun_com_notifications
  for each row execute function public.kc_notifications_avant_maj();

-- 100 notifications gardées par destinataire.
create or replace function public.kc_notifications_apres_insertion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.kun_com_notifications n
   where n.destinataire = new.destinataire
     and n.id not in (select id from public.kun_com_notifications
                       where destinataire = new.destinataire order by cree_le desc limit 100);
  return null;
end $$;
drop trigger if exists trg_kc_notifications_apres_insertion on public.kun_com_notifications;
create trigger trg_kc_notifications_apres_insertion
  after insert on public.kun_com_notifications
  for each row execute function public.kc_notifications_apres_insertion();

drop policy if exists notifications_lecture on public.kun_com_notifications;
create policy notifications_lecture on public.kun_com_notifications for select to authenticated
  using (destinataire = (select auth.uid())::text);
drop policy if exists notifications_creation on public.kun_com_notifications;
create policy notifications_creation on public.kun_com_notifications for insert to authenticated
  with check ((select public.kc_compte_approuve()) and content ->> 'senderId' = (select auth.uid())::text);
drop policy if exists notifications_lu on public.kun_com_notifications;
create policy notifications_lu on public.kun_com_notifications for update to authenticated
  using (destinataire = (select auth.uid())::text) with check (destinataire = (select auth.uid())::text);
drop policy if exists notifications_suppression on public.kun_com_notifications;
create policy notifications_suppression on public.kun_com_notifications for delete to authenticated
  using (destinataire = (select auth.uid())::text);
grant select, insert, update, delete on public.kun_com_notifications to authenticated;

-- Fiches : plus aucune notification. Une notification qu'une ancienne version
-- dépose dans la fiche d'un autre devient une ligne de la table.
create or replace function public.kc_profils_avant_ecriture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acteur text := auth.uid()::text;
  vrai_role text;
  approuve boolean;
  res jsonb;
  nv jsonb;
  signee jsonb;
  n int := 0;
begin
  if acteur is null then return new; end if;            -- service_role / SQL Editor
  if jsonb_typeof(new.content) is distinct from 'object' then
    if tg_op = 'UPDATE' then new.content := old.content; end if;
    return new;
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', 'MEMBRE'),
         (u.raw_app_meta_data ->> 'approuve' = 'true')
           or coalesce(u.raw_app_meta_data ->> 'role', '') in ('GRAND_RESPONSABLE', 'RESP_SECTION')
    into vrai_role, approuve
    from auth.users u where u.id::text = new.id;

  if tg_op = 'INSERT' then
    res := new.content - 'pwd' - 'sec_a1' - 'sec_a2' - 'notifications';
    if res ? 'welcomeStars' then res := jsonb_set(res, '{welcomeStars}', '5'::jsonb); end if;
    -- Pôles à la création (21).
    if coalesce(vrai_role, 'MEMBRE') <> 'GRAND_RESPONSABLE' then
      if coalesce(approuve, false) then
        res := jsonb_set(res - 'section_id', '{sections}', '[]'::jsonb);
      elsif jsonb_typeof(res -> 'sections') = 'array' then
        res := jsonb_set(res, '{sections}', coalesce((
          select jsonb_agg(x order by o) from jsonb_array_elements(res -> 'sections') with ordinality t(x, o)
           where o <= 2 and jsonb_typeof(x) = 'string'), '[]'::jsonb));
      elsif res ? 'sections' then
        res := jsonb_set(res, '{sections}', '[]'::jsonb);
      end if;
    end if;
  elsif acteur = old.id then
    res := new.content - 'pwd' - 'sec_a1' - 'sec_a2' - 'notifications';
    if jsonb_typeof(old.content) = 'object' then
      res := case when old.content ? 'welcomeStars' then jsonb_set(res, '{welcomeStars}', old.content -> 'welcomeStars')
                  else res - 'welcomeStars' end;
      if coalesce(approuve, false) and coalesce(vrai_role, 'MEMBRE') <> 'GRAND_RESPONSABLE' then
        res := case when old.content ? 'sections' then jsonb_set(res, '{sections}', old.content -> 'sections') else res - 'sections' end;
        res := case when old.content ? 'section_id' then jsonb_set(res, '{section_id}', old.content -> 'section_id') else res - 'section_id' end;
      end if;
    end if;
  else
    if jsonb_typeof(old.content) is distinct from 'object' then
      new.content := old.content;
      return new;
    end if;
    -- Ancienne version : ses notifications deviennent des lignes de la table.
    if public.kc_compte_approuve() and jsonb_typeof(new.content -> 'notifications') = 'array' then
      for nv in select e from jsonb_array_elements(new.content -> 'notifications') e loop
        exit when n >= 5;
        continue when jsonb_typeof(nv) is distinct from 'object' or nv ->> 'senderId' is distinct from acteur;
        continue when exists (select 1 from public.kun_com_notifications x where x.destinataire = new.id and x.id = nv ->> 'id');
        signee := public.kc_signer_notification(nv, acteur);
        continue when signee is null;
        insert into public.kun_com_notifications (destinataire, id, content) values (new.id, signee ->> 'id', signee)
          on conflict do nothing;
        n := n + 1;
      end loop;
    end if;
    res := old.content - 'notifications';
    -- Pôles fixés par l'Admin via kc_definir_poles (seul chemin autorisé).
    if current_setting('kc.poles_admin', true) = '1' and public.jwt_role() = 'GRAND_RESPONSABLE' then
      res := (res - 'section_id') || jsonb_build_object('sections', coalesce(new.content -> 'sections', '[]'::jsonb));
    end if;
  end if;

  res := jsonb_set(res, '{role}', to_jsonb(coalesce(vrai_role, 'MEMBRE')));
  res := jsonb_set(res, '{approuve}', to_jsonb(coalesce(approuve, false)));
  new.content := res;
  if tg_op = 'UPDATE' then new.id := old.id; end if;
  return new;
end $$;

-- Reprise des notifications existantes, puis fiches allégées.
insert into public.kun_com_notifications (destinataire, id, content, cree_le)
select p.id, n ->> 'id', n,
       to_timestamp(greatest(public.kc_num(n -> 'timestamp'), 0) / 1000.0)
  from public.kun_com_profiles p,
       jsonb_array_elements(case when jsonb_typeof(p.content -> 'notifications') = 'array' then p.content -> 'notifications' else '[]'::jsonb end) n
 where coalesce(n ->> 'id', '') <> ''
on conflict do nothing;
update public.kun_com_profiles set content = content - 'notifications' where content ? 'notifications';

-- Temps réel.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kun_com_notifications') then
    alter publication supabase_realtime add table public.kun_com_notifications;
  end if;
end $$;
