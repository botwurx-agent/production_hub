-- The client project binder: everything about a job in one shareable place.
--
-- Stores only the CHOICES, never a copy of the content. The sections are
-- resolved from live project data when the binder is opened, the same call as
-- the editor handoff: a client who opens the link next week sees the current
-- call sheet rather than the one that existed when the link was sent.
--
-- A consequence worth stating: a section is opt-in and stays opt-in. Anything
-- added to the project after the binder was built is NOT in it until somebody
-- ticks it, because a binder is shared outside the studio and silently adding
-- to it is how the wrong thing reaches a client.
create table if not exists project_binders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text,
  -- 192-bit, same shape as every other share token in the app.
  token text not null unique,
  -- [{ key, include, hideNotes }] in display order. Keys name a section and,
  -- where there can be several, its target: "call_sheet:<uuid>".
  sections jsonb not null default '[]'::jsonb,
  -- Sharing is deliberate: a binder exists in the app before it has ever been
  -- shareable, so a half-built one cannot be opened by a link that leaked.
  shared_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_binders_project_idx
  on project_binders (project_id);

alter table project_binders enable row level security;

-- is_studio_member only, NOT the `or can_access_project` the project-scoped
-- tables carry. A binder names what a client may see; deciding that is the
-- studio's business, not visiting crew's.
drop policy if exists project_binders_member on project_binders;
create policy project_binders_member on project_binders
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
