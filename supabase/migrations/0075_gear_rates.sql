-- Day rate for a gear or crew line on the Gear & crew page.
-- NOT a column on gear_items: that table is open to project collaborators
-- (can_access_project), and migration 0074 moved every other money column off
-- those tables for exactly this reason. Same shape as contact_rates.
create table if not exists public.gear_rates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  gear_item_id uuid not null unique references public.gear_items(id) on delete cascade,
  rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gear_rates enable row level security;

drop policy if exists gear_rates_all on public.gear_rates;
create policy gear_rates_all on public.gear_rates
  for all using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
