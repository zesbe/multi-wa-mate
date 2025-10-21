-- Enable extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to check scheduled broadcasts every minute
SELECT cron.schedule(
  'check-scheduled-broadcasts',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://ierdfxgeectqoekugyvb.supabase.co/functions/v1/process-scheduled-broadcasts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcmRmeGdlZWN0cW9la3VneXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0ODA2MTAsImV4cCI6MjA3NjA1NjYxMH0.L4FLuxGgsuMe_yY1OLOpGzNRsFObXbQzvSV4iukpa9o"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);