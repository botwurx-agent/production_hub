-- Proposals as a third document kind, a simple per-document style (template,
-- theme color, font) editable like FreshBooks, studio-wide style defaults, and
-- proposal file attachments.

-- Proposal numbering + studio-wide default style on the billing profile.
alter table public.billing_profiles
  add column if not exists proposal_prefix text default 'PROP-',
  add column if not exists next_proposal_no integer default 1001,
  add column if not exists default_doc_template text default 'classic',
  add column if not exists default_doc_accent text default '#4f46e5',
  add column if not exists default_doc_font text default 'modern';

-- Per-document style (falls back to the profile defaults when null/unset).
alter table public.billing_documents
  add column if not exists template text default 'classic',
  add column if not exists accent_color text,
  add column if not exists font text default 'modern';

-- Files attached to a document (proposals carry supporting docs).
create table if not exists public.billing_document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists billing_document_attachments_document_id_idx
  on public.billing_document_attachments (document_id);

alter table public.billing_document_attachments enable row level security;

drop policy if exists billing_document_attachments_rw on public.billing_document_attachments;
create policy billing_document_attachments_rw
  on public.billing_document_attachments
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
