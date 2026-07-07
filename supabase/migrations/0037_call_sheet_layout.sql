-- Block-builder call sheet: `layout` is an ordered array of block descriptors
-- (fixed blocks map to the structured columns; custom text blocks carry their
-- own title/body). `accent` is a per-sheet accent color for the document.
alter table public.call_sheets
  add column if not exists layout jsonb,
  add column if not exists accent text;
