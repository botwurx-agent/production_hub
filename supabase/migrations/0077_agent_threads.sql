-- The assistant's conversation history.
--
-- Two tables rather than one column of JSON because a turn is not a single
-- message: an assistant turn that calls two tools produces one assistant row
-- and two tool rows, and the model has to be handed them back in that order on
-- the next turn or it loses the thread of what it already looked up.
--
-- RLS here is deliberately NOT is_studio_member. A conversation is personal:
-- it carries what one person asked, in their words, including half-formed
-- questions about money and people. A colleague in the same studio has no more
-- business reading it than they have reading someone's notebook. Membership is
-- still required to CREATE one (the with check), so a user cannot open a thread
-- in a studio they have left. Same shape as notification_reads in 0073.

create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The first thing asked, kept so a thread list reads as something other than
  -- a column of timestamps.
  title text,
  -- Which project was selected when the thread started. Nullable because the
  -- assistant is studio-wide by default, and set null on delete so deleting a
  -- project does not take the conversation about it with it.
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_threads_user_idx
  on public.agent_threads(user_id, updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- user | assistant | tool. Plain text rather than an enum: this mirrors a
  -- provider message shape that is not ours to fix if it gains a role.
  role text not null,
  content text not null default '',
  -- assistant rows: the tool calls that turn made, so the next turn can replay
  -- them. tool rows: null.
  tool_calls jsonb,
  -- tool rows: which call this is the result of, and which tool ran.
  call_id text,
  tool_name text,
  -- assistant rows: the action cards proposed on that turn, stored so a
  -- reloaded thread still shows what was put up for confirmation and whether
  -- it was acted on.
  cards jsonb,
  -- Ordering within a thread. created_at is not enough: two rows written in the
  -- same millisecond (an assistant turn and its first tool result) would sort
  -- arbitrarily and the conversation would be replayed out of order.
  seq bigint generated always as identity,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_thread_idx
  on public.agent_messages(thread_id, seq);

alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;

drop policy if exists agent_threads_own on public.agent_threads;
create policy agent_threads_own on public.agent_threads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_studio_member(studio_id));

drop policy if exists agent_messages_own on public.agent_messages;
create policy agent_messages_own on public.agent_messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_studio_member(studio_id));
