-- Deliverables become the job's final home: the files that actually shipped,
-- and one no-login link the client downloads them from.
--
-- delivery_files: a final file on the project, optionally filed against one
-- of its deliverables. Not an `assets` row on purpose: the asset library is
-- the working library (every reference, every cut, any status), and a final
-- master sitting next to forty references is the confusion this page exists
-- to end. The 0093 split: anyone on the job reads (the editor who cut it may
-- be a collaborator), editors write.
create table public.delivery_files (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  mime_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index delivery_files_project_idx on public.delivery_files (project_id, created_at);
alter table public.delivery_files enable row level security;
create policy delivery_files_read on public.delivery_files for select
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy delivery_files_write on public.delivery_files for all
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));

-- delivery_links: one per project. Sending the finals to the client is the
-- studio's act, so is_studio_member only; the public page reads it through
-- the service role, gated by token, like client_portals.
create table public.delivery_links (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  token text not null unique,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.delivery_links enable row level security;
create policy delivery_links_member on public.delivery_links for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
comment on table public.delivery_links is 'One no-login link per project where the client downloads the final deliverables. Read publicly through the service role, gated by token.';
