-- Tasks grouped by the JOB'S OWN PHASE, and sub-steps inside a task.
--
-- The task list was a flat checklist, which is fine at eight items and a wall
-- at forty. The obvious fix is a board with To do / Doing / Done columns, and
-- that is the one thing not to build: those columns are a generic software
-- pattern the user has to invent meaning for, and section 4.1 says this app
-- maps to how commercial production actually works instead.
--
-- A production already has phases, and they are the same ones the lifecycle
-- stepper and the project board have used from the start, which is why this
-- reuses the project_status enum rather than inventing a parallel vocabulary.
-- Nullable, because a task genuinely may not belong to a phase ("chase the
-- insurance certificate"), and because every task that already exists has to
-- keep working with no backfill guessing at where it belongs.
--
-- Labels are NOT stored: stageLabel() in lib/project-types.ts renames the
-- middle phase per project type (Shoot on a live-action job, Generation on a
-- generated one), so a stored label would go stale the moment a project's type
-- changed.
alter table public.project_tasks
  add column phase public.project_status,
  -- Sub-steps, as jsonb rather than a child table, for the same reason
  -- call_sheets.layout and contact_profiles.wardrobe are jsonb: we never
  -- filter, sort or join on them, they are only ever read back with their
  -- parent, and a shape change should not cost a migration. parseChecklist in
  -- lib/tasks.ts is the trust boundary on the way out.
  add column checklist jsonb not null default '[]'::jsonb;

comment on column public.project_tasks.phase is
  'Which phase of the production this task belongs to. Null means it is not tied to one. Labels come from stageLabel(), never stored.';
comment on column public.project_tasks.checklist is
  'Sub-steps: [{id, text, done}]. Read through parseChecklist in lib/tasks.ts.';

-- The page groups by phase and orders within a group, and the hub counts open
-- work per project.
create index project_tasks_phase_idx on public.project_tasks (project_id, phase);
