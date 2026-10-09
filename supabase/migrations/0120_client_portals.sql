-- One no-login link per project that lists every review link already shared
-- with the client and what is waiting on them. It holds no content of its
-- own: the items are the project's live review_links, so nothing appears in
-- the portal that was not already shared one by one. Read publicly through
-- the service role, gated by token, like /r and /bd.
create table public.client_portals (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  token text not null unique,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.client_portals enable row level security;
create policy client_portals_member on public.client_portals for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
comment on table public.client_portals is 'One no-login link per project that lists every review link already shared with the client. Read publicly through the service role, gated by token.';
