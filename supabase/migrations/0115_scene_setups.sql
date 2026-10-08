-- Scene builder: the 3D previz (set, talent, lights, cameras, moves) moved off
-- the /dev prototype and onto a project, where a setup is saved for everyone
-- on the job instead of in one browser's localStorage.
--
-- ONE ROW PER SETUP, THE WHOLE SCENE AS jsonb. A setup is only ever read and
-- written whole by the builder, never filtered, summed or joined on, and its
-- shape (components/previz/setup.ts, versioned by its own `v`) moves often
-- while the feature is young. Same call as call_sheets.layout and
-- project_tasks.checklist: a shape change should not cost a migration.
--
-- Product photos and imported models are NOT in here: the scene holds their
-- keys, and the bytes stay in the browser that added them (IndexedDB) for this
-- first slice.
--
-- RLS is the project-scoped split from 0093: crew on the job can read it (a DP
-- is exactly who wants the lighting plan), editing needs can_edit_project.

create table public.scene_setups (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default 'Untitled setup',
  data jsonb not null,
  position double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scene_setups_project_idx on public.scene_setups (project_id, position);

alter table public.scene_setups enable row level security;
create policy scene_setups_read on public.scene_setups
  for select to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy scene_setups_write on public.scene_setups
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));
