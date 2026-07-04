-- ============================================================================
-- Shot Board: a presentation-grade shot list. A board header (cover) per
-- project, a flavor palette, Shots (groups), and sub-shot cards with images.
-- Replaces the flat shot list as the shot-planning surface.
-- ============================================================================

create table public.shot_boards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade unique,
  title text,
  subtitle text,
  client text,
  agency text,
  production_co text,
  director text,
  dp text,
  location text,
  deliverables text,
  job_no text,
  rev_date text,
  shoot_days text,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.shot_boards enable row level security;
create policy shot_boards_all on public.shot_boards
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.shot_board_flavors (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  board_id uuid not null references public.shot_boards (id) on delete cascade,
  position int not null default 0,
  name text not null default '',
  hue text not null default 'green',
  created_at timestamptz not null default now()
);
create index shot_board_flavors_idx on public.shot_board_flavors (board_id, position);
alter table public.shot_board_flavors enable row level security;
create policy shot_board_flavors_all on public.shot_board_flavors
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.shot_groups (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  title text not null default '',
  subtitle text,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shot_groups_project_idx on public.shot_groups (project_id, position);
alter table public.shot_groups enable row level security;
create policy shot_groups_all on public.shot_groups
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.shot_cards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  group_id uuid not null references public.shot_groups (id) on delete cascade,
  position int not null default 0,
  code text,
  day text,
  flavor_name text,
  flavor_hue text,
  storage_path text,
  mime_type text,
  image_name text,
  description text,
  vo text,
  tags jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shot_cards_group_idx on public.shot_cards (group_id, position);
alter table public.shot_cards enable row level security;
create policy shot_cards_all on public.shot_cards
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
