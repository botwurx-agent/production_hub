-- Generalize review beyond asset versions: a review link or comment can target
-- a doc surface (shot_list | storyboard | moodboard) as well as a version.
alter table public.review_links
  add column if not exists target_type text,
  add column if not exists target_id uuid;

-- Doc links have no asset; allow it to be null.
alter table public.review_links
  alter column asset_id drop not null;

alter table public.review_comments
  add column if not exists target_type text,
  add column if not exists target_id uuid;

-- Doc comments have no version; allow it to be null.
alter table public.review_comments
  alter column version_id drop not null;

create index if not exists review_comments_target_idx
  on public.review_comments (target_type, target_id);
