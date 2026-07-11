-- Public read-only share links for a whole board (Milanote-style). A board can
-- have one active share token; the public page loads it via the service role.
create table public.board_shares (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  token text not null unique,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (board_id)
);
create index board_shares_board_id_idx on public.board_shares(board_id);
alter table public.board_shares enable row level security;
create policy board_shares_rw on public.board_shares
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
