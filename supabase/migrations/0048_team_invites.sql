-- 0048: team invites — bring multiple people into one studio (paid multi-user).
-- studio_invites holds a pending invite (email + role + token). Accepting joins
-- the user to the studio via a membership. Two SECURITY DEFINER helpers do the
-- privileged bits: preview (read an invite before you're a member, for the
-- accept page) and claim (join the caller to every studio that has a pending
-- invite for their email). The signup bootstrap is made invite-aware so an
-- invited user does NOT get a stray personal studio.

create table if not exists public.studio_invites (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  email text not null,
  role membership_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked boolean not null default false
);
create index if not exists studio_invites_studio_idx on public.studio_invites(studio_id);
create index if not exists studio_invites_email_idx on public.studio_invites(lower(email));

alter table public.studio_invites enable row level security;

-- Owners/admins of the studio manage its invites.
create policy studio_invites_select on public.studio_invites
  for select to authenticated using (public.is_studio_admin(studio_id));
create policy studio_invites_insert on public.studio_invites
  for insert to authenticated with check (public.is_studio_admin(studio_id));
create policy studio_invites_update on public.studio_invites
  for update to authenticated using (public.is_studio_admin(studio_id))
  with check (public.is_studio_admin(studio_id));
create policy studio_invites_delete on public.studio_invites
  for delete to authenticated using (public.is_studio_admin(studio_id));

-- Read an invite by its (secret) token before the user is a member, for the
-- accept page. Token is the capability, like a review link.
create or replace function public.studio_invite_preview(p_token text)
returns table (studio_name text, invite_role membership_role, invite_email text, valid boolean)
language sql security definer stable set search_path = public as $$
  select s.name, si.role, si.email,
         (si.revoked = false and si.accepted_at is null) as valid
  from public.studio_invites si
  join public.studios s on s.id = si.studio_id
  where si.token = p_token
  limit 1;
$$;

-- Join the caller to every studio that has a pending invite for their email.
-- SECURITY DEFINER so it can insert memberships the caller couldn't otherwise.
create or replace function public.claim_pending_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uemail text;
  n integer := 0;
begin
  if uid is null then return 0; end if;
  select email into uemail from auth.users where id = uid;
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

grant execute on function public.studio_invite_preview(text) to authenticated, anon;
grant execute on function public.claim_pending_invites() to authenticated;

-- Make signup bootstrap invite-aware: skip creating a personal studio when a
-- pending invite exists for the new user's email (they'll join that studio via
-- claim_pending_invites() instead).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_studio_id uuid;
  studio_name text;
  has_invite boolean;
begin
  select exists (
    select 1 from public.studio_invites si
    where lower(si.email) = lower(new.email)
      and si.revoked = false
      and si.accepted_at is null
  ) into has_invite;

  if has_invite then
    return new;  -- joins the inviting studio; no personal studio
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
