-- 0056: Project-level access (collaborators).
--
-- Adds a second, narrower access tier: a "project collaborator" is granted
-- access to specific project(s) only, and is NOT a studio member. Studio-wide
-- data (clients, deals, CRM, communication, money, boards-general) stays
-- invisible to them automatically, because those tables remain gated by
-- is_studio_member and a collaborator has no membership row.
--
-- This migration is INERT for existing users: every policy gains an OR branch
-- for project_members, but there are zero project_members rows yet, so studio
-- members keep seeing exactly what they see today.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'collaborator',
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);
create index project_members_project_idx on public.project_members (project_id);

alter table public.project_members enable row level security;
-- Staff (studio members) manage grants; a collaborator may read their own grant
-- so the app can resolve which project(s) they belong to.
create policy project_members_staff on public.project_members for all to authenticated
  using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));
create policy project_members_self_read on public.project_members for select to authenticated
  using (user_id = auth.uid());

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role text not null default 'collaborator',
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index project_invites_project_idx on public.project_invites (project_id);
create index project_invites_email_idx on public.project_invites (lower(email));

alter table public.project_invites enable row level security;
create policy project_invites_staff on public.project_invites for all to authenticated
  using (is_studio_member(studio_id)) with check (is_studio_member(studio_id));

-- ---------------------------------------------------------------------------
-- 2. Access helpers (security definer: read projects/members bypassing RLS so
--    they can be used inside the projects policy without recursion).
-- ---------------------------------------------------------------------------
create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and public.is_studio_member(p.studio_id)
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  );
$$;

-- Resolve an approval / doc-review target (polymorphic) to its project.
create or replace function public.review_target_project(p_type text, p_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case p_type
    when 'asset'      then (select project_id from public.assets   where id = p_id)
    when 'version'    then (select a.project_id from public.versions v join public.assets a on a.id = v.asset_id where v.id = p_id)
    when 'shot_list'  then p_id
    when 'storyboard' then (select project_id from public.boards   where id = p_id)
    when 'moodboard'  then (select project_id from public.boards   where id = p_id)
    when 'ai_shot'    then (select project_id from public.ai_shots where id = p_id)
    else null
  end;
$$;

-- A review_comment is either a version comment (version_id set) or a doc comment
-- (target_type/target_id set).
create or replace function public.review_comment_project(p_version_id uuid, p_type text, p_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.project_id from public.versions v join public.assets a on a.id = v.asset_id where v.id = p_version_id),
    public.review_target_project(p_type, p_id)
  );
$$;

grant execute on function public.can_access_project(uuid) to authenticated, anon;
grant execute on function public.review_target_project(text, uuid) to authenticated, anon;
grant execute on function public.review_comment_project(uuid, text, uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Open project-scoped tables to collaborators.
--    Pattern: is_studio_member(studio_id) OR can_access_project(<project>).
--    Roles preserved from the existing policies.
-- ---------------------------------------------------------------------------

-- projects (by id)
drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(id))
  with check (is_studio_member(studio_id) or can_access_project(id));

-- Direct project_id, role authenticated
drop policy if exists briefs_all on public.briefs;
create policy briefs_all on public.briefs for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists assets_all on public.assets;
create policy assets_all on public.assets for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists activity_all on public.activity;
create policy activity_all on public.activity for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists project_summaries_all on public.project_summaries;
create policy project_summaries_all on public.project_summaries for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists review_links_all on public.review_links;
create policy review_links_all on public.review_links for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists shot_groups_all on public.shot_groups;
create policy shot_groups_all on public.shot_groups for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists shot_boards_all on public.shot_boards;
create policy shot_boards_all on public.shot_boards for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists shots_all on public.shots;
create policy shots_all on public.shots for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists call_sheets_all on public.call_sheets;
create policy call_sheets_all on public.call_sheets for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists boards_all on public.boards;
create policy boards_all on public.boards for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists gear_items_all on public.gear_items;
create policy gear_items_all on public.gear_items for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists deliverables_all on public.deliverables;
create policy deliverables_all on public.deliverables for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists ai_scripts_all on public.ai_scripts;
create policy ai_scripts_all on public.ai_scripts for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists ai_shots_all on public.ai_shots;
create policy ai_shots_all on public.ai_shots for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

-- contacts: only project-roster rows (project_id set) open up; client/lead
-- contacts have project_id null and stay studio-only via the OR self-scoping.
drop policy if exists contacts_all on public.contacts;
create policy contacts_all on public.contacts for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

-- Direct project_id, role public (preserved)
drop policy if exists doc_reviews_all on public.doc_reviews;
create policy doc_reviews_all on public.doc_reviews for all to public
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

drop policy if exists project_events_all on public.project_events;
create policy project_events_all on public.project_events for all to public
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));

-- Indirect via a parent row, role authenticated
drop policy if exists versions_all on public.versions;
create policy versions_all on public.versions for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select a.project_id from public.assets a where a.id = versions.asset_id)))
  with check (is_studio_member(studio_id) or can_access_project((select a.project_id from public.assets a where a.id = versions.asset_id)));

drop policy if exists brief_attachments_all on public.brief_attachments;
create policy brief_attachments_all on public.brief_attachments for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.briefs b where b.id = brief_attachments.brief_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.briefs b where b.id = brief_attachments.brief_id)));

drop policy if exists shot_cards_all on public.shot_cards;
create policy shot_cards_all on public.shot_cards for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select g.project_id from public.shot_groups g where g.id = shot_cards.group_id)))
  with check (is_studio_member(studio_id) or can_access_project((select g.project_id from public.shot_groups g where g.id = shot_cards.group_id)));

drop policy if exists call_sheet_entries_all on public.call_sheet_entries;
create policy call_sheet_entries_all on public.call_sheet_entries for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select c.project_id from public.call_sheets c where c.id = call_sheet_entries.call_sheet_id)))
  with check (is_studio_member(studio_id) or can_access_project((select c.project_id from public.call_sheets c where c.id = call_sheet_entries.call_sheet_id)));

drop policy if exists board_items_all on public.board_items;
create policy board_items_all on public.board_items for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_items.board_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_items.board_id)));

drop policy if exists board_connections_all on public.board_connections;
create policy board_connections_all on public.board_connections for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_connections.board_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_connections.board_id)));

drop policy if exists ai_generations_all on public.ai_generations;
create policy ai_generations_all on public.ai_generations for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_generations.shot_id)))
  with check (is_studio_member(studio_id) or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_generations.shot_id)));

drop policy if exists ai_prompts_all on public.ai_prompts;
create policy ai_prompts_all on public.ai_prompts for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_prompts.shot_id)))
  with check (is_studio_member(studio_id) or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_prompts.shot_id)));

drop policy if exists shot_board_flavors_all on public.shot_board_flavors;
create policy shot_board_flavors_all on public.shot_board_flavors for all to authenticated
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = shot_board_flavors.board_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = shot_board_flavors.board_id)));

-- Indirect via a parent row, role public (preserved)
drop policy if exists call_sheet_recipients_all on public.call_sheet_recipients;
create policy call_sheet_recipients_all on public.call_sheet_recipients for all to public
  using (is_studio_member(studio_id) or can_access_project((select c.project_id from public.call_sheets c where c.id = call_sheet_recipients.call_sheet_id)))
  with check (is_studio_member(studio_id) or can_access_project((select c.project_id from public.call_sheets c where c.id = call_sheet_recipients.call_sheet_id)));

drop policy if exists board_shares_rw on public.board_shares;
create policy board_shares_rw on public.board_shares for all to public
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_shares.board_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = board_shares.board_id)));

drop policy if exists storyboard_frames_all on public.storyboard_frames;
create policy storyboard_frames_all on public.storyboard_frames for all to public
  using (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = storyboard_frames.board_id)))
  with check (is_studio_member(studio_id) or can_access_project((select b.project_id from public.boards b where b.id = storyboard_frames.board_id)));

-- Polymorphic targets
drop policy if exists approvals_all on public.approvals;
create policy approvals_all on public.approvals for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(review_target_project(target_type::text, target_id)))
  with check (is_studio_member(studio_id) or can_access_project(review_target_project(target_type::text, target_id)));

drop policy if exists review_comments_all on public.review_comments;
create policy review_comments_all on public.review_comments for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(review_comment_project(version_id, target_type, target_id)))
  with check (is_studio_member(studio_id) or can_access_project(review_comment_project(version_id, target_type, target_id)));
