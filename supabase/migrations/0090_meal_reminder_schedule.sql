-- Drive the meal-reminder endpoint from the database.
--
-- Vercel's cron could not carry this. The account's plan caps cron entries, and
-- adding a third made Vercel refuse to CREATE DEPLOYMENTS AT ALL, with no
-- failed build and no error anywhere: pushes simply stopped producing
-- deployments while a dashboard redeploy of an older commit still worked. If a
-- push ever stops deploying, read vercel.json before anything else.
--
-- The endpoint is unchanged by this, so moving back to Vercel cron after a plan
-- upgrade is deleting the job below, not a rewrite.
--
-- IT POLLS, DELIBERATELY. Scheduling one exact job per meal round would fire
-- precisely and idle in between, but every edit would have to reschedule, every
-- delete cancel, and a job missed during a deploy would never run at all. For
-- email telling crew where to order lunch, fifteen minutes late beats silently
-- never. An idle tick is one query returning no rows, and everything the route
-- does is idempotent (`sent_at` is stamped after the batch, so an overlapping
-- run cannot send twice).
--
-- Fifteen minutes rather than thirty is about the SCHEDULED SEND, not the
-- chase: the chase has a 90 minute lead window and would survive a coarser
-- tick, but a producer who sets "send at 8:00" and sees it leave at 8:29 has
-- been let down.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The bearer token the route checks. Read from Vault at call time rather than
-- baked into the job definition, so it never appears in cron.job, in a query
-- plan, or in this file.
create or replace function public.run_meal_reminders()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'cron_secret';

  -- No secret configured means the call would be rejected anyway. Returning
  -- quietly is what keeps a half-finished setup from generating a failed
  -- request every quarter of an hour forever.
  if secret is null or secret = '' then
    return;
  end if;

  perform net.http_get(
    url := 'https://app.studio-flows.com/api/cron/meal-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    -- Under the route's own 60s maxDuration, so a slow batch is not cut off by
    -- the caller before the server has finished with it.
    timeout_milliseconds := 55000
  );
end;
$$;

-- Nobody reaches this from the API. pg_cron runs it as the job owner.
revoke all on function public.run_meal_reminders() from public, anon, authenticated;

comment on function public.run_meal_reminders() is
  'Calls the meal-reminder endpoint with the Vault-held cron secret. Scheduled by pg_cron every 15 minutes; safe to run by hand.';

-- Idempotent: unschedule first so re-running this file does not stack jobs.
select cron.unschedule('meal-reminders')
where exists (select 1 from cron.job where jobname = 'meal-reminders');

select cron.schedule(
  'meal-reminders',
  '*/15 * * * *',
  'select public.run_meal_reminders()'
);

-- TWO THINGS REMAIN, and neither is SQL:
--
-- 1. The secret. Run ONCE, with the same value as CRON_SECRET in Vercel:
--      select vault.create_secret('<the value>', 'cron_secret', 'Bearer token for the cron routes');
--    Until then the function returns without calling anything.
--
-- 2. The route has to exist in production. /api/cron/meal-reminders ships on
--    the branch that added crew meals; against main it currently 404s.
