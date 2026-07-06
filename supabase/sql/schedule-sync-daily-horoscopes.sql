create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace <CRON_SECRET> before running this SQL. Do not commit the real value.

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'sync-daily-horoscopes-every-day'
  ) then
    perform cron.unschedule('sync-daily-horoscopes-every-day');
  end if;
end $$;

select cron.schedule(
  'sync-daily-horoscopes-every-day',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://rochielgxaypmyjboirs.supabase.co/functions/v1/sync-daily-horoscopes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
