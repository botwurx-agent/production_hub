-- Handing the picked takes to the editor who assembles the cut.
--
-- Deliberately NOT a review_link. A review link exists to collect a decision,
-- and carries due dates, reminders and approvals; a handoff collects nothing.
-- Reusing it would have put handoffs in front of the overdue-review cron and
-- made "awaiting response" mean two different things.
--
-- LIVE by design (operator's call): the page always serves the current picks
-- rather than a frozen snapshot, so re-generating a shot updates what the
-- editor pulls. The page states when the sequence last changed, since an editor
-- who downloaded yesterday has no other way to know.
create table if not exists public.editor_handoffs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- 192 bits, same as the billing document links.
  token text not null unique,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);

create index if not exists editor_handoffs_project_idx
  on public.editor_handoffs (project_id);

alter table public.editor_handoffs enable row level security;

-- Studio members only. A project collaborator is crew on the job and has no
-- business minting a link that hands the whole cut to an outsider.
create policy editor_handoffs_all on public.editor_handoffs
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

comment on table public.editor_handoffs is
  'A no-login link that serves a project''s picked takes in order, for the editor assembling the cut. Read via the service role, gated by token.';
