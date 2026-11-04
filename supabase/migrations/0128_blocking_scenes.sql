-- Shot blocking: animated 3D blockouts for AI video. A blocking scene is a
-- low-poly set, the things in it, and a camera, each with keyframes over a
-- timeline; the export is a clean colour-coded clip plus its first frame,
-- which go to Seedance as the motion reference and the start image.
--
-- Separate from scene_setups on purpose: the scene builder is a lighting and
-- lens previz tool for a live set, this is a motion tool for a generated shot,
-- and the two shapes have nothing to gain from sharing a row.
--
-- ONE ROW PER SCENE, the whole scene as jsonb (lib/blocking/scene.ts, versioned
-- by its own `v`), for the same reason as scene_setups: only ever read and
-- written whole. shot_id optionally ties it to the AI pipeline shot it blocks.
--
-- RLS is the project-scoped split from 0093: anyone on the job reads, editors
-- write.

create table public.blocking_scenes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  shot_id uuid references public.ai_shots (id) on delete set null,
  name text not null default 'Untitled blocking',
  data jsonb not null,
  position double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blocking_scenes_project_idx on public.blocking_scenes (project_id, position);

alter table public.blocking_scenes enable row level security;
create policy blocking_scenes_read on public.blocking_scenes
  for select to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy blocking_scenes_write on public.blocking_scenes
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));
