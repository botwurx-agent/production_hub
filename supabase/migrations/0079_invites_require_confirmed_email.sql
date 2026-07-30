-- Invites may only be claimed by a CONFIRMED email address.
--
-- Both claim functions match a signed-in user against an invite by comparing
-- auth.users.email to the invited address. Until now neither checked whether
-- that address had actually been verified, so with Supabase's "Confirm email"
-- setting off, anyone who knew an invited address could sign up as it and be
-- joined to that studio (claim_pending_invites) or that project
-- (claim_pending_project_invites) on their first request. The email was the
-- only credential, and it was unproven.
--
-- ORDERING MATTERS: this is only safe once "Confirm email" is ON in
-- Authentication -> Sign In / Providers -> Email. With it off, no user ever
-- gets an email_confirmed_at, so this guard would silently make every invite
-- unclaimable. It was turned on before this migration was applied.
--
-- OAuth signups are unaffected: Supabase stamps email_confirmed_at when a
-- provider asserts a verified address, so "Sign in with Google" still claims.
--
-- Checked before applying: no pending invites existed and both current users
-- were already confirmed, so nothing was stranded by the change.

create or replace function public.claim_pending_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uemail text;
  n integer := 0;
begin
  if uid is null then return 0; end if;
  -- The confirmation is part of the lookup rather than a separate branch, so
  -- an unconfirmed user reads as "no email to match" and simply claims nothing.
  select email into uemail from auth.users
    where id = uid and email_confirmed_at is not null;
  if uemail is null then return 0; end if;

  insert into public.memberships (studio_id, user_id, role)
    select si.studio_id, uid, si.role
    from public.studio_invites si
    where lower(si.email) = lower(uemail)
      and si.revoked = false
      and si.accepted_at is null
  on conflict (studio_id, user_id) do nothing;

  update public.studio_invites
    set accepted_at = now(), accepted_by = uid
    where lower(email) = lower(uemail)
      and revoked = false
      and accepted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

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
  select email into mail from auth.users
    where id = uid and email_confirmed_at is not null;
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

grant execute on function public.claim_pending_invites() to authenticated;
grant execute on function public.claim_pending_project_invites() to authenticated;
