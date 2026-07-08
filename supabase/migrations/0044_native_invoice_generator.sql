-- 0044: native invoice/estimate generator (no FreshBooks required).
-- A studio billing profile (the "From" block + defaults), plus editable
-- invoice/estimate documents with per-line tax. Modeled on the call-sheet
-- pattern (multi-doc, edit-on-the-sheet, later PDF + shareable link).

create table public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade unique,
  business_name text,
  address text,
  email text,
  phone text,
  website text,
  default_terms text,
  default_notes text,
  invoice_prefix text not null default 'INV-',
  estimate_prefix text not null default 'EST-',
  next_invoice_no int not null default 1001,
  next_estimate_no int not null default 1001,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_profiles enable row level security;
create policy billing_profiles_all on public.billing_profiles
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
create trigger billing_profiles_set_updated_at before update on public.billing_profiles
  for each row execute function public.set_updated_at();

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  kind text not null default 'invoice',    -- invoice | estimate
  number text,
  -- invoice: draft|sent|paid|void ; estimate: draft|sent|accepted|declined
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  bill_to_name text,
  bill_to_company text,
  bill_to_email text,
  bill_to_address text,
  reference text,
  currency text not null default 'USD',
  discount double precision not null default 0,  -- flat discount amount
  notes text,
  terms text,
  share_token text unique,
  viewed_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_documents_project_idx on public.billing_documents (project_id, created_at desc);
create index billing_documents_studio_idx on public.billing_documents (studio_id);
alter table public.billing_documents enable row level security;
create policy billing_documents_all on public.billing_documents
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
create trigger billing_documents_set_updated_at before update on public.billing_documents
  for each row execute function public.set_updated_at();

create table public.billing_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents (id) on delete cascade,
  studio_id uuid not null references public.studios (id) on delete cascade,
  position int not null default 0,
  description text not null default '',
  rate double precision not null default 0,
  qty double precision not null default 1,
  tax_rate double precision not null default 0,  -- percent applied to this line
  created_at timestamptz not null default now()
);
create index billing_document_lines_doc_idx on public.billing_document_lines (document_id, position);
alter table public.billing_document_lines enable row level security;
create policy billing_document_lines_all on public.billing_document_lines
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
