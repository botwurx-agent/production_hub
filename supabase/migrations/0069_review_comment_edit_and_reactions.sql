-- Edit / delete of a comment, and emoji reactions on it.
--
-- author_key identifies the BROWSER that posted from the public portal. A
-- review link has no login, so name alone cannot authorise an edit (anyone
-- with the link could type someone else's name). The key is a random id kept
-- in the visitor's localStorage and required to edit or delete, which is
-- strictly stronger than name matching while keeping the no-login flow.
alter table public.review_comments
  add column if not exists author_key text,
  add column if not exists edited_at timestamptz;

create table if not exists public.review_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  comment_id uuid not null references public.review_comments(id) on delete cascade,
  emoji text not null,
  author_id uuid references auth.users(id) on delete set null,
  reviewer_key text,
  reviewer_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists review_comment_reactions_unique
  on public.review_comment_reactions (
    comment_id,
    emoji,
    coalesce(author_id::text, reviewer_key, '')
  );

create index if not exists review_comment_reactions_comment_idx
  on public.review_comment_reactions(comment_id);

alter table public.review_comment_reactions enable row level security;

drop policy if exists review_comment_reactions_member on public.review_comment_reactions;
create policy review_comment_reactions_member
  on public.review_comment_reactions
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
