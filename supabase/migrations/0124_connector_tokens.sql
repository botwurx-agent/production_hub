-- A private link that lets an AI assistant (Claude, ChatGPT) read the studio
-- through the MCP connector at /api/mcp/<token>. The link IS the credential, so
-- only its SHA-256 is stored; the plain token is shown once, when it is made.
-- One row per link, owned by the person who made it: a link reads exactly what
-- that person can read (the connector runs as them, under RLS), so a link
-- belongs to its maker the way a notebook does, and nobody else sees or
-- revokes it. Same shape as notification_reads (migration 0073).
create table public.connector_tokens (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_last4 text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.connector_tokens enable row level security;
create policy connector_tokens_own on public.connector_tokens for all
  using (user_id = auth.uid() and public.is_studio_member(studio_id))
  with check (user_id = auth.uid() and public.is_studio_member(studio_id));
create index connector_tokens_user_idx on public.connector_tokens(user_id, studio_id);

comment on table public.connector_tokens is 'Private links for the read-only AI connector (/api/mcp/<token>). Only the hash is stored. Looked up through the service role by hash.';
