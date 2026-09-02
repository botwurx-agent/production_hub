-- A call sheet row can point back at the roster entry it came from.
--
-- Producers type the crew into the project roster first (name, position, phone,
-- email, organized into folders), and then typed all of it again into the call
-- sheet, because nothing connected the two. This is the link that lets a sheet
-- be filled from the roster instead.
--
-- NULLABLE, and it stays that way: a call sheet row that somebody typed by hand
-- is completely legitimate (a last-minute replacement, a driver who is never
-- going in the roster), and must not be second-class.
--
-- ON DELETE SET NULL, deliberately not CASCADE. Removing somebody from the
-- project roster must never silently delete them from a call sheet that has
-- already been sent to the unit. The row stays exactly as printed and simply
-- stops being linked.
--
-- Same move migration 0091 made for call_sheet_recipients.contact_id, and for
-- the same reason: matching people by name is wrong in both directions (two
-- people share a name, one person is typed two ways).

alter table public.call_sheet_entries
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

comment on column public.call_sheet_entries.contact_id is
  'The roster contact this row was filled from, when it was. NULL for a hand-typed row, which is normal.';

create index if not exists call_sheet_entries_contact_idx
  on public.call_sheet_entries (call_sheet_id, contact_id)
  where contact_id is not null;
