-- Frame.io-parity review: threaded replies + drawn annotations.
-- parent_id makes a comment a reply to another comment (one level; a reply
-- carries no anchor of its own, it inherits the parent's moment).
-- drawing holds normalized strokes ({w,h,strokes:[{color,size,points:[[x,y]..]}]})
-- drawn over the paused frame, replayed when the comment is selected.
alter table public.review_comments
  add column if not exists parent_id uuid
    references public.review_comments(id) on delete cascade,
  add column if not exists drawing jsonb;

create index if not exists review_comments_parent_id_idx
  on public.review_comments(parent_id);
