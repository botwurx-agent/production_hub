-- Puts a doc surface (shot list / storyboard / moodboard) into the internal
-- review cycle so it shows on the project's Review page alongside assets. The
-- pipeline status mirrors asset_status (in_review | needs_changes | approved).
-- Internal comments reuse review_comments (author_id set, target_type/target_id);
-- internal sign-off reuses approvals (target_type=kind, target_id, reviewer_user_id);
-- the external client decision still lives in approvals via a review_link_id.
create table if not exists public.doc_reviews (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  status text not null default 'in_review',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id)
);

alter table public.doc_reviews enable row level security;
create policy doc_reviews_all on public.doc_reviews
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index if not exists doc_reviews_project_idx
  on public.doc_reviews (project_id);
