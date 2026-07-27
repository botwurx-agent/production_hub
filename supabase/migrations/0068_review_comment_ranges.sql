-- Range comments: a note about a STRETCH of the cut ("this whole section drags")
-- rather than a single frame. timecode stays the in-point (so every existing
-- point comment is unchanged and markers/sorting keep working); timecode_end is
-- the out-point, null for a point comment.
alter table public.review_comments
  add column if not exists timecode_end double precision;
