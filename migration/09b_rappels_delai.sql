-- ============================================================
-- MIGRATION 09b — RAPPELS : DÉLAI ET MÉNAGE (Supabase uniquement)
-- À exécuter après la 08b. Ré-exécutable : cron.schedule remplace une tâche
-- qui porte déjà le même nom.
--  1) L'appel planifié attendait 5 s alors que la fonction met jusqu'à 12 s
--     (démarrage à froid) : l'appel était noté en échec alors que les
--     rappels partaient. On attend désormais 30 s.
--  2) L'historique de pg_cron n'est jamais purgé (144 lignes par jour) : on
--     ne garde que les 7 derniers jours.
-- ============================================================
select cron.schedule(
  'kc-rappels',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://yugkryhikrfsxbuyxacl.supabase.co/functions/v1/push',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"action": "rappels"}'::jsonb,
       timeout_milliseconds := 30000
     ); $$
);

select cron.schedule(
  'kc-menage-historique',
  '17 3 * * 0',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days'; $$
);
