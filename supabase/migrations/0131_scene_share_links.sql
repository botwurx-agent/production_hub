-- Scene builder: share one setup by link, with no account needed to open it.
--
-- A producer sends a setup to a DP or gaffer to try a lighting idea on. The
-- link is the credential (like /portal and /r), read publicly through the
-- service role, and it carries what the guest may do:
--   view  look and play, nothing is saved
--   copy  their changes are saved as THEIR OWN setup on the project (a "take")
--   edit  their changes are saved onto the shared setup itself
--
-- One link per setup. Turning it off and on again issues a new token, so an
-- old address stays dead.
--
-- Both tables are is_studio_member only: a link is the studio's to make and
-- revoke, and a take records a guest's email, which crew on the job have no
-- reason to read. The take's SCENE is an ordinary scene_setups row, so it
-- shows as a tab for everyone on the project.

create table public.scene_share_links (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_setup_id uuid not null unique references public.scene_setups (id) on delete cascade,
  token text not null unique,
  mode text not null default 'copy' check (mode in ('view', 'copy', 'edit')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz
);

alter table public.scene_share_links enable row level security;
create policy scene_share_links_all on public.scene_share_links
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- Who saved through a link. guest_key is the random per-browser id the review
-- portal already uses (the sf_rk cookie): it is what lets the same guest keep
-- saving to the same take without an account. scene_setup_id is the setup
-- their saves go to: their own copy, or the shared setup on an edit link.
create table public.scene_share_takes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  link_id uuid not null references public.scene_share_links (id) on delete cascade,
  scene_setup_id uuid not null references public.scene_setups (id) on delete cascade,
  guest_key text not null,
  guest_name text not null,
  guest_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, guest_key)
);

create index scene_share_takes_setup_idx on public.scene_share_takes (scene_setup_id);

alter table public.scene_share_takes enable row level security;
create policy scene_share_takes_all on public.scene_share_takes
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
