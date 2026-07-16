-- Per-project task checklist. Project-scoped, so it follows the collaborator
-- access model (studio members OR project collaborators), unlike crm_tasks
-- which is studio-member-only.
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_tasks enable row level security;
create policy project_tasks_all on public.project_tasks
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_access_project(project_id));

create index project_tasks_project_idx on public.project_tasks (project_id);
create index project_tasks_open_idx on public.project_tasks (studio_id, done, due_date);
create index project_tasks_assignee_idx on public.project_tasks (assignee_id);
