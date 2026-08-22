-- Talent profiles: the detail a contact needs when the contact is a person you
-- are booking rather than a vendor you are paying.
--
-- The roster was built for crew, where name, position, rate and a phone number
-- is genuinely the whole record. An actor is not that. Wardrobe needs
-- measurements, catering needs allergies, accounts needs the agent, and the
-- credit needs the name they are billed under, which is often not the name on
-- the call sheet.
--
-- A SEPARATE TABLE, not columns on `contacts`. That table is reached from the
-- client page, the lead page, the call sheet recipient picker, the budget's
-- vendor picker and the CRM, and fifteen mostly-null columns would be carried
-- through every one of those reads. It also leaves a clean seam if any of this
-- ever needs narrower visibility than the roster itself.

create table if not exists public.contact_profiles (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  -- One profile per contact. Unique rather than a plain FK so an upsert can
  -- target it, and cascade so deleting the person takes their profile with it.
  contact_id uuid not null unique
    references public.contacts(id) on delete cascade,

  -- Identity. `credited_as` is the billing name and is routinely different from
  -- the legal name the deal memo is in, which is exactly why both are needed.
  credited_as text,
  pronouns text,
  website text,

  -- Representation. Flat rather than a contacts row of its own: an agent is
  -- reached ABOUT this person, and giving them their own roster entry would put
  -- them on the call sheet.
  agent_name text,
  agent_email text,
  agent_phone text,
  -- Free text, not an enum. SAG-AFTRA, Equity, ACTRA, non-union, financial core
  -- and "sag-eligible" are all real answers and the list differs by country.
  union_status text,

  -- Catering. On EVERY contact, not just talent, because crew eat too and this
  -- is what the meal round is for. Free text rather than a checklist: "no pork,
  -- and dairy only if it is not the main" is a real answer that no set of
  -- checkboxes holds.
  dietary_restrictions text,
  allergies text,
  dietary_notes text,

  -- Wardrobe, as jsonb keyed by the field list in lib/talent.ts.
  --
  -- Deliberately not one column per measurement. The set that matters differs
  -- by person and by garment (a suit fitting wants sleeve and inseam, a hat
  -- wants head, a stunt double wants both plus shoe), we never filter or sum on
  -- them, and a new measurement should not cost a migration. Same reasoning as
  -- call_sheets.layout and board_items.text, which are already this shape.
  wardrobe jsonb,

  -- Storage path in the `assets` bucket. A column rather than a contact_files
  -- row because the roster card draws it on every render and should not have to
  -- look it up.
  headshot_path text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- VISIBILITY IS THE ROSTER'S, DELIBERATELY, and it is worth stating why rather
-- than leaving it to be inferred.
--
-- Migration 0074 moved every money field off the project-scoped tables into
-- is_studio_member side tables, so the obvious reading is that this belongs
-- there too. It does not. Costume needs the measurements and craft services
-- needs the allergies, and both are crew who reach this project as
-- collaborators. A studio-only profile would be invisible to precisely the
-- people whose job it is.
--
-- The rate stays where 0074 put it. What a performer is PAID is a different
-- question from what size they wear, and only the first one is nobody's
-- business but the studio's.
--
-- IF THIS EVER NEEDS TO BE NARROWER, the fix is to split the medical fields
-- into their own is_studio_member table, not to close the whole profile: the
-- contacts page tells the user out loud that crew with project access can see
-- this, the same sentence the documents page already carries.
--
-- THE NULL CASE IS LOAD-BEARING AND WAS CHECKED, not assumed. A contact
-- belonging to a CLIENT rather than a project has project_id null, so the
-- subquery hands can_access_project a null. Both of its EXISTS clauses compare
-- against that null, neither matches, and it returns false: verified against
-- the live function. So a client contact's profile falls back to
-- is_studio_member alone, which is the direction you want it to fail in.
alter table public.contact_profiles enable row level security;
create policy contact_profiles_all on public.contact_profiles
  for all
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select c.project_id from public.contacts c where c.id = contact_id)
    )
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select c.project_id from public.contacts c where c.id = contact_id)
    )
  );

-- Paperwork and reference stuck to a person: the signed release, the W-9, the
-- size sheet, the wardrobe fitting photos.
--
-- NOT an `assets` row, which is the other obvious home. Documents became assets
-- (0078) because a call sheet or a permit is superseded constantly and needed
-- version history. A W-9 is not revised, it is replaced, and routing these
-- through the asset library would mean every existing caller of
-- loadProjectAssets had to learn to exclude them or a performer's release would
-- surface in the creative library next to the pack shot.
create table if not exists public.contact_files (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- 'document' or 'media'. Two shelves rather than a folder tree, matching the
  -- split in the reference tools the operator works from.
  kind text not null default 'document',
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contact_files_contact_idx
  on public.contact_files (contact_id, created_at desc);

alter table public.contact_files enable row level security;
create policy contact_files_all on public.contact_files
  for all
  using (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select c.project_id from public.contacts c where c.id = contact_id)
    )
  )
  with check (
    public.is_studio_member(studio_id)
    or public.can_access_project(
      (select c.project_id from public.contacts c where c.id = contact_id)
    )
  );

-- Ties a call sheet recipient back to the roster entry they were added from.
--
-- Without it the only link is the email address, and matching on that is wrong
-- in both directions: a crew member added by hand with a typo silently loses
-- their allergies, and two people sharing a production address collide. The
-- meal round needs this to show catering who it is ordering for.
--
-- Nullable, because a recipient can still be typed in free-hand for someone who
-- is not on the roster at all.
alter table public.call_sheet_recipients
  add column if not exists contact_id uuid
    references public.contacts(id) on delete set null;
