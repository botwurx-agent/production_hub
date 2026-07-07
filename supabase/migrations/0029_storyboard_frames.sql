-- Structured storyboard frames. A storyboard container is a boards row
-- (kind='storyboard', project-scoped); its ordered frames live here, each with
-- an image + description + sound + notes (the step before the shot list).
create table if not exists public.storyboard_frames (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  position int not null default 0,
  scene text,
  description text,
  sound text,
  notes text,
  storage_path text,
  mime_type text,
  image_name text,
  asset_id uuid references public.assets(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.storyboard_frames enable row level security;
create policy storyboard_frames_all on public.storyboard_frames
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index if not exists storyboard_frames_board_idx
  on public.storyboard_frames (board_id, position);
