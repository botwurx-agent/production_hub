-- ============================================================================
-- Google Chat connector: link a Chat space to a lead, client, or project.
-- Rides on the existing Google account (email_accounts, provider='google').
-- Message content is fetched live from the Chat API on view. Mirrors
-- slack_channels, including the read-state column for the Communication badge.
-- ============================================================================

create table public.chat_spaces (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  account_id uuid not null references public.email_accounts (id) on delete cascade,
  space_name text not null,
  space_display_name text,
  last_read_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chat_spaces_one_owner check (
    (project_id is not null)::int
    + (lead_id is not null)::int
    + (client_id is not null)::int = 1
  )
);
create index chat_spaces_studio_idx on public.chat_spaces (studio_id);
create index chat_spaces_project_idx on public.chat_spaces (project_id);
create index chat_spaces_lead_idx on public.chat_spaces (lead_id);
create index chat_spaces_client_idx on public.chat_spaces (client_id);
create unique index chat_spaces_project_uq on public.chat_spaces (project_id, space_name) where project_id is not null;
create unique index chat_spaces_lead_uq on public.chat_spaces (lead_id, space_name) where lead_id is not null;
create unique index chat_spaces_client_uq on public.chat_spaces (client_id, space_name) where client_id is not null;

alter table public.chat_spaces enable row level security;

create policy chat_spaces_all on public.chat_spaces
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
