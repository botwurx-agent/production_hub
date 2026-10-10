-- A no-login link a repeat client uses to request new work, and what they
-- send through it. One link per client (account), so a brand keeps one stable
-- address for every job they ask for. A request becomes a DEAL at the inbound
-- stage, with the brief, deadline, budget and files kept on its own row so the
-- deal page can show exactly what the client wrote.
-- Both tables are is_studio_member only. The public page reads and writes them
-- through the service role, gated by token, like /portal and /r.
create table public.request_links (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  token text not null unique,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.request_links enable row level security;
create policy request_links_member on public.request_links for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create table public.job_requests (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  request_link_id uuid references public.request_links(id) on delete set null,
  title text not null,
  details text,
  needed_by date,
  budget numeric(12,2),
  contact_name text not null,
  contact_email text not null,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.job_requests enable row level security;
create policy job_requests_member on public.job_requests for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
create index job_requests_deal_idx on public.job_requests(deal_id);
create index job_requests_client_idx on public.job_requests(client_id, created_at desc);

comment on table public.request_links is 'One no-login link per client for requesting new work. Read publicly through the service role, gated by token.';
comment on table public.job_requests is 'What a client sent through their request link. Each one becomes an inbound deal.';
