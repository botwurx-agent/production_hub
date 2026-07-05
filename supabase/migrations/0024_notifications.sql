-- In-app notifications. Studio-scoped; read state is studio-level for v1
-- (the first user is a solo operator). Generated for events that happen outside
-- the app and would otherwise slip (client review feedback), and surfaced in the
-- topbar bell.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_studio_idx on public.notifications (studio_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_all on public.notifications
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
