-- The shooting schedule: the document every production level has, and the one
-- this app had no home for. The call sheet carried crew call, breakfast, lunch
-- and wrap as four masthead fields and nothing in between.
--
-- ITS OWN TABLES, NOT ROWS INSIDE call_sheets. An AD builds the schedule before
-- any call sheet exists and re-shuffles shots across days for a week; making
-- them create a call sheet first is backwards. The call sheet is a CONSUMER
-- (call_sheets.schedule_day_id, below), never the owner.
--
-- TIMES ARE NOT STORED, only durations and anchors. A row's start is derived:
-- the first row starts at the day's call, each row after starts when the one
-- before ends, and an ANCHORED row (lunch at 1:00 because catering is booked)
-- holds its time while the rows above absorb the difference. lib/schedule-time
-- .ts does that arithmetic and is the only place that does, so the editor, the
-- print view and the call sheet block cannot disagree about when lunch is.
--
-- THE SCHEDULE OWNS WHICH DAY A SHOT IS ON. schedule_row_shots is UNIQUE on
-- the shot, so a shot sits on exactly one row on exactly one day; dragging it
-- to another day is the fact, and shot_cards.day (free text since before this
-- existed) is written from it by the action rather than being a second
-- opinion.
--
-- People on a row are project CONTACTS, split talent/crew, because talent is
-- the first column talent looks for and crew is a list. Contact ids rather
-- than names so per-person call times can be derived later without retyping.

create table public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  date date,
  -- Clock times as the producer typed them ("8:00", "1:00 pm"); parsed by
  -- lib/schedule-time parseHM, never compared as text.
  call_time text,
  wrap_target text,
  location text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, day_number)
);

create table public.schedule_rows (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  day_id uuid not null references public.schedule_days (id) on delete cascade,
  -- Float, midpoint insertion on drop, same as project_tasks.sort: one row is
  -- written per move rather than renumbering the day.
  position double precision not null default 0,
  kind text not null default 'shot'
    check (kind in ('call', 'meal', 'setup', 'shot', 'move', 'note', 'wrap')),
  title text not null default '',
  -- Where you drive to (a stage, an address), and where inside it.
  location text,
  set_name text,
  int_ext text check (int_ext in ('INT', 'EXT')),
  day_night text check (day_night in ('DAY', 'NIGHT')),
  duration_min integer not null default 30 check (duration_min >= 0),
  -- A fixed start the cascade may not move, as typed. Null flows.
  anchored_at text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_row_shots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  row_id uuid not null references public.schedule_rows (id) on delete cascade,
  shot_card_id uuid not null references public.shot_cards (id) on delete cascade,
  position integer not null default 0,
  -- A shot is on ONE row. This is the constraint that makes the schedule the
  -- owner of a shot's day.
  unique (shot_card_id)
);

create table public.schedule_row_people (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  row_id uuid not null references public.schedule_rows (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role text not null default 'crew' check (role in ('talent', 'crew')),
  unique (row_id, contact_id)
);

alter table public.call_sheets
  add column if not exists schedule_day_id uuid
    references public.schedule_days (id) on delete set null;

-- Defined AFTER the tables, because a `language sql` body is validated when the
-- function is created and these read tables that did not yet exist. The first
-- attempt at this migration failed on exactly that.
create or replace function public.schedule_day_project(p_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select project_id from public.schedule_days where id = p_day_id
$$;

create or replace function public.schedule_row_project(p_row_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.project_id
  from public.schedule_rows r
  join public.schedule_days d on d.id = r.day_id
  where r.id = p_row_id
$$;

-- SECURITY DEFINER, same reason as is_task_assignee in 0100: a policy on the
-- child that subqueries the parent would run the parent's policy inside the
-- child's, and the helper reads the parent directly instead. Revoked from
-- anon; a schedule is never public.
revoke all on function public.schedule_day_project(uuid) from public, anon;
revoke all on function public.schedule_row_project(uuid) from public, anon;
grant execute on function public.schedule_day_project(uuid) to authenticated;
grant execute on function public.schedule_row_project(uuid) to authenticated;

create index schedule_days_project_idx on public.schedule_days (project_id, day_number);
create index schedule_rows_day_idx on public.schedule_rows (day_id, position);
create index schedule_row_shots_row_idx on public.schedule_row_shots (row_id, position);
create index schedule_row_people_row_idx on public.schedule_row_people (row_id);
create index call_sheets_schedule_day_idx on public.call_sheets (schedule_day_id);

-- RLS, the 0093 shape: READ is is_studio_member OR can_access_project (a DP
-- or a stills photographer on the project must read the schedule; it is the
-- document they are on the project for), WRITE is is_studio_member OR
-- can_edit_project (a reviewer reads and does not rearrange the day).
-- Permissive policies OR together, so the _read policy opens SELECT and the
-- FOR ALL policy's narrower using() is what governs UPDATE and DELETE.

alter table public.schedule_days enable row level security;
create policy schedule_days_read on public.schedule_days
  for select to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy schedule_days_write on public.schedule_days
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));

alter table public.schedule_rows enable row level security;
create policy schedule_rows_read on public.schedule_rows
  for select to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_access_project(public.schedule_day_project(day_id)));
create policy schedule_rows_write on public.schedule_rows
  for all to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_day_project(day_id)))
  with check (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_day_project(day_id)));

alter table public.schedule_row_shots enable row level security;
create policy schedule_row_shots_read on public.schedule_row_shots
  for select to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_access_project(public.schedule_row_project(row_id)));
create policy schedule_row_shots_write on public.schedule_row_shots
  for all to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_row_project(row_id)))
  with check (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_row_project(row_id)));

alter table public.schedule_row_people enable row level security;
create policy schedule_row_people_read on public.schedule_row_people
  for select to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_access_project(public.schedule_row_project(row_id)));
create policy schedule_row_people_write on public.schedule_row_people
  for all to authenticated
  using (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_row_project(row_id)))
  with check (public.is_studio_member(studio_id)
    or public.can_edit_project(public.schedule_row_project(row_id)));

comment on table public.schedule_days is
  'One shoot day of a project schedule. Times are typed as text and parsed; rows hang off it.';
comment on table public.schedule_rows is
  'A strip on the schedule. Start times are DERIVED from durations and anchors by lib/schedule-time.ts, never stored.';
comment on table public.schedule_row_shots is
  'Which shot cards a row covers. UNIQUE on the shot: the schedule owns which day a shot is on.';
comment on table public.schedule_row_people is
  'Talent and crew on a row, as project contacts, so per-person call times can be derived later.';
comment on column public.call_sheets.schedule_day_id is
  'The schedule day this sheet is for. The call sheet consumes the schedule; it never owns it.';
