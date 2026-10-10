-- Transcripts of a video or audio version (Timeliner item #7).
-- One row per version: the timed lines as jsonb, because they are only ever
-- read and written whole. Anyone on the job reads (the editor, the client
-- through the portal via the service role); editors write.
create table public.version_transcripts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_id uuid not null unique references public.versions(id) on delete cascade,
  segments jsonb not null default '[]'::jsonb,
  language text,
  duration numeric(8,2),
  model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index version_transcripts_project_idx on public.version_transcripts(project_id);
alter table public.version_transcripts enable row level security;
create policy version_transcripts_read on public.version_transcripts
  for select using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy version_transcripts_write on public.version_transcripts
  for all using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));
