-- ============================================================================
-- Phase 2: client-facing review links.
-- A studio member generates a per-asset review link (random token). A client
-- opens it with no login, previews the asset, comments, and approves or
-- requests changes. The public portal reads/writes via a server-side service
-- role client that validates the token and scopes every operation to the
-- link's asset, so no anon RLS access is granted here.
-- ============================================================================

create table public.review_links (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  token text not null unique,
  recipient text,
  revoked boolean not null default false,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index review_links_studio_idx on public.review_links (studio_id);
create index review_links_asset_idx on public.review_links (asset_id);

alter table public.review_links enable row level security;

-- Studio members manage their links. The public portal never uses this policy
-- (it goes through the service role), so no anon policy is defined.
create policy review_links_all on public.review_links
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- Client authorship on comments and sign-offs. author_id/reviewer_user_id stay
-- for internal (team) feedback; client feedback sets reviewer_name and ties the
-- row to the originating review link.
alter table public.review_comments
  add column reviewer_name text,
  add column review_link_id uuid references public.review_links (id) on delete set null;

alter table public.approvals
  add column reviewer_name text,
  add column review_link_id uuid references public.review_links (id) on delete set null;

-- One client sign-off per review link per version (the client updates their
-- decision rather than stacking rows).
create unique index approvals_version_link_uq
  on public.approvals (target_id, review_link_id)
  where target_type = 'version' and review_link_id is not null;
