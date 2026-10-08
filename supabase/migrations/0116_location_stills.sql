-- Location stills: frames taken through the phone viewfinder on a scout or on
-- set, each carrying the camera, lens and aspect it was framed for, plus the
-- tilt and roll the phone's motion sensor read at the moment it was taken.
--
-- A TABLE OF ITS OWN, NOT AN assets ROW. The asset library is the job's
-- creative work and what goes to review; a scout frame is reference for the
-- people planning the shoot, and filing forty of them next to the pack shot
-- would bury both (operator, 2026-10-08). Same reasoning that kept task files
-- and contact files out of assets.
--
-- The lens facts are COLUMNS rather than jsonb because they are what a still
-- is for: the list prints them on every tile, and "Build a scene" sets the
-- scene builder's camera from them.
--
-- RLS is the project-scoped split from 0093, like scene_setups: crew on the
-- job read them (the DP who took them may well be a collaborator), editing
-- needs can_edit_project.

create table public.location_stills (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  width integer,
  height integer,
  body_id text not null,
  focal_mm double precision not null,
  aspect_id text not null,
  tilt_deg double precision,
  roll_deg double precision,
  phone_camera text,
  note text,
  scene_setup_id uuid references public.scene_setups (id) on delete set null,
  taken_by uuid references auth.users (id) on delete set null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index location_stills_project_idx on public.location_stills (project_id, taken_at desc);

alter table public.location_stills enable row level security;
create policy location_stills_read on public.location_stills
  for select to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy location_stills_write on public.location_stills
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));
