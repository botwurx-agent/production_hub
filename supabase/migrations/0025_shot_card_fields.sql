-- Shot list rows gain the industry-standard columns plus an optional link to a
-- project asset for the shot image.
alter table shot_cards
  add column if not exists shot_size text,
  add column if not exists shot_type text,
  add column if not exists movement text,
  add column if not exists asset_id uuid references assets(id) on delete set null;
