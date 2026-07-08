-- ============================================================================
-- 0041: FreshBooks billing connector (Phase 6/8).
-- Orchestrate, don't replace: FreshBooks stays the system of record for money
-- and accounting; The Hub is the control surface. This migration adds:
--   1. Priced deliverables (rate + qty) so a project's deliverables can become
--      invoice line items.
--   2. billing_accounts: the studio's single FreshBooks connection + OAuth
--      tokens (studio-scoped, like the studio's books).
--   3. project_invoices: a per-project mirror of an invoice created in
--      FreshBooks (status, amounts, hosted pay URL). The invoice of record and
--      its numbering/tax/currency live in FreshBooks.
-- Tokens are stored here for now; before broad multi-user use, move token reads
-- to a service-role server client and encrypt at rest (same note as
-- email_accounts).
-- ============================================================================

-- 1. Priced deliverables (line-item inputs). Nullable rate so existing rows are
--    untouched; qty defaults to 1.
alter table public.deliverables
  add column rate double precision,
  add column qty int not null default 1;

-- 2. The studio's FreshBooks connection (one per studio).
create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  provider text not null default 'freshbooks',
  connected_by uuid references auth.users (id) on delete set null,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  fb_account_id text,      -- accounting account id: /accounting/account/<id>/...
  fb_business_id text,     -- business id: payments + events services
  fb_identity_email text,  -- who authorized (for display)
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, provider)
);
create index billing_accounts_studio_idx on public.billing_accounts (studio_id);

alter table public.billing_accounts enable row level security;

-- Studio-wide: any team member can create/send invoices on the studio's books.
create policy billing_accounts_all on public.billing_accounts
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create trigger billing_accounts_set_updated_at before update on public.billing_accounts
  for each row execute function public.set_updated_at();

-- 3. Per-project invoice mirror. Source of record stays in FreshBooks.
create table public.project_invoices (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  fb_invoice_id text not null,
  fb_client_id text,
  number text,
  -- draft | sent | viewed | partial | paid | overdue | disputed
  status text not null default 'draft',
  amount double precision,
  amount_paid double precision not null default 0,
  currency text not null default 'USD',
  hosted_url text,        -- FreshBooks-hosted invoice / pay page
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, fb_invoice_id)
);
create index project_invoices_project_idx on public.project_invoices (project_id);
create index project_invoices_studio_idx on public.project_invoices (studio_id);

alter table public.project_invoices enable row level security;

create policy project_invoices_all on public.project_invoices
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create trigger project_invoices_set_updated_at before update on public.project_invoices
  for each row execute function public.set_updated_at();
