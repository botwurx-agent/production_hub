-- Frame.io-style pinned comments: a comment can carry a numbered pin at an
-- (x, y) position on the asset (percent coords), and can be resolved.
alter table review_comments
  add column if not exists pin_number int,
  add column if not exists pos_x real,
  add column if not exists pos_y real,
  add column if not exists resolved_at timestamptz;
