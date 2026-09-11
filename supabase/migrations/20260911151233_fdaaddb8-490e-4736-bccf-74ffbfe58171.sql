-- lovable-cron-fallback-reviewed: 96 runs/day; proximity nudges must fire while the user is still inside the store, so an hourly check would arrive too late
select cron.schedule(
  'freshtrack-supermarket-nudge',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://project--956ae285-71ba-4e60-ac4f-8c5ef5cd0ab4.lovable.app/api/public/hooks/supermarket-nudge',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);