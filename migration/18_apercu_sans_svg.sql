-- Migration 18 : aperçu public sans image SVG ni publication programmée.
--
-- Audit sécurité : /api/p-image sert l'image renvoyée par kc_apercu_publication
-- depuis le domaine de l'application. Une image « data:image/svg+xml » y
-- exécutait son script (vol de session). Seules les photos (png, jpeg, webp,
-- gif) sont désormais renvoyées ; /api/p-image applique la même règle.
-- Une publication programmée n'est plus lisible avant son heure.
-- Idempotente.

create or replace function public.kc_apercu_publication(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'author', c ->> 'author',
    'caption', left(coalesce(c ->> 'caption', ''), 300),
    'image', (
      select v from (
        select c #>> '{mediaUrls,0}' as v, 1 as rang
        union all select c ->> 'videoPoster', 2
        union all select c #>> '{originalMediaUrls,0}', 3
        union all select c ->> 'originalVideoPoster', 4
        union all select c ->> 'eventImage', 5
      ) cand
      where v like 'https://%' or v ~ '^data:image/(png|jpeg|jpg|webp|gif);base64,'
      order by rang limit 1
    ),
    'eventTitle', case when c ->> 'type' = 'EVENT' then left(c ->> 'eventTitle', 120) end,
    'eventDate', case when c ->> 'type' = 'EVENT' and c ->> 'eventDate' ~ '^\d{4}-\d{2}-\d{2}$' then c ->> 'eventDate' end,
    'eventStart', case when c ->> 'type' = 'EVENT' and c ->> 'eventStart' ~ '^\d{2}:\d{2}$' then c ->> 'eventStart' end,
    'serie', (
      select case when count(*) > 1 then jsonb_build_object('nb', count(*), 'debut', min(d), 'fin', max(d)) end
      from (
        select s.content ->> 'eventDate' as d,
               bool_or(s.content ->> 'eventDate' >= to_char(now() at time zone 'UTC', 'YYYY-MM-DD')) over () as reste
        from public.kun_com_posts s
        where c ->> 'type' = 'EVENT' and coalesce(c ->> 'recurrenceGroupId', '') <> ''
          and s.content ->> 'type' = 'EVENT'
          and s.content ->> 'recurrenceGroupId' = c ->> 'recurrenceGroupId'
          and coalesce(s.content ->> 'status', '') <> 'deleted'
          and coalesce(s.content ->> 'visibility', 'all') = 'all'
          and s.content ->> 'eventDate' ~ '^\d{4}-\d{2}-\d{2}$'
      ) occ
      where not reste or d >= to_char(now() at time zone 'UTC', 'YYYY-MM-DD')
    )
  )
  from (select content as c from public.kun_com_posts where id = p_id) p
  where jsonb_typeof(c) = 'object'
    and coalesce(c ->> 'status', '') not in ('deleted', 'scheduled')
    and coalesce(c ->> 'type', 'POST') in ('POST', 'REPOST', 'EVENT')
    and coalesce(c ->> 'visibility', 'all') = 'all';
$$;

revoke all on function public.kc_apercu_publication(text) from public;
grant execute on function public.kc_apercu_publication(text) to anon, authenticated;
