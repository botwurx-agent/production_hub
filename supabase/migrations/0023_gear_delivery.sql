-- Production-ops slices 3-4: gear/crew checklist, deliverables, and billing.

create table public.gear_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  category text not null default 'Camera',
  name text not null default '',
  qty int not null default 1,
  confirmed boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gear_items_project_idx on public.gear_items (project_id, position);
alter table public.gear_items enable row level security;
create policy gear_items_all on public.gear_items
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  name text not null default '',
  spec text,
  due_date date,
  status text not null default 'pending', -- pending | in_progress | delivered
  link text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index deliverables_project_idx on public.deliverables (project_id, position);
alter table public.deliverables enable row level security;
create policy deliverables_all on public.deliverables
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.project_billing (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade unique,
  status text not null default 'not_invoiced', -- not_invoiced | invoiced | paid
  amount double precision,
  invoice_no text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.project_billing enable row level security;
create policy project_billing_all on public.project_billing
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
