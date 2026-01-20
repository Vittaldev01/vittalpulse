-- Habilitar extensões necessárias (se ainda não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Criar cron job para processar campanhas a cada 1 minuto
SELECT cron.schedule(
  'send-campaign-messages-job',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://psizqlhatnopgmwhjykd.supabase.co/functions/v1/send-campaign-messages',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Criar cron job para processar follow-ups a cada 1 minuto
SELECT cron.schedule(
  'process-follow-ups-job',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://psizqlhatnopgmwhjykd.supabase.co/functions/v1/process-follow-ups',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);