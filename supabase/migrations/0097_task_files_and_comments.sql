-- Files and conversation on a task card.
--
-- Both hang off project_tasks and both carry its RLS through the parent, the
-- same parent-subquery shape 0056 used for every indirect table and 0096 used
-- for assignees. FOR ALL, because project_tasks is one of the four tables 0093
-- kept reviewer-writable: someone reviewing a cut has to be able to write down
-- what they want changed, and attach the frame they mean.

-- WHY NOT `assets`: migration 0078 routed project DOCUMENTS into the asset
-- library precisely because a permit or a spec is superseded constantly and
-- needed version history. A file dropped on a task is the opposite: a reference
-- for the person doing the work, thrown away with the card. Routing these
-- through assets would mean every caller of loadProjectAssets learning to
-- exclude them, and a wardrobe snap appearing next to the pack shot.
create table public.project_task_files (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  task_id uuid not null references public.project_tasks (id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.project_task_files enable row level security;
create policy project_task_files_all on public.project_task_files
  for all to authenticated
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select t.project_id from public.project_tasks t where t.id = task_id)
    )
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select t.project_id from public.project_tasks t where t.id = task_id)
    )
  );

create index project_task_files_task_idx
  on public.project_task_files (task_id, created_at);

-- Comments are DELIBERATELY NOT review_comments. That table is built around a
-- position: a pin on a frame, a timecode in a cut, a page in a PDF, and it
-- carries drawings, reactions, threads and a public reviewer_key for the
-- no-login portal. A note on a task is a line of text and who wrote it.
-- Reusing it would mean six nullable columns that never apply and a table that
-- has to mean two things.
create table public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  task_id uuid not null references public.project_tasks (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.project_task_comments enable row level security;
create policy project_task_comments_all on public.project_task_comments
  for all to authenticated
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select t.project_id from public.project_tasks t where t.id = task_id)
    )
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select t.project_id from public.project_tasks t where t.id = task_id)
    )
  );

create index project_task_comments_task_idx
  on public.project_task_comments (task_id, created_at);

comment on table public.project_task_files is
  'References dropped on a task card. Not the asset library: these are working files, thrown away with the card.';
comment on table public.project_task_comments is
  'Plain notes on a task. Not review_comments, which are anchored to a position in a frame or a cut.';
