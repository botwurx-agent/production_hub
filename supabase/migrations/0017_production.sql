-- ============================================================================
-- Phase 8 (production-ops), slice 1: shoot-day planning.
-- Shot list + call sheet per project. All studio-scoped via RLS.
-- ============================================================================

-- Shot list: an ordered list of planned shots for a project.
create table public.shots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  scene text,
  description text not null default '',
  setup text,
  notes text,
  status text not null default 'todo', -- 'todo' | 'done'
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shots_project_idx on public.shots (project_id, position);
alter table public.shots enable row level security;
create policy shots_all on public.shots
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- Call sheet: one per project (shoot-day header info).
create table public.call_sheets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade unique,
  shoot_date date,
  call_time text,
  location text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.call_sheets enable row level security;
create policy call_sheets_all on public.call_sheets
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- Call sheet people: crew/talent with individual call times.
create table public.call_sheet_entries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  call_sheet_id uuid not null references public.call_sheets (id) on delete cascade,
  position int not null default 0,
  name text not null default '',
  role text,
  call_time text,
  contact text,
  created_at timestamptz not null default now()
);
create index call_sheet_entries_idx on public.call_sheet_entries (call_sheet_id, position);
alter table public.call_sheet_entries enable row level security;
create policy call_sheet_entries_all on public.call_sheet_entries
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
