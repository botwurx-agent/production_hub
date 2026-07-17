-- Review-round due dates + reminder tracking on the client review link.
-- Set when a review is emailed with a "respond by" date; the client portal shows
-- it, and a daily cron reminds overdue, unresolved reviews.
alter table public.review_links
  add column if not exists due_date date,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_count integer not null default 0;
