-- Soft-archive for projects: a delivered/wrapped job can be tucked out of the
-- active list without deleting its data. Null = active; timestamp = archived.
alter table public.projects add column if not exists archived_at timestamptz;
