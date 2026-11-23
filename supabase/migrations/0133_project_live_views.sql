-- Live view: one Google Meet link per project, made from the project so the
-- client who cannot be on set joins a call that shows the camera. The call is
-- Google's; this row only remembers the link, the calendar event it came from
-- and whose Google account hosts it. Studio members only.
create table public.project_live_views (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  meet_url text not null,
  event_id text,
  host_email text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.project_live_views enable row level security;
create policy project_live_views_member on public.project_live_views for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
comment on table public.project_live_views is 'One Google Meet link per project for a remote client to watch the shoot. The call is hosted by Google on host_email''s account.';
