-- Which PAGE a pin sits on.
--
-- A pin has always been a position within one surface (pos_x, pos_y as a share
-- of the media box), which is all an image needs. A PDF is several surfaces, so
-- without this every pin on page four would replay on page one.
--
-- Nullable, and null means the surface has only one page: every existing pin on
-- an image, a storyboard or a moodboard is untouched and still correct.
alter table review_comments
  add column if not exists pin_page smallint;

comment on column review_comments.pin_page is
  'For a multi-page surface (a PDF), the 1-based page this pin sits on. Null on a single-surface review.';
