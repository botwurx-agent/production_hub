-- Signed paperwork: NDAs, master agreements, statements of work, change orders.
--
-- Shaped from two real documents. Both showed the same things:
--  * A SOW is a CHILD of a master agreement ("governed under the Master
--    Services Agreement dated 1/28/2026", "part of and subject to the
--    Subcontractor Agreement"), hence parent_id.
--  * BOTH parties sign, hence two signature date/name pairs rather than the
--    single signer the proposal flow has.
--  * The studio is usually the RECEIVER, not the sender, hence direction
--    defaulting to inbound and storage_path being the normal case rather than
--    an afterthought.
--
-- Scope follows the relationship: an NDA or MSA belongs to the ACCOUNT (signed
-- once, governs everything after), a SOW or change order belongs to a PROJECT.
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,

  kind text not null default 'sow',
  -- inbound: they sent it and we sign. outbound: we sent it.
  direction text not null default 'inbound',

  -- A SOW hangs off its MSA; a change order hangs off its SOW.
  parent_id uuid references public.agreements(id) on delete set null,

  -- Exactly one scope in practice, but both nullable: paperwork sometimes
  -- arrives before anyone has decided which project it belongs to.
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,

  title text not null default '',
  -- The counterparty's own numbering, e.g. "SOW #1".
  reference text,
  -- Who it is with, as written on the document ("Hint, Inc.").
  counterparty text,

  effective_date date,
  -- NDAs and MSAs run for a term; a lapsed NDA is worth being able to see.
  expires_date date,

  our_signer_name text,
  our_signed_at date,
  their_signer_name text,
  their_signed_at date,

  -- Total fee the document states, for reconciling against the budget.
  value numeric(12,2),

  notes text,
  storage_path text,
  file_name text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agreements_kind_check
    check (kind in ('nda', 'msa', 'sow', 'change_order', 'other')),
  constraint agreements_direction_check
    check (direction in ('inbound', 'outbound'))
);

create index if not exists agreements_client_idx on public.agreements(client_id);
create index if not exists agreements_project_idx on public.agreements(project_id);
create index if not exists agreements_parent_idx on public.agreements(parent_id);

alter table public.agreements enable row level security;

-- is_studio_member ONLY. A contract states fees and obligations, so it belongs
-- with the money tables, not with the project-scoped tables a collaborator can
-- read. Do not widen this to can_access_project.
drop policy if exists agreements_all on public.agreements;
create policy agreements_all on public.agreements
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
