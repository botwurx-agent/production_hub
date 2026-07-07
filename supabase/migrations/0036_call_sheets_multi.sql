-- Multiple call sheets per project (like multiple shot lists). Drop the
-- one-per-project unique constraint and give each sheet a title, status, and
-- ordering. call_sheet_entries already reference call_sheet_id, so they scope
-- to the right sheet automatically.
alter table public.call_sheets drop constraint if exists call_sheets_project_id_key;

alter table public.call_sheets
  add column if not exists title text,
  add column if not exists status text not null default 'draft',
  add column if not exists position int not null default 0;
