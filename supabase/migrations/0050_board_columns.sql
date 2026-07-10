-- 0050: Milanote-style columns (stacks) on boards. A column is a board_items
-- row (kind='column') that contains other items. A contained item points at its
-- column via parent_id and orders within it via sort. Top-level items keep
-- parent_id = null and stay absolutely positioned; column children flow inside
-- the column. Deleting a column cascades to its children.
alter table public.board_items
  add column if not exists parent_id uuid references public.board_items(id) on delete cascade,
  add column if not exists sort integer not null default 0;
create index if not exists board_items_parent_idx on public.board_items(parent_id);
