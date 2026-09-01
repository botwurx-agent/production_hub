-- Mentions, and the addressing layer they need.
--
-- THE PROBLEM THIS SOLVES, from a real pre-production week: the DP texted the
-- producer to say the prop stylist needs certain props in the foreground of
-- shot 1. Both of those people can already read and write comments on that
-- shot, but nothing in the app could carry a note from one to the other, so it
-- went by text message through the producer as a middleman.
--
-- Three things were missing, and this migration adds all three.
--
-- 1. A NOTIFICATION HAD NO ADDRESSEE. `notifications` is a studio-wide
--    broadcast (studio, project, type, title, body, link) with per-person read
--    state bolted on in 0073. There was no way to say "this one is for Amy".
--    `user_id` is that: NULL keeps meaning "the studio should know", so every
--    existing row and every existing writer is untouched.
--
-- 2. A CONTACT WAS NOT A USER. The project roster holds name, position, email
--    and phone for everyone on the job, and `project_members` holds the people
--    with logins, and nothing joined them. `contacts.user_id` is that join, and
--    it is nullable on purpose: most crew on a three-week job will never make
--    an account, and they should still be addressable. Whether a mention is
--    delivered to a bell or to an inbox is then a delivery detail rather than a
--    modelling one.
--
-- 3. NOTHING RECORDED WHO WAS MENTIONED. `comment_mentions` does.
--
-- WHY THE MENTION IS A ROW AND NOT MARKUP IN THE COMMENT BODY: the body stays
-- plain readable text ("@Amy Chen, we need the amber glass in the foreground"),
-- which means no renderer has to learn a token syntax and an old comment keeps
-- the name as it was written, which is right for a historical note. The rows
-- here are the machine-readable truth used to notify, and they are validated
-- server-side against the project's own roster.

-- 1. The addressee. ---------------------------------------------------------
alter table public.notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

comment on column public.notifications.user_id is
  'Who this is for. NULL = a studio-wide broadcast, which is what every notification was before 0102.';

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc)
  where user_id is not null;

-- Reads stay open to the studio and now also to the person a notification names,
-- which is the only way a project collaborator (who is not a studio member) can
-- ever receive one.
drop policy if exists notifications_all on public.notifications;

create policy notifications_select on public.notifications
  for select using (
    is_studio_member(studio_id) or user_id = auth.uid()
  );

-- WRITES ARE WIDER THAN READS HERE, deliberately. A mention is one person
-- creating a notification addressed to ANOTHER person, so "you may only insert
-- your own" would make the whole feature impossible. The bound is the project:
-- anyone with access to a project may raise a notification about that project,
-- and can_access_project(null) is false, so a studio-level notification still
-- requires membership.
create policy notifications_insert on public.notifications
  for insert with check (
    is_studio_member(studio_id)
    or (project_id is not null and can_access_project(project_id))
  );

create policy notifications_update on public.notifications
  for update using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

create policy notifications_delete on public.notifications
  for delete using (is_studio_member(studio_id));

-- Marking one read is personal, and a collaborator has no membership, so the
-- old `is_studio_member` check in WITH CHECK would have left them with a badge
-- they could never clear. The guard it was there for (you cannot mark in a
-- studio you have left) is preserved by accepting a notification that names you.
drop policy if exists notification_reads_own on public.notification_reads;

create policy notification_reads_own on public.notification_reads
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      is_studio_member(studio_id)
      or exists (
        select 1 from public.notifications n
        where n.id = notification_id and n.user_id = auth.uid()
      )
    )
  );

-- 2. A roster entry can point at an account. --------------------------------
alter table public.contacts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public.contacts.user_id is
  'The account this roster entry belongs to, when they have one. NULL is the normal case: most crew never sign up, and are reached by email instead.';

create index if not exists contacts_user_idx
  on public.contacts (user_id) where user_id is not null;

-- 3. Who was mentioned on a comment. ----------------------------------------
create table if not exists public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  comment_id uuid not null references public.review_comments(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- When the email actually went. NULL means it has not been sent, so a failed
  -- send is visible as a gap rather than being silently indistinguishable from
  -- a successful one.
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comment_id, contact_id)
);

create index if not exists comment_mentions_comment_idx
  on public.comment_mentions (comment_id);
create index if not exists comment_mentions_contact_idx
  on public.comment_mentions (contact_id, created_at desc);

alter table public.comment_mentions enable row level security;

-- Reachable by exactly whoever can reach the comment it hangs off, resolved
-- through review_comments' own polymorphic helper rather than re-deriving the
-- rule here. That keeps a mention as visible (and no more visible) than the
-- sentence it belongs to.
create policy comment_mentions_all on public.comment_mentions
  for all using (
    exists (
      select 1 from public.review_comments rc
      where rc.id = comment_id
        and (
          is_studio_member(rc.studio_id)
          or can_access_project(
               review_comment_project(rc.version_id, rc.target_type, rc.target_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.review_comments rc
      where rc.id = comment_id
        and (
          is_studio_member(rc.studio_id)
          or can_access_project(
               review_comment_project(rc.version_id, rc.target_type, rc.target_id))
        )
    )
  );
