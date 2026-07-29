-- Money columns move OUT of collaborator-readable tables, so RLS enforces the
-- boundary instead of application code.
--
-- Postgres RLS is ROW-level: it cannot mask one column of a row the viewer is
-- allowed to read, and column privileges are per-ROLE, so they cannot help
-- either (a studio member and a project collaborator are both `authenticated`).
-- Until now three columns were therefore protected by stripping them in the
-- page component and dropping them in the write path. That works, but it has to
-- be remembered for every new read site, and a fourth column was missed exactly
-- that way.
--
-- Putting each value in its own is_studio_member table makes the leak
-- structurally impossible: a collaborator's query simply returns no rows.

-- 1. Crew day rates.
create table if not exists public.contact_rates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  contact_id uuid not null unique references public.contacts(id) on delete cascade,
  rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contact_rates enable row level security;
drop policy if exists contact_rates_all on public.contact_rates;
create policy contact_rates_all on public.contact_rates
  for all using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

insert into public.contact_rates (studio_id, contact_id, rate)
select studio_id, id, rate from public.contacts where rate is not null
on conflict (contact_id) do nothing;

-- 2. What the client is charged per deliverable. `qty` stays put: a count of
-- deliverables is not sensitive on its own, only the money is.
create table if not exists public.deliverable_pricing (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  deliverable_id uuid not null unique references public.deliverables(id) on delete cascade,
  rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deliverable_pricing enable row level security;
drop policy if exists deliverable_pricing_all on public.deliverable_pricing;
create policy deliverable_pricing_all on public.deliverable_pricing
  for all using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

insert into public.deliverable_pricing (studio_id, deliverable_id, rate)
select studio_id, id, rate from public.deliverables where rate is not null
on conflict (deliverable_id) do nothing;

-- 3. What each AI generation cost to make.
create table if not exists public.generation_costs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  generation_id uuid not null unique references public.ai_generations(id) on delete cascade,
  cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.generation_costs enable row level security;
drop policy if exists generation_costs_all on public.generation_costs;
create policy generation_costs_all on public.generation_costs
  for all using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

insert into public.generation_costs (studio_id, generation_id, cost)
select studio_id, id, cost from public.ai_generations where cost is not null
on conflict (generation_id) do nothing;

-- The old columns are DROPPED, not retired. Leaving them would leave the leak
-- open, which is the entire point of this migration: a collaborator can still
-- select a column that exists on a row they are allowed to read.
alter table public.contacts drop column if exists rate;
alter table public.deliverables drop column if exists rate;
alter table public.ai_generations drop column if exists cost;
