-- 0054: CRM foundation — account status on companies + a deals pipeline.
--
-- Moves the CRM from a lead-centric model (one `leads` row = company + a single
-- stage) to Accounts + Contacts + Deals:
--   - Accounts reuse the existing `clients` table (a company that can be a
--     prospect before it is an active client), so no projects/contacts foreign
--     keys need rewiring. A new `account_status` distinguishes prospect vs
--     active vs past.
--   - Deals are the pipeline objects (an opportunity: a potential job with a
--     value and a close date). A deal belongs to an account. Winning a deal
--     flips its account to 'active'.
--
-- The `leads` table is PRESERVED (not dropped): its data is copied forward into
-- accounts + deals here, so this migration is reversible and nothing is lost.

-- ---------------------------------------------------------------------------
-- 1. Account status (a company can exist as a prospect before it is a client)
-- ---------------------------------------------------------------------------
create type account_status as enum ('prospect', 'active', 'past');

alter table public.clients
  add column account_status account_status not null default 'active',
  add column owner_id uuid references auth.users (id) on delete set null,
  add column source text;
-- Existing clients are real clients: the default 'active' backfills them.
-- Prospect accounts created from the pipeline pass account_status='prospect'.

-- ---------------------------------------------------------------------------
-- 2. Deals: the pipeline object (an opportunity on an account)
-- ---------------------------------------------------------------------------
-- Stage doubles as status: 'awarded' is won, 'lost' is lost, the rest are open.
create type deal_stage as enum ('inbound', 'qualifying', 'bidding', 'awarded', 'lost');

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  account_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  value numeric,
  probability int,
  stage deal_stage not null default 'inbound',
  expected_close_date date,
  owner_id uuid references auth.users (id) on delete set null,
  source text,
  notes text,
  -- set when a won deal is turned into a project (kept nullable, connection-ready)
  won_project_id uuid references public.projects (id) on delete set null,
  lost_reason text,
  -- when the deal reached a terminal stage (awarded/lost), for reporting
  closed_at timestamptz,
  -- manual ordering within a stage column on the board
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;
create policy deals_all on public.deals
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create index deals_studio_idx on public.deals (studio_id);
create index deals_account_idx on public.deals (account_id);
create index deals_stage_idx on public.deals (studio_id, stage);

-- ---------------------------------------------------------------------------
-- 3. Copy existing leads forward into accounts + deals
-- ---------------------------------------------------------------------------
-- Converted leads: the account (client) already exists -> just record a won
-- deal on it. Un-converted leads: create a prospect account, an open (or
-- terminal) deal, and repoint the lead's contacts onto the new account.
do $$
declare
  l record;
  new_account uuid;
  mapped deal_stage;
begin
  for l in select * from public.leads loop
    mapped := case l.stage
      when 'new' then 'inbound'
      when 'contacted' then 'qualifying'
      when 'qualified' then 'qualifying'
      when 'proposal' then 'bidding'
      when 'won' then 'awarded'
      when 'lost' then 'lost'
      else 'inbound'
    end::deal_stage;

    if l.converted_client_id is not null then
      insert into public.deals
        (studio_id, account_id, title, stage, owner_id, source, notes, closed_at, created_at)
      values
        (l.studio_id, l.converted_client_id, l.company, 'awarded', l.owner_id,
         l.source, l.notes, coalesce(l.converted_at, l.updated_at), l.created_at);
    else
      insert into public.clients
        (studio_id, name, account_status, owner_id, source, notes, created_at)
      values
        (l.studio_id, l.company, 'prospect', l.owner_id, l.source, null, l.created_at)
      returning id into new_account;

      insert into public.deals
        (studio_id, account_id, title, stage, owner_id, source, notes, closed_at, created_at)
      values
        (l.studio_id, new_account, l.company, mapped, l.owner_id, l.source, l.notes,
         case when mapped in ('awarded', 'lost') then l.updated_at else null end,
         l.created_at);

      update public.contacts
        set client_id = new_account, lead_id = null
        where lead_id = l.id;
    end if;
  end loop;
end $$;
