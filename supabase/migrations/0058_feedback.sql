-- In-app beta feedback. Any signed-in user (studio member or project
-- collaborator) can submit; submissions are read by the operator via the
-- dashboard (service role), so there is intentionally no SELECT policy.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  message text not null,
  page text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- A signed-in user may insert their own feedback row.
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);
