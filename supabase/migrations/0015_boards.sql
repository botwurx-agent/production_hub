-- ============================================================================
-- Boards: freeform visual canvases (moodboards / storyboards). Studio-scoped,
-- optionally linked to a project. Items are positioned freely (x/y/w/h/z) and
-- are images (stored in the assets bucket) or text notes.
-- ============================================================================

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  position int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_studio_idx on public.boards (studio_id, position);

alter table public.boards enable row level security;
create policy boards_all on public.boards
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  kind text not null default 'image', -- 'image' | 'note'
  name text,
  mime_type text,
  storage_path text,
  url text,
  text text,
  hue text,
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 260,
  h double precision not null default 200,
  z int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index board_items_board_idx on public.board_items (board_id);

alter table public.board_items enable row level security;
create policy board_items_all on public.board_items
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
