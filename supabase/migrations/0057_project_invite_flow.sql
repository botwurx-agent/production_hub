-- 0057: Project-invite flow support (auth/context helpers).
--
-- Adds the RPCs + one read policy the collaborator invite/accept flow needs.
-- Depends on 0056 (project_members / project_invites).

-- A collaborator must be able to read the studio row of the project(s) they are
-- on (studio name + logo for the app shell). Additive permissive SELECT policy;
-- the existing member policy (studios_select) is untouched.
create policy studios_collaborator_read on public.studios for select to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      join public.projects pr on pr.id = pm.project_id
      where pr.studio_id = studios.id and pm.user_id = auth.uid()
    )
  );

-- Read a project invite by token before membership exists (for the accept page).
-- Granted to anon so a logged-out invitee can see what they were invited to.
create or replace function public.project_invite_preview(p_token text)
returns table (
  valid boolean,
  invite_email text,
  invite_role text,
  studio_name text,
  project_id uuid,
  project_title text
)
language sql stable security definer set search_path = public as $$
  select
    (pi.accepted_at is null and not pi.revoked) as valid,
    pi.email as invite_email,
    pi.role as invite_role,
    s.name as studio_name,
    pi.project_id,
    pr.title as project_title
  from public.project_invites pi
  join public.projects pr on pr.id = pi.project_id
  join public.studios s on s.id = pi.studio_id
  where pi.token = p_token;
$$;
grant execute on function public.project_invite_preview(text) to anon, authenticated;

-- Join the caller to every project that invited their email. Bypasses the
-- staff-only insert policy on project_members (security definer). Returns the
-- number of projects joined.
create or replace function public.claim_pending_project_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  uid uuid := auth.uid();
  mail text;
  joined integer := 0;
begin
  if uid is null then return 0; end if;
  select email into mail from auth.users where id = uid;
  if mail is null then return 0; end if;

  for inv in
    select * from public.project_invites
    where lower(email) = lower(mail) and accepted_at is null and revoked = false
  loop
    insert into public.project_members (studio_id, project_id, user_id, role, added_by)
    values (inv.studio_id, inv.project_id, uid, inv.role, inv.invited_by)
    on conflict (project_id, user_id) do nothing;
    update public.project_invites
      set accepted_at = now(), accepted_by = uid
      where id = inv.id;
    joined := joined + 1;
  end loop;
  return joined;
end;
$$;
grant execute on function public.claim_pending_project_invites() to authenticated;

-- The signup bootstrap must NOT create a personal studio for a project invitee
-- either (same rule that already applies to studio invitees).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_studio_id uuid;
  studio_name text;
  has_invite boolean;
begin
  select
    exists (
      select 1 from public.studio_invites si
      where lower(si.email) = lower(new.email)
        and si.revoked = false and si.accepted_at is null
    )
    or exists (
      select 1 from public.project_invites pi
      where lower(pi.email) = lower(new.email)
        and pi.revoked = false and pi.accepted_at is null
    )
  into has_invite;

  if has_invite then
    return new;
  end if;

  studio_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'studio_name'), ''),
    'My Studio'
  );
  insert into public.studios (name, created_by)
  values (studio_name, new.id)
  returning id into new_studio_id;

  insert into public.memberships (studio_id, user_id, role)
  values (new_studio_id, new.id, 'owner');

  return new;
end;
$$;
