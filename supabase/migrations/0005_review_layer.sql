-- ============================================================================
-- Phase 2: creative review layer (internal first).
-- Per-version comment threads plus team sign-off. Sign-off reuses the existing
-- approvals table (reviewer_user_id = internal team member; reviewer_contact_id
-- stays reserved for the client-facing review link in a later increment).
-- ============================================================================

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index review_comments_studio_idx on public.review_comments (studio_id);
create index review_comments_version_idx on public.review_comments (version_id, created_at);

alter table public.review_comments enable row level security;

create policy review_comments_all on public.review_comments
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- One internal sign-off per team member per version (keeps the sign-off list
-- clean; a member updates their decision rather than stacking rows).
create unique index approvals_version_user_uq
  on public.approvals (target_id, reviewer_user_id)
  where target_type = 'version' and reviewer_user_id is not null;
