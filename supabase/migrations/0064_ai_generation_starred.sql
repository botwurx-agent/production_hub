-- Shortlist flag for triage: while triaging a batch of candidates you reject the
-- bad ones and STAR the finalists, then compare the stars before tagging the
-- final Start/End (image) or Take (video). Star is orthogonal to status
-- (keep/reject) and role (the actual pick), so it gets its own column.

alter table public.ai_generations
  add column if not exists starred boolean not null default false;
