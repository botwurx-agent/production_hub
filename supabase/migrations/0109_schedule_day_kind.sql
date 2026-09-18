-- 0109_schedule_day_kind
--
-- A schedule day was a NUMBER and nothing else, so a real job could not say
-- what one of its days is. The operator hit it on a live shoot with a prelight
-- day and two shoot days: the prelight became "Day 1" and the shoot days
-- became Day 2 and Day 3, which is not what anybody on that crew calls them,
-- and syncShotDaysForProject stamped shot_cards.day from day_number, so every
-- shot on the first shoot day was written as "2".
--
-- `kind` names what the day IS. `day_number` is untouched and stays the ORDER
-- key (unique per project, what the cascade and the renumber run on), because
-- the two are different questions: where a day sits, and what it is for.
--
-- THE DISPLAY NUMBER IS DERIVED, NEVER STORED (lib/schedule-days.ts). Only
-- shoot days are numbered, and they are numbered among themselves, so
-- inserting or deleting a prelight day cannot leave a stale figure behind.
-- Same call the schedule already makes for its times and the task board makes
-- for its phase labels.
--
-- `label` is the free-text name for a day whose kind does not name it well
-- enough (a fitting, a scout, a strike). Null on a shoot day, where the number
-- is the name.

alter table public.schedule_days
  add column if not exists kind text not null default 'shoot'
    check (kind in ('shoot', 'prelight', 'travel', 'move', 'wrap', 'other')),
  add column if not exists label text;

comment on column public.schedule_days.kind is
  'What the day is. Only ''shoot'' days carry a number, derived in lib/schedule-days.ts; day_number remains the order key for every kind.';
comment on column public.schedule_days.label is
  'Optional name for a non-shoot day (a fitting, a scout, a strike). A shoot day is named by its derived number.';
