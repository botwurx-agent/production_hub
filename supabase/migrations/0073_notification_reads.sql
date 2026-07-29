-- Read state belongs to a PERSON, not to the studio.
-- notifications.read_at was a single shared flag, so whoever opened the bell
-- first cleared it for everyone and a notification meant for the producer could
-- be marked read by a colleague who only glanced at it. A notification is still
-- a studio-wide broadcast; only "have I seen this" is per-user.
create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  -- One mark per person per notification, so marking read twice is a no-op
  -- rather than a duplicate row.
  unique (notification_id, user_id)
);

create index if not exists notification_reads_user_idx
  on public.notification_reads(user_id, notification_id);

alter table public.notification_reads enable row level security;

-- Deliberately NOT is_studio_member: a read mark is personal, so you can only
-- ever see or write your own. Membership is still required to create one, so a
-- user cannot mark notifications in a studio they have left.
drop policy if exists notification_reads_own on public.notification_reads;
create policy notification_reads_own on public.notification_reads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_studio_member(studio_id));

-- Backfill: anything already marked read is treated as read by every current
-- member of that studio. Without this, every historic notification would come
-- back unread and the bell would look alarming on first load after deploy.
insert into public.notification_reads (studio_id, notification_id, user_id, read_at)
select n.studio_id, n.id, m.user_id, n.read_at
from public.notifications n
join public.memberships m on m.studio_id = n.studio_id
where n.read_at is not null
on conflict (notification_id, user_id) do nothing;

comment on column public.notifications.read_at is
  'RETIRED. Read state is per-user in notification_reads; this column is no longer written or read. Kept for rollback of migration 0073.';
