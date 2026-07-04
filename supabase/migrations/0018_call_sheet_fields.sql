-- Expand call sheets toward an industry-standard layout.
alter table public.call_sheets
  add column production_title text,
  add column day_of text,
  add column crew_call text,
  add column shoot_call text,
  add column lunch text,
  add column wrap text,
  add column weather text,
  add column sunrise text,
  add column sunset text,
  add column parking text,
  add column hospital text;

-- Split call sheet people into cast vs crew.
alter table public.call_sheet_entries
  add column kind text not null default 'crew'; -- 'cast' | 'crew'
