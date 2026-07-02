-- ============================================================================
-- Slack connector slice 1b/1c: link a Slack conversation to a lead, client, or
-- project. Message content is fetched live from Slack on view; imported files
-- become assets (project only). Mirrors email_threads.
-- ============================================================================

create table public.slack_channels (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  account_id uuid not null references public.email_accounts (id) on delete cascade,
  slack_channel_id text not null,
  channel_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint slack_channels_one_owner check (
    (project_id is not null)::int
    + (lead_id is not null)::int
    + (client_id is not null)::int = 1
  )
);
create index slack_channels_studio_idx on public.slack_channels (studio_id);
create index slack_channels_project_idx on public.slack_channels (project_id);
create index slack_channels_lead_idx on public.slack_channels (lead_id);
create index slack_channels_client_idx on public.slack_channels (client_id);
create unique index slack_channels_project_uq on public.slack_channels (project_id, slack_channel_id) where project_id is not null;
create unique index slack_channels_lead_uq on public.slack_channels (lead_id, slack_channel_id) where lead_id is not null;
create unique index slack_channels_client_uq on public.slack_channels (client_id, slack_channel_id) where client_id is not null;

alter table public.slack_channels enable row level security;

create policy slack_channels_all on public.slack_channels
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
