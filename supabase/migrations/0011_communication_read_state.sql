-- ============================================================================
-- Communication read-state: track when each linked conversation was last
-- opened in the Hub. The Communication badge counts incoming messages that
-- arrived after this timestamp (new since you last looked here), and clears
-- when you open the conversation in the Hub.
--
-- Existing rows are baselined to now() so the badge starts from a clean slate
-- rather than surfacing the entire back-history on first load. New links
-- default to now() (the link moment is the initial read baseline).
-- ============================================================================

alter table public.email_threads
  add column if not exists last_read_at timestamptz not null default now();

alter table public.slack_channels
  add column if not exists last_read_at timestamptz not null default now();
