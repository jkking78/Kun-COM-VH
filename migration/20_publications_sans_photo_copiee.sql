-- Migration 20 : publications allégées des photos de profil recopiées.
--
-- Audit performance : la photo de profil (base64, 16 à 30 Ko) était recopiée
-- dans chaque publication, puis téléchargée par chaque membre à chaque
-- synchronisation et dans chaque événement temps réel. L'affichage prend déjà
-- la photo dans la fiche de l'auteur ; la copie n'était qu'un secours.
-- Désormais l'application ne recopie qu'une adresse hébergée (v188) ; cette
-- migration retire les copies base64 déjà enregistrées. Idempotente.

update public.kun_com_posts
   set content = content - 'avatar_url'
 where jsonb_typeof(content) = 'object'
   and content ->> 'avatar_url' like 'data:%';
