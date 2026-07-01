-- ============================================================================
-- Phase 6 (pulled forward): connections. Gmail connector, slice 1a.
-- Stores a user's connected Google account + OAuth tokens. Tokens are private
-- to the connecting user (RLS: user_id = auth.uid()). This is the founder's
-- own account for now; before multi-user, move token reads to a service-role
-- server client and encrypt at rest (see docs).
-- ============================================================================

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google',
  email text not null,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email)
);
create index email_accounts_studio_idx on public.email_accounts (studio_id);
create index email_accounts_user_idx on public.email_accounts (user_id);

alter table public.email_accounts enable row level security;

-- Only the connecting user can see or manage their own connection + tokens.
create policy email_accounts_all on public.email_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_studio_member(studio_id));

create trigger email_accounts_set_updated_at before update on public.email_accounts
  for each row execute function public.set_updated_at();
