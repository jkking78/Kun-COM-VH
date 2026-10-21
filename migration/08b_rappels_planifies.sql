-- ============================================================
-- MIGRATION 08b — RAPPELS PLANIFIÉS (Supabase uniquement)
-- À exécuter après la 08 ET après le déploiement de l'Edge Function « push ».
-- Toutes les 10 minutes, pg_cron appelle la fonction, qui envoie les rappels
-- dus (veille, 2 h avant, oubli de pointage, échéance de tâche). Aucun secret
-- ici : l'action « rappels » est sans effet si on la rappelle (chaque rappel
-- n'est envoyé qu'une fois).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'kc-rappels',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://yugkryhikrfsxbuyxacl.supabase.co/functions/v1/push',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"action": "rappels"}'::jsonb
     ); $$
);
