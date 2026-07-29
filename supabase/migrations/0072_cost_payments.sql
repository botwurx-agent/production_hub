-- A cost is a COMMITMENT; payments are the events against it.
-- Vendors routinely ask for a deposit up front and the balance on delivery, so
-- one cost row paid once could not express a real engagement. Same shape as
-- assets -> versions and budget_lines -> project_costs: the parent holds the
-- figure, the children hold what actually happened.
create table if not exists public.cost_payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  cost_id uuid not null references public.project_costs(id) on delete cascade,
  -- Free text so a schedule reads the way the vendor wrote it
  -- ("Deposit 25%", "Balance on delivery").
  label text not null default '',
  amount numeric(12,2) not null default 0,
  due_date date,
  -- Null means SCHEDULED (owed but not yet sent); set means the money is gone.
  -- One nullable timestamp rather than a status enum, because a payment only
  -- has two honest states and a date is what you actually want to record.
  paid_at timestamptz,
  method text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cost_payments_cost_idx
  on public.cost_payments(cost_id);
-- Drives the "what is due next" lookups on the dashboard.
create index if not exists cost_payments_due_idx
  on public.cost_payments(studio_id, paid_at, due_date);

alter table public.cost_payments enable row level security;

-- is_studio_member ONLY, matching project_costs. A project collaborator must
-- not see what the studio owes its vendors. Do not widen this to
-- can_access_project to match the other project-scoped tables.
drop policy if exists cost_payments_all on public.cost_payments;
create policy cost_payments_all on public.cost_payments
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
