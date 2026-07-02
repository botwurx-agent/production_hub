-- ============================================================================
-- Generalize email threads to attach to a Lead, Client, or Project (exactly
-- one owner). Communication now lives from first contact (lead) and carries
-- forward on convert. RLS stays studio-scoped.
-- ============================================================================

alter table public.email_threads alter column project_id drop not null;
alter table public.email_threads
  add column if not exists lead_id uuid references public.leads (id) on delete cascade;
alter table public.email_threads
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

-- Replace the old (project_id, gmail_thread_id) uniqueness with per-owner
-- partial unique indexes.
alter table public.email_threads
  drop constraint if exists email_threads_project_id_gmail_thread_id_key;

alter table public.email_threads
  drop constraint if exists email_threads_one_owner;
alter table public.email_threads add constraint email_threads_one_owner check (
  (project_id is not null)::int
  + (lead_id is not null)::int
  + (client_id is not null)::int = 1
);

create unique index if not exists email_threads_project_uq
  on public.email_threads (project_id, gmail_thread_id) where project_id is not null;
create unique index if not exists email_threads_lead_uq
  on public.email_threads (lead_id, gmail_thread_id) where lead_id is not null;
create unique index if not exists email_threads_client_uq
  on public.email_threads (client_id, gmail_thread_id) where client_id is not null;
create index if not exists email_threads_lead_idx on public.email_threads (lead_id);
create index if not exists email_threads_client_idx on public.email_threads (client_id);
