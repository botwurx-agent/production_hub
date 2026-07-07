-- Per-project calendar dates a producer tracks (pre-pro milestones, casting,
-- scouts, review calls, shoot days, wrap, delivery). Stands on its own (manual
-- entry); the project's own shoot_date / due_date are shown alongside these.
create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  date date not null,
  end_date date,
  kind text not null default 'other',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.project_events enable row level security;
create policy project_events_all on public.project_events
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index if not exists project_events_project_idx
  on public.project_events (project_id, date);
