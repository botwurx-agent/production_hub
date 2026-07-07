-- Send a call sheet via a per-recipient shareable link and track engagement.
-- Each recipient gets a unique token; the public page records viewed_at on open
-- and confirmed_at when they tap Confirm. Studio members manage these (RLS);
-- the public page reads/writes via the service client, gated by the token.
create table if not exists public.call_sheet_recipients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  call_sheet_id uuid not null references public.call_sheets(id) on delete cascade,
  name text not null,
  email text,
  token text not null unique,
  viewed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.call_sheet_recipients enable row level security;
create policy call_sheet_recipients_all on public.call_sheet_recipients
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index if not exists call_sheet_recipients_sheet_idx
  on public.call_sheet_recipients (call_sheet_id);
