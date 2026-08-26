-- The shape a storyboard's frames are drawn in.
--
-- Every frame grid in the app was hardcoded to a landscape box with
-- object-cover, so a board whose artwork is a different shape had most of the
-- picture cropped away on screen. Found on a real director's board: portrait
-- 4:5 frames rendered into a 16:10 box, which showed a horizontal strip
-- through the middle of each panel and threw away half the drawing.
--
-- ON THE BOARD, not on the frame, because a storyboard is internally
-- consistent: a director draws one job in one shape. Making it per-frame
-- would produce a ragged grid and ask a question nobody has an answer to,
-- frame by frame. An odd frame is still safe, since the frames now render
-- with object-contain and letterbox rather than crop.
--
-- Nullable, and null means the app's default. There is nothing to backfill
-- with: we never recorded the dimensions of an existing frame, and guessing
-- one board's shape from another's would be worse than the default.
alter table public.boards
  add column if not exists frame_aspect text;

comment on column public.boards.frame_aspect is
  'Storyboard frame shape, e.g. 16:9 or 4:5. Null uses the app default. Set by detection at import, overridable in the editor. Unused for moodboards.';
