-- =============================================================
-- Migration 042 : job pg_cron pour les briefs IA quotidiens
-- =============================================================
-- Prérequis : activer pg_cron dans Supabase Dashboard
--   → Database > Extensions > pg_cron (activer)
--   → Database > Extensions > pg_net  (activer si pas déjà fait)
--
-- Remplacer PROJECT_REF et ANON_KEY par les vraies valeurs avant d'exécuter.
-- Les trouver dans : Supabase Dashboard → Project Settings → API
-- =============================================================

-- Supprimer le job s'il existe déjà (pour réexécuter la migration proprement)
SELECT cron.unschedule('daily-brief-rdv') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-brief-rdv'
);

-- Créer le job planifié : tous les jours à 6h30 UTC
-- = 7h30 heure de Paris en hiver, 8h30 en été
SELECT cron.schedule(
  'daily-brief-rdv',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://PROJECT_REF.supabase.co/functions/v1/send-daily-briefs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ANON_KEY',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
