-- Actual spend as a ledger rather than a typed number.
-- A budget_line holds the estimate; project_costs holds the real invoices that
-- roll up into its actual, so the page can answer "why are we over" and not
-- just "we are over".
create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Nullable: a cost can land before anyone decides which line it belongs to.
  budget_line_id uuid references public.budget_lines(id) on delete set null,
  -- Free text so a one-off vendor needs no roster entry; contact_id links it to
  -- the project roster when there is a match (and gives us their day rate).
  vendor text not null default '',
  contact_id uuid references public.contacts(id) on delete set null,
  description text not null default '',
  amount numeric(12,2) not null default 0,
  invoice_number text,
  invoice_date date,
  due_date date,
  -- received: it arrived. approved: producer okayed it. paid: money is gone.
  status text not null default 'received',
  storage_path text,
  file_name text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_costs_status_check
    check (status in ('received', 'approved', 'paid'))
);

create index if not exists project_costs_project_idx
  on public.project_costs(project_id);
create index if not exists project_costs_budget_line_idx
  on public.project_costs(budget_line_id);

alter table public.project_costs enable row level security;

-- DELIBERATELY is_studio_member ONLY, not "or can_access_project" like the
-- other project-scoped tables. A project collaborator (a DP, an AD, a PA) can
-- reach this project, and must not be able to see what the other crew charged.
-- Do not "fix" this to match its neighbours.
drop policy if exists project_costs_all on public.project_costs;
create policy project_costs_all on public.project_costs
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
