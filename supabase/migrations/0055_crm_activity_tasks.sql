-- 0055: CRM Phase 2 — relationship activity timeline + tasks/reminders.
--
-- Both hang off the Account (clients) and Deal objects from 0054. An activity
-- or task always carries account_id (derived from the deal when logged on a
-- deal), so an account's timeline/tasks roll up all of its deals' entries while
-- a deal's timeline shows just its own.

-- ---------------------------------------------------------------------------
-- Activity timeline: notes, calls, meetings, emails (manual) + system events
-- (stage changes, created, won, lost).
-- ---------------------------------------------------------------------------
create type crm_activity_kind as enum (
  'note', 'call', 'meeting', 'email',
  'stage_change', 'created', 'won', 'lost'
);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  account_id uuid references public.clients (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  kind crm_activity_kind not null default 'note',
  body text,
  author_id uuid references auth.users (id) on delete set null,
  -- when it actually happened (a logged call may be backdated); system events
  -- use now()
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.crm_activities enable row level security;
create policy crm_activities_all on public.crm_activities
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index crm_activities_account_idx on public.crm_activities (account_id, occurred_at desc);
create index crm_activities_deal_idx on public.crm_activities (deal_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Tasks / reminders: a follow-up with a due date and an assignee.
-- ---------------------------------------------------------------------------
create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  account_id uuid references public.clients (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_tasks enable row level security;
create policy crm_tasks_all on public.crm_tasks
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index crm_tasks_account_idx on public.crm_tasks (account_id);
create index crm_tasks_deal_idx on public.crm_tasks (deal_id);
create index crm_tasks_open_idx on public.crm_tasks (studio_id, done, due_date);
