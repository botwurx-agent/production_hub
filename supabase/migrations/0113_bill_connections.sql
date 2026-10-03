-- A studio's BILL (bill.com) login, which is what pays a vendor bill.
--
-- WHY THIS IS NOT SHAPED LIKE THE OTHER CONNECTORS. Google, Slack and Figma
-- are OAuth: the studio authorizes us and we hold a revocable token scoped to
-- what we asked for. BILL has no OAuth at all. Its API signs in with a
-- username and a password, so connecting means the studio hands over the
-- credential itself. That is a liability rather than a token, and the whole
-- design of this table follows from it.
--
-- THE SECRETS ARE ENCRYPTED BEFORE THEY GET HERE, under a key held in the
-- deployment's environment and never in the database (lib/bill-crypto.ts). So
-- a dump of this table is not a dump of anybody's password: reading it needs
-- the row AND the key, which live in different places. A server compromise
-- still reaches both, and nothing here pretends otherwise.
--
-- ADMINS ONLY, not is_studio_member. Every other connector is per-user or
-- studio-wide because reading mail or a design file is ordinary work; this one
-- can move money, so it sits with the money tables. A studio admin reading
-- their own encrypted password is harmless, since they typed it.
--
-- ONE LOGIN PER STUDIO (studio_id is unique). BILL's API is per organization
-- and a studio pays its vendors out of one set of books; a second connection
-- would only raise which one a payment came from.
--
-- NAMED `bill_connections` RATHER THAN `bill_accounts`, and the reason is
-- worth knowing because the leftovers are still in the live database. While
-- applying this, the Supabase MCP write path went into a state where every
-- statement that ADDS an object succeeded and every statement that DROPS one
-- timed out, repeatably. A half-made `bill_accounts` (an integer `id` and a
-- bare `studio_id`) could not be removed, so the real table took a clean name
-- rather than waiting. STILL TO CLEAN UP BY HAND when drops work again:
--   drop table if exists public.bill_accounts;
--   drop table if exists public.zz_probe_tmp, public.zz_probe_b,
--                        public.zz_probe_c, public.zz_probe_d;
-- None of them is referenced by any code, and none exists in a fresh
-- environment, so they are litter rather than a problem.
create table if not exists public.bill_connections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null unique references public.studios(id) on delete cascade,
  -- The BILL login's email, shown in Settings so somebody can see WHICH
  -- account is attached without us storing anything else about it.
  username text not null,
  -- BILL's own organization id, and its name for display. Both come back from
  -- ListOrgs during the connect, so neither is typed by hand.
  org_id text not null,
  org_name text,
  password_cipher text not null,
  -- The remembered-device id BILL returns after a 2-step challenge. It is what
  -- lets a later sign-in come back payment-capable, so it is a STANDING
  -- CREDENTIAL in its own right and is encrypted the same way.
  remember_me_cipher text,
  -- Presented alongside the remembered id. Generated once per studio rather
  -- than per sign-in, because BILL remembers the pair.
  device_id text not null,
  -- When a sign-in last came back trusted, which is the one thing that decides
  -- whether a payment can be attempted at all.
  mfa_trusted_at timestamptz,
  last_ok_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bill_connections enable row level security;

drop policy if exists bill_connections_admin on public.bill_connections;
create policy bill_connections_admin on public.bill_connections
  for all to authenticated
  using (public.is_studio_admin(studio_id))
  with check (public.is_studio_admin(studio_id));
