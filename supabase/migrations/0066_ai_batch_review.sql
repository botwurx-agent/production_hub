-- Shareable batch review ("send options for review" / shareable triage): curate
-- a subset of a shot's candidates into a set, share a no-login /rb/<token> link,
-- and let a reviewer (creative director, client) play each, COMMENT (timecoded),
-- STAR (shortlist), and mark ONE as their PICK. Non-destructive: the reviewer's
-- input lives in its own tables and never touches ai_generations status/role;
-- the producer stays the decider and sees the feedback back on the shot.
--
-- studio_id is denormalized onto every child table so RLS is a direct
-- is_studio_member() check; the public /rb route reads/writes via the service
-- role (token-gated), bypassing RLS.

create table if not exists public.ai_batch_reviews (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  shot_id uuid references public.ai_shots(id) on delete set null,
  title text not null default '',
  token text not null unique,
  created_by uuid,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_batch_review_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  batch_id uuid not null references public.ai_batch_reviews(id) on delete cascade,
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_batch_review_comments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  batch_id uuid not null references public.ai_batch_reviews(id) on delete cascade,
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  reviewer_name text not null default '',
  body text not null default '',
  timecode double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_batch_review_marks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  batch_id uuid not null references public.ai_batch_reviews(id) on delete cascade,
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  reviewer_name text not null default '',
  starred boolean not null default false,
  is_pick boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (batch_id, generation_id, reviewer_name)
);

create index if not exists ai_batch_reviews_project_idx on public.ai_batch_reviews (project_id);
create index if not exists ai_batch_reviews_shot_idx on public.ai_batch_reviews (shot_id);
create index if not exists ai_batch_review_items_batch_idx on public.ai_batch_review_items (batch_id);
create index if not exists ai_batch_review_comments_batch_idx on public.ai_batch_review_comments (batch_id);
create index if not exists ai_batch_review_marks_batch_idx on public.ai_batch_review_marks (batch_id);

alter table public.ai_batch_reviews enable row level security;
alter table public.ai_batch_review_items enable row level security;
alter table public.ai_batch_review_comments enable row level security;
alter table public.ai_batch_review_marks enable row level security;

drop policy if exists ai_batch_reviews_rw on public.ai_batch_reviews;
create policy ai_batch_reviews_rw on public.ai_batch_reviews
  for all using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));

drop policy if exists ai_batch_review_items_rw on public.ai_batch_review_items;
create policy ai_batch_review_items_rw on public.ai_batch_review_items
  for all using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));

drop policy if exists ai_batch_review_comments_rw on public.ai_batch_review_comments;
create policy ai_batch_review_comments_rw on public.ai_batch_review_comments
  for all using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));

drop policy if exists ai_batch_review_marks_rw on public.ai_batch_review_marks;
create policy ai_batch_review_marks_rw on public.ai_batch_review_marks
  for all using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));
