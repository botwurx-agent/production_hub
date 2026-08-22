-- A project person is now either an EDITOR or a REVIEWER.
--
-- Migration 0056 opened 41 project-scoped policies to `is_studio_member OR
-- can_access_project(...)`, all of them FOR ALL. That made project access
-- binary: anyone on a project could change anything on it. Real productions
-- need the middle tier every review tool has, where a director or a client-side
-- producer can see the job and leave notes without being able to edit the shot
-- list.
--
-- WHAT COUNTS AS READ-ONLY IS THE STRING 'reviewer', AND NOTHING ELSE. Every
-- existing row says 'collaborator', so treating anything-but-reviewer as an
-- editor means no current member loses access the moment this lands. That is
-- deliberately fail-OPEN on an unrecognised role, which is the right direction
-- here: the restrictive tier is one somebody has to choose on purpose, and the
-- alternative would silently demote everyone already using the app.

create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and public.is_studio_member(p.studio_id)
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and coalesce(pm.role, '') <> 'reviewer'
  );
$function$;

comment on function public.can_edit_project(uuid) is
  'Can this caller CHANGE things on the project: a studio member, or a project member whose role is not reviewer. can_access_project stays the read gate.';

-- Rewrites every project-scoped policy in place rather than transcribing 41 of
-- them by hand, which is the kind of list where one missed table is a silent
-- hole. For each:
--
--   * the existing FOR ALL policy keeps its shape but swaps can_access_project
--     for can_edit_project, so it now governs writes only in practice;
--   * a new FOR SELECT policy carries the ORIGINAL expression, so reading is
--     still open to anyone on the project.
--
-- Policies are permissive and OR together, so SELECT ends up as
-- (can_edit OR can_access) which is just can_access, and INSERT/UPDATE/DELETE
-- are left with can_edit alone. Adding a read policy rather than splitting into
-- four is what keeps this reversible: drop the *_read policies and put
-- can_access_project back and the database is exactly where it started.
--
-- THE FOUR TABLES LEFT ALONE are what a reviewer exists to do. Without write
-- access to these, "view and comment" is just "view":
--   review_comments  leaving a note
--   approvals        approving or requesting changes
--   doc_reviews      approving moves this row's status, so the write comes with it
--   project_tasks    a reviewer raising a task, matching how review tools behave
do $do$
declare
  r record;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and (qual like '%can_access_project%' or with_check like '%can_access_project%')
      and tablename not in (
        'review_comments', 'approvals', 'doc_reviews', 'project_tasks'
      )
  loop
    execute format(
      'alter policy %I on public.%I using (%s) with check (%s)',
      r.policyname,
      r.tablename,
      replace(r.qual, 'can_access_project', 'can_edit_project'),
      replace(coalesce(r.with_check, r.qual), 'can_access_project', 'can_edit_project')
    );

    execute format('drop policy if exists %I on public.%I', r.policyname || '_read', r.tablename);
    execute format(
      'create policy %I on public.%I for select using (%s)',
      r.policyname || '_read',
      r.tablename,
      r.qual
    );
  end loop;
end
$do$;

-- Kept as free text to match project_members.role, which already holds
-- 'collaborator'. A check constraint would have to enumerate that legacy value
-- forever, and the only string with any meaning is 'reviewer'.
comment on column public.project_members.role is
  'reviewer = read plus comment and approve. Anything else (including the legacy ''collaborator'') = editor. See can_edit_project.';
comment on column public.project_invites.role is
  'Carried onto project_members when the invite is claimed. reviewer or editor.';
