-- ============================================================================
-- Gmail connector slice 1b/1c: link Gmail threads to projects.
-- We store the link (project <-> gmail thread) and fetch message content live
-- from Gmail on view. Imported attachments become assets (source='gmail',
-- provenance in external_ref), reusing the connection-ready fields.
-- ============================================================================

create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  account_id uuid not null references public.email_accounts (id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  last_message_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, gmail_thread_id)
);
create index email_threads_studio_idx on public.email_threads (studio_id);
create index email_threads_project_idx on public.email_threads (project_id, last_message_at desc);

alter table public.email_threads enable row level security;

create policy email_threads_all on public.email_threads
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
