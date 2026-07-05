-- Production budget: line items with estimated (bid) vs actual amounts,
-- grouped by category. Studio-scoped via RLS.
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  category text not null default 'General',
  description text not null default '',
  estimated double precision not null default 0,
  actual double precision not null default 0,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index budget_lines_project_idx on public.budget_lines (project_id, position);
alter table public.budget_lines enable row level security;
create policy budget_lines_all on public.budget_lines
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
