-- ============================================================================
-- The Hub: data-model spine + multi-tenancy
-- ----------------------------------------------------------------------------
-- The spine runs from first contact to final delivery:
--   Lead -> Client -> Project -> (Brief, Assets -> Versions, Approvals, Activity)
-- Multi-tenancy: every row belongs to a studio; access is scoped by studio
-- membership via row-level security. Connection-ready fields (source,
-- external_ref, external_thread_ref) are nullable now and populated by
-- connectors in a later phase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type membership_role as enum ('owner', 'admin', 'member');
create type client_type as enum ('brand', 'agency');
create type lead_stage as enum ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
create type project_status as enum ('pre_pro', 'shoot', 'post', 'delivered');
create type asset_type as enum ('image', 'video', 'storyboard', 'reference', 'cut', 'other');
create type asset_status as enum ('draft', 'in_review', 'needs_changes', 'approved', 'delivered');
create type approval_target as enum ('asset', 'version');
create type approval_status as enum ('pending', 'approved', 'changes_requested');
create type activity_type as enum ('note', 'activity', 'status_change', 'upload', 'approval');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy: studios + memberships
-- ---------------------------------------------------------------------------
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (studio_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_studio_idx on public.memberships (studio_id);

-- Membership helpers. SECURITY DEFINER so they bypass RLS on memberships and
-- cannot recurse when used inside membership/table policies. Defined after the
-- memberships table because SQL functions validate their body at creation.
create or replace function public.is_studio_member(p_studio uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.studio_id = p_studio and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_studio_admin(p_studio uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.studio_id = p_studio
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- CRM front of the spine: clients, leads, contacts
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null,
  type client_type not null default 'brand',
  notes text,
  -- connection-ready: e.g. billing record id from a connected billing tool
  external_ref jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_studio_idx on public.clients (studio_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  company text not null,
  source text,
  stage lead_stage not null default 'new',
  notes text,
  owner_id uuid references auth.users (id) on delete set null,
  -- set when the lead is converted into a client
  converted_client_id uuid references public.clients (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_studio_idx on public.leads (studio_id);

-- A contact belongs to either a client or a lead (agencies and brands have
-- multiple stakeholders). Exactly one parent is expected.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_one_parent check (
    (client_id is not null)::int + (lead_id is not null)::int = 1
  )
);
create index contacts_studio_idx on public.contacts (studio_id);
create index contacts_client_idx on public.contacts (client_id);
create index contacts_lead_idx on public.contacts (lead_id);

-- ---------------------------------------------------------------------------
-- Projects: the central object
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  status project_status not null default 'pre_pro',
  due_date date,
  shoot_date date,
  owner_id uuid references auth.users (id) on delete set null,
  notes text,
  -- connection-ready: external references (billing, external project tools)
  external_ref jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_studio_idx on public.projects (studio_id);
create index projects_client_idx on public.projects (client_id);

-- ---------------------------------------------------------------------------
-- Brief: one per project
-- ---------------------------------------------------------------------------
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null unique references public.projects (id) on delete cascade,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index briefs_studio_idx on public.briefs (studio_id);

create table public.brief_attachments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete cascade,
  name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index brief_attachments_studio_idx on public.brief_attachments (studio_id);
create index brief_attachments_brief_idx on public.brief_attachments (brief_id);

-- ---------------------------------------------------------------------------
-- Assets + Versions (manual versioning; nothing gets lost)
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  type asset_type not null default 'other',
  status asset_status not null default 'draft',
  -- current_version_id FK added after versions table exists (circular ref)
  current_version_id uuid,
  -- connection-ready: 'manual' now; later a connector such as figma / drive
  source text default 'manual',
  external_ref jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_studio_idx on public.assets (studio_id);
create index assets_project_idx on public.assets (project_id);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  version_number int not null,
  storage_path text,
  url text,
  mime_type text,
  size_bytes bigint,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id, version_number)
);
create index versions_studio_idx on public.versions (studio_id);
create index versions_asset_idx on public.versions (asset_id);

alter table public.assets
  add constraint assets_current_version_fk
  foreign key (current_version_id) references public.versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Approvals: review / sign-off on an asset or version
-- ---------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  target_type approval_target not null,
  target_id uuid not null,
  -- reviewer is a client contact (external) or a team member (internal)
  reviewer_contact_id uuid references public.contacts (id) on delete set null,
  reviewer_user_id uuid references auth.users (id) on delete set null,
  status approval_status not null default 'pending',
  comments text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index approvals_studio_idx on public.approvals (studio_id);
create index approvals_target_idx on public.approvals (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Communication / Activity: per-project messages, notes, timeline
-- ---------------------------------------------------------------------------
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  type activity_type not null default 'note',
  content text not null,
  -- connection-ready: reference to an external email thread for later
  external_thread_ref text,
  created_at timestamptz not null default now()
);
create index activity_studio_idx on public.activity (studio_id);
create index activity_project_idx on public.activity (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger studios_set_updated_at before update on public.studios
  for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger briefs_set_updated_at before update on public.briefs
  for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger approvals_set_updated_at before update on public.approvals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Studio bootstrap on signup: create a studio and add the user as owner.
-- Runs as SECURITY DEFINER so it can insert before any membership exists.
-- Studio name comes from signup metadata (studio_name) or falls back.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_studio_id uuid;
  studio_name text;
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.studios enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.briefs enable row level security;
alter table public.brief_attachments enable row level security;
alter table public.assets enable row level security;
alter table public.versions enable row level security;
alter table public.approvals enable row level security;
alter table public.activity enable row level security;

-- studios: members can read; any authenticated user can create (bootstrap /
-- additional studios); admins can update/delete.
create policy studios_select on public.studios
  for select to authenticated using (public.is_studio_member(id));
create policy studios_insert on public.studios
  for insert to authenticated with check (created_by = auth.uid());
create policy studios_update on public.studios
  for update to authenticated using (public.is_studio_admin(id))
  with check (public.is_studio_admin(id));
create policy studios_delete on public.studios
  for delete to authenticated using (public.is_studio_admin(id));

-- memberships: members can read co-members; admins manage.
create policy memberships_select on public.memberships
  for select to authenticated using (public.is_studio_member(studio_id));
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.is_studio_admin(studio_id));
create policy memberships_update on public.memberships
  for update to authenticated using (public.is_studio_admin(studio_id))
  with check (public.is_studio_admin(studio_id));
create policy memberships_delete on public.memberships
  for delete to authenticated using (public.is_studio_admin(studio_id));

-- Everything else: full access scoped to studio membership.
-- (Generated with a helper pattern below, one block per table.)
create policy clients_all on public.clients
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy leads_all on public.leads
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy contacts_all on public.contacts
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy projects_all on public.projects
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy briefs_all on public.briefs
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy brief_attachments_all on public.brief_attachments
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy assets_all on public.assets
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy versions_all on public.versions
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy approvals_all on public.approvals
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy activity_all on public.activity
  for all to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
