-- Several people on one card.
--
-- `project_tasks.assignee_id` held exactly one, which is wrong for the way a
-- job actually splits: a shoot-day setup is the DP and the gaffer, a delivery is
-- the editor and the producer. One column forces a choice that misrepresents
-- who is on the hook.
--
-- The single column is DROPPED rather than kept alongside the table. Keeping it
-- as "the main one" would be a second source of truth for the same fact, which
-- is exactly what migration 0095 just removed for `done`. Everything that read
-- it (the card avatar, the Mine filter, the detail modal) reads the list now.
create table public.project_task_assignees (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  task_id uuid not null references public.project_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Assigning the same person twice is a mistake, not a use case, so a repeat
  -- write is a no-op rather than a duplicate avatar.
  unique (task_id, user_id)
);

alter table public.project_task_assignees enable row level security;

-- Exactly the parent's policy, reached through the task, which is the
-- parent-subquery shape migration 0056 used for every indirect table. It stays
-- FOR ALL because project_tasks is one of the four tables 0093 deliberately
-- kept reviewer-writable: a reviewer who can add a task can put a name on it.
create policy project_task_assignees_all on public.project_task_assignees
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

create index project_task_assignees_task_idx
  on public.project_task_assignees (task_id);
-- "What do I owe across every job" is the query this exists to make cheap.
create index project_task_assignees_user_idx
  on public.project_task_assignees (studio_id, user_id);

insert into public.project_task_assignees (studio_id, task_id, user_id)
select t.studio_id, t.id, t.assignee_id
from public.project_tasks t
where t.assignee_id is not null;

drop index if exists public.project_tasks_assignee_idx;
alter table public.project_tasks drop column assignee_id;
