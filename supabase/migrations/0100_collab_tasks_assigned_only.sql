-- 0100: A project collaborator sees only tasks ASSIGNED to them.
--
-- The task board is where the producer keeps their own running to-do list for
-- the job, and 0056 made the whole of it readable by every collaborator (the
-- prop stylist could read the producer's personal reminders). The fix is
-- assignment-scoped visibility, which is also the shape a crew member wants
-- anyway: their view of Tasks becomes "my work on this job".
--
-- Studio members are untouched: they keep full FOR ALL access. For a
-- collaborator (or reviewer):
--   - SELECT only tasks they are assigned to;
--   - INSERT stays open (0093 deliberately kept project_tasks writable for
--     reviewers, so review feedback can be filed as a task) and the app now
--     auto-assigns a collaborator to any task they create, so it does not
--     vanish from their own view;
--   - UPDATE / DELETE only on tasks they are assigned to;
--   - assignee rows: they read the roster of their own tasks, and may only
--     ever add or remove THEMSELVES (the picker is read-only for them in the
--     UI);
--   - files and comments follow the task they hang off.
--
-- RECURSION NOTE, the reason for the two helpers: the tasks policy checks the
-- assignees table, and the assignees policy checks the tasks table. Written as
-- plain subqueries those two policies would recurse into each other at query
-- time. Both helpers are SECURITY DEFINER (like is_studio_member and
-- can_access_project) so the lookup bypasses RLS and the cycle never forms.

create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_task_assignees a
    where a.task_id = p_task_id and a.user_id = auth.uid()
  );
$$;

create or replace function public.task_project(p_task_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.project_tasks where id = p_task_id;
$$;

grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.task_project(uuid) to authenticated;

-- ---------------------------------------------------------------- tasks ----
drop policy if exists project_tasks_all on public.project_tasks;

create policy project_tasks_member_all on public.project_tasks
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

create policy project_tasks_collab_select on public.project_tasks
  for select to authenticated
  using (can_access_project(project_id) and is_task_assignee(id));

create policy project_tasks_collab_insert on public.project_tasks
  for insert to authenticated
  with check (can_access_project(project_id));

create policy project_tasks_collab_update on public.project_tasks
  for update to authenticated
  using (can_access_project(project_id) and is_task_assignee(id))
  with check (can_access_project(project_id));

create policy project_tasks_collab_delete on public.project_tasks
  for delete to authenticated
  using (can_access_project(project_id) and is_task_assignee(id));

-- ------------------------------------------------------------ assignees ----
drop policy if exists project_task_assignees_all on public.project_task_assignees;

create policy project_task_assignees_member_all on public.project_task_assignees
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

-- On a task they are on, a collaborator sees the whole roster (who else is on
-- this with me), not just their own row.
create policy project_task_assignees_collab_select on public.project_task_assignees
  for select to authenticated
  using (is_task_assignee(task_id) and can_access_project(task_project(task_id)));

-- Only ever themselves: self-assign on a task they just created, or stepping
-- off one. Assigning OTHER people stays a studio-member move.
create policy project_task_assignees_collab_insert on public.project_task_assignees
  for insert to authenticated
  with check (user_id = auth.uid() and can_access_project(task_project(task_id)));

create policy project_task_assignees_collab_delete on public.project_task_assignees
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------ files + comments ----
drop policy if exists project_task_files_all on public.project_task_files;

create policy project_task_files_member_all on public.project_task_files
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

create policy project_task_files_collab_all on public.project_task_files
  for all to authenticated
  using (is_task_assignee(task_id) and can_access_project(task_project(task_id)))
  with check (is_task_assignee(task_id) and can_access_project(task_project(task_id)));

drop policy if exists project_task_comments_all on public.project_task_comments;

create policy project_task_comments_member_all on public.project_task_comments
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

create policy project_task_comments_collab_all on public.project_task_comments
  for all to authenticated
  using (is_task_assignee(task_id) and can_access_project(task_project(task_id)))
  with check (is_task_assignee(task_id) and can_access_project(task_project(task_id)));
