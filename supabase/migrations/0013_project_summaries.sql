-- ============================================================================
-- Phase 4 (AI layer), slice 1: store the latest AI "where does this project
-- stand" summary per project. One row per project (regenerating replaces it).
-- Content is generated from project state (brief, assets, approvals, activity)
-- via the Claude API. Studio-scoped RLS like the rest of the spine.
-- ============================================================================

create table public.project_summaries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  content text not null,
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id)
);
create index project_summaries_studio_idx on public.project_summaries (studio_id);

alter table public.project_summaries enable row level security;

create policy project_summaries_all on public.project_summaries
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
