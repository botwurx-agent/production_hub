-- Props: the glassware, the linens, the furnishings, the practicals.
--
-- Came from a producer's feedback, and it lands somewhere the app did not have
-- a home for. Gear & crew is the closest table structurally (a physical thing
-- with a quantity and a confirmed flag) but nobody sends a C-stand to a client
-- for sign-off. Assets and review handle approval well, but an asset is
-- something you MADE, not something you SOURCE. A prop is the first object here
-- that is both a logistics item and a creative approval item, which is exactly
-- why it fell between the two.
--
-- SHAPE IS THE ONE THIS CODEBASE ALREADY USES THREE TIMES: the parent holds the
-- requirement, the children hold what actually happened, and one child gets
-- picked. Assets hold versions, budget_lines hold project_costs, a cost holds
-- cost_payments, an ai_shot holds its candidates. A prop holds its options.

create table if not exists public.props (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  position integer not null default 0,

  name text not null,
  -- Free text against the list in lib/props.ts rather than an enum. Art
  -- departments carve this up differently on every job and a new category
  -- should not cost a migration, same call as contacts.type.
  category text,
  qty integer not null default 1,
  notes text,

  -- Where it is coming from. Both, deliberately: `source` is the prop house or
  -- shop as written on the day, `contact_id` links it to the roster vendor when
  -- one exists. project_costs already carries exactly this pair for the same
  -- reason, because half of these are a shop with no roster entry.
  source text,
  contact_id uuid references public.contacts(id) on delete set null,

  -- Logistics, not approval. Approval is the review stack's answer and is
  -- recorded there; this is "have I actually got the thing yet".
  status text not null default 'needed',

  -- The option that won. Nullable for the whole time a prop is still a
  -- requirement with nothing chosen, which is most of pre-production.
  picked_option_id uuid,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists props_project_idx
  on public.props (project_id, position);

-- The candidates. Three glasses from the prop house, and the client picks one.
create table if not exists public.prop_options (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  prop_id uuid not null references public.props(id) on delete cascade,
  position integer not null default 0,

  name text,
  -- The photo. Stored in the `assets` bucket like every other image here, so it
  -- inherits signing, resizing and the collaborator-safe read path.
  storage_path text,
  mime_type text,
  -- For an option that lives on a supplier's site rather than in a photo.
  url text,
  source text,
  notes text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists prop_options_prop_idx
  on public.prop_options (prop_id, position);

-- Added after the fact because the two tables reference each other.
alter table public.props
  drop constraint if exists props_picked_option_fk;
alter table public.props
  add constraint props_picked_option_fk
  foreign key (picked_option_id)
  references public.prop_options(id) on delete set null;

-- DELIBERATELY NO PRICE COLUMN, and this is the 0074 lesson applied ahead of
-- time rather than after. Both tables are project-scoped and therefore readable
-- by collaborators, so a price here would be precisely the leak that migration
-- closed: money on a table the art department can read. What a prop COSTS is
-- the cost ledger's business, where it already has a vendor, an invoice, a
-- payment schedule and studio-only RLS. An option carries where it came from,
-- not what it runs to.

alter table public.props enable row level security;
create policy props_all on public.props
  for all
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(project_id)
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(project_id)
  );

alter table public.prop_options enable row level security;
create policy prop_options_all on public.prop_options
  for all
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select p.project_id from public.props p where p.id = prop_id)
    )
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select p.project_id from public.props p where p.id = prop_id)
    )
  );

-- Props join the review stack as a target type, alongside shot_list,
-- storyboard, moodboard, ai_shot and sequence. That is the whole approval
-- story: pinned comments, request-changes, the internal review page and the
-- no-login /r/<token> client portal all come from the existing machinery, so
-- "the client approves the third glass" needed no approval code of its own.
--
-- Separate from the create-table block above because ALTER TYPE ... ADD VALUE
-- cannot run in the same transaction as something that then uses the new value.
alter type approval_target add value if not exists 'props';
