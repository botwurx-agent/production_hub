-- 0051: Milanote-style connection lines between board items. A connection links
-- two board_items (from -> to) on the same board; deleting either endpoint (or
-- the board) removes the connection.
create table if not exists public.board_connections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  from_item_id uuid not null references public.board_items(id) on delete cascade,
  to_item_id uuid not null references public.board_items(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists board_connections_board_idx on public.board_connections(board_id);

alter table public.board_connections enable row level security;
create policy board_connections_all on public.board_connections
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
