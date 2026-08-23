-- Tasks become a board you drag cards across.
--
-- 0094 gave a task a PHASE of the production. That answers "which part of the
-- job is this", and it is the wrong axis to drag on: moving a task from Pre-pro
-- to Post is a recategorisation, not progress, and it is rare. Progress is the
-- motion people actually want from a board, so it gets its own column.
--
-- The four values are not To do / Doing / Done with a coat of paint. WAITING is
-- the production-specific one and the reason this is worth having: on a real
-- job an enormous share of tasks are not blocked by us, they are sitting with a
-- client, an agency, a vendor or a location owner. A board that cannot say that
-- pushes all of it into "in progress" and lies about where the job is.
--
-- Text with a check constraint rather than a new enum, matching project_costs
-- and gear: the set is small, we read it back through a narrowing helper
-- (taskStatus in lib/tasks.ts) anyway, and adding a value later should not need
-- an ALTER TYPE that cannot run in the same transaction as its use.
alter table public.project_tasks add column status text not null default 'todo';

update public.project_tasks set status = case when done then 'done' else 'todo' end;

alter table public.project_tasks add constraint project_tasks_status_check
  check (status in ('todo', 'doing', 'waiting', 'done'));

-- `done` becomes DERIVED rather than a second thing to keep in step.
--
-- Every existing reader (the project hub's counts, the dashboard, Runner's
-- read tools, lib/outstanding) selects `done`, and a generated column reads
-- exactly like the plain one it replaces, so none of them change. The point is
-- that it can no longer DRIFT: there is no code path that can mark a task done
-- without moving it to the Done column, or leave it in Done while unticked.
-- Dropping the column takes its index with it, so that is rebuilt below.
drop index if exists public.project_tasks_open_idx;
alter table public.project_tasks drop column done;
alter table public.project_tasks
  add column done boolean generated always as (status = 'done') stored;
create index project_tasks_open_idx on public.project_tasks (studio_id, done, due_date);

-- Where a card sits inside its column. A float, so a drop between two
-- neighbours is their midpoint and only the dragged row is written, rather than
-- renumbering the column on every move.
alter table public.project_tasks add column sort double precision not null default 0;

comment on column public.project_tasks.status is
  'Board column: todo | doing | waiting | done. `done` is generated from it.';
comment on column public.project_tasks.sort is
  'Position within a board column. Midpoint insertion, so a drop writes one row.';

create index project_tasks_board_idx on public.project_tasks (project_id, status, sort);
