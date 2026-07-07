-- Let a contact be attached directly to a project (crew, talent, vendors for
-- this job), in addition to the existing client_id / lead_id attachment. The
-- project's client/agency contacts are still surfaced via the client link.
alter table public.contacts
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists company text;

create index if not exists contacts_project_idx
  on public.contacts (project_id);
