-- Richer project contacts: a category (crew | talent | extras | client) used to
-- organize the roster into folders, a day rate, and free-form notes. The
-- specific position (Director, Gaffer, Food Stylist, ...) stays in role.
alter table public.contacts
  add column if not exists type text,
  add column if not exists rate numeric,
  add column if not exists notes text;
