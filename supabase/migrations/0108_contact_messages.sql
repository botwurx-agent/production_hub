-- Messages from the marketing site's contact page.
--
-- WHY A TABLE AT ALL, when the page also emails the operator: the email is
-- BEST EFFORT, exactly like the invite emails. Resend can be down, the API key
-- can be missing in a new environment, and a send can silently fail. A person
-- writing to a company they are evaluating gets one shot at it, so the message
-- is written here FIRST and the email is a notification on top. Nothing is
-- lost if mail is broken.
--
-- The submitter is ANONYMOUS (no account, no session), so there is no auth.uid()
-- to gate on and RLS cannot express "this person may write one row". The row is
-- therefore written by the SERVICE role from the server action, which has
-- already applied the honeypot, the timing check and the rate limit. This is
-- the same shape as the public review portal.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  -- Why they are writing, from a fixed set on the form. Free text in the
  -- column so a new option on the page never needs a migration.
  topic text,
  message text not null,
  -- Whether the notification email actually went out, so a message that only
  -- exists here can be found later. Null means it was never sent.
  emailed_at timestamptz,
  -- For the operator to mark a message dealt with, once there is a view for it.
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

-- RLS ON WITH NO POLICIES AT ALL, deliberately. Anon and authenticated both get
-- nothing: no read, no write. Every access goes through the service role in
-- trusted server code. A policy here would be a way in for the whole internet,
-- since this is the one table an anonymous stranger causes rows in.
alter table public.contact_messages enable row level security;

-- DELIBERATELY NOT STORED: the sender's IP address. It is only used in memory
-- for rate limiting and never persisted, so this table holds nothing the person
-- did not deliberately type into the form. That keeps the privacy policy's
-- claims true without a new disclosure.
