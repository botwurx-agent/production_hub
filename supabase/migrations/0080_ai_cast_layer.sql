-- The cast layer for the AI pipeline. Spec: docs/ai-pipeline.md, "The cast layer".
--
-- The pipeline could say "this take came from those two images" but not "Maya is
-- in shots 1, 4 and 7, wearing the grey tee and the gold ring in all three".
-- These tables make the second sentence expressible, which is what stops a
-- generated spot drifting.

-- ---------------------------------------------------------------- entities --
-- The cast and contents of a job. project_id NULL means studio-wide, for a
-- recurring mascot or spokesperson; same convention as ai_prompt_library.
create table if not exists public.ai_entities (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  -- character: identity-locked, a person the audience must recognise
  -- element:   a garment, prop or product that must be exact (WD-01, the bottle)
  -- location:  a set or place, carrying its scout sheet
  -- crowd:     background extras, deliberately NOT identity-locked
  kind text not null default 'character'
    check (kind in ('character', 'element', 'location', 'crowd')),
  name text not null,
  -- ours: search, display, prompt composition. NOT the platform handle.
  slug text not null,
  description text,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- coalesce, because Postgres treats NULLs as distinct and studio-wide entities
-- would otherwise escape the uniqueness check entirely
create unique index if not exists ai_entities_slug_idx
  on public.ai_entities (
    studio_id,
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(slug)
  );
create index if not exists ai_entities_project_idx
  on public.ai_entities (project_id, kind);

alter table public.ai_entities enable row level security;
create policy ai_entities_all on public.ai_entities for all to authenticated
  using (is_studio_member(studio_id) or can_access_project(project_id))
  with check (is_studio_member(studio_id) or can_access_project(project_id));
create trigger ai_entities_set_updated_at before update on public.ai_entities
  for each row execute function public.set_updated_at();

-- Resolve an entity to its project, for the policies below. Returns NULL for a
-- studio-wide entity, which correctly falls back to is_studio_member.
create or replace function public.ai_entity_project(p_entity uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.ai_entities where id = p_entity;
$$;

-- ------------------------------------------------------------------- looks --
-- A named state of an entity: "scene 1 casual" on a character, "empty" on a
-- bottle, "golden hour" on a location.
--
-- NAMING RULE (see the spec): name the LOOK, never the scene. A scene-bound name
-- starts lying the moment the outfit reappears in another scene.
create table if not exists public.ai_looks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  entity_id uuid not null references public.ai_entities (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  position int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ai_looks_slug_idx
  on public.ai_looks (entity_id, lower(slug));
create index if not exists ai_looks_entity_idx
  on public.ai_looks (entity_id, position);

alter table public.ai_looks enable row level security;
create policy ai_looks_all on public.ai_looks for all to authenticated
  using (is_studio_member(studio_id)
     or can_access_project(public.ai_entity_project(entity_id)))
  with check (is_studio_member(studio_id)
     or can_access_project(public.ai_entity_project(entity_id)));
create trigger ai_looks_set_updated_at before update on public.ai_looks
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- look items --
-- A look is a COMPOSITION of element entities, not a container for them. The
-- ring is one entity referenced by every look it appears in, so "which shots is
-- the ring in" is a query rather than an archaeology exercise. That is the
-- accessory-continuity error this whole layer exists to catch.
create table if not exists public.ai_look_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  look_id uuid not null references public.ai_looks (id) on delete cascade,
  item_entity_id uuid not null references public.ai_entities (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_look_items_unique_idx
  on public.ai_look_items (look_id, item_entity_id);

alter table public.ai_look_items enable row level security;
create policy ai_look_items_all on public.ai_look_items for all to authenticated
  using (is_studio_member(studio_id)
     or can_access_project(public.ai_entity_project(item_entity_id)))
  with check (is_studio_member(studio_id)
     or can_access_project(public.ai_entity_project(item_entity_id)));

-- -------------------------------------------------------------- shot cast --
-- "Maya, in her scene 1 look, appears in shot 4." Several talent in one shot
-- works without special handling, because it always was a join.
create table if not exists public.ai_shot_cast (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  shot_id uuid not null references public.ai_shots (id) on delete cascade,
  entity_id uuid not null references public.ai_entities (id) on delete cascade,
  look_id uuid references public.ai_looks (id) on delete set null,
  -- crowd size lives here rather than on the entity: three extras in one shot
  -- and eight in another is the normal case
  count int,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_shot_cast_unique_idx
  on public.ai_shot_cast (shot_id, entity_id);
create index if not exists ai_shot_cast_entity_idx
  on public.ai_shot_cast (entity_id);

alter table public.ai_shot_cast enable row level security;
create policy ai_shot_cast_all on public.ai_shot_cast for all to authenticated
  using (is_studio_member(studio_id)
     or can_access_project((select s.project_id from public.ai_shots s where s.id = shot_id)))
  with check (is_studio_member(studio_id)
     or can_access_project((select s.project_id from public.ai_shots s where s.id = shot_id)));

-- ----------------------------------------------------------------- handles --
-- The platform's identifier for something you uploaded. RECORDED EXTERNAL
-- STATE, not a slug we invent: the prompt only resolves if we emit this string
-- exactly. Hangs off looks as well as entities, because the wardrobe is
-- uploaded separately and comes back with its own @name. account_ref exists
-- because handles die the day you move accounts.
create table if not exists public.ai_entity_handles (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  entity_id uuid references public.ai_entities (id) on delete cascade,
  look_id uuid references public.ai_looks (id) on delete cascade,
  platform text not null,
  handle text not null,
  external_id text,
  account_ref text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_entity_handles_one_owner check (
    (entity_id is not null)::int + (look_id is not null)::int = 1
  )
);
-- refuse collisions rather than letting two near-identical handles coexist
create unique index if not exists ai_entity_handles_unique_idx
  on public.ai_entity_handles (studio_id, platform, lower(handle));
create index if not exists ai_entity_handles_entity_idx
  on public.ai_entity_handles (entity_id);
create index if not exists ai_entity_handles_look_idx
  on public.ai_entity_handles (look_id);

alter table public.ai_entity_handles enable row level security;
create policy ai_entity_handles_all on public.ai_entity_handles for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
create trigger ai_entity_handles_set_updated_at before update on public.ai_entity_handles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------- entity-owned generations --
-- A character sheet belongs to the entity, not to a shot. Reusing
-- ai_generations means sheets inherit storage, provenance, link import, triage
-- and review instead of growing a parallel copy of all of it.
alter table public.ai_generations alter column shot_id drop not null;
alter table public.ai_generations
  add column if not exists entity_id uuid references public.ai_entities (id) on delete cascade;
alter table public.ai_generations
  add column if not exists look_id uuid references public.ai_looks (id) on delete cascade;

-- exactly one owner, the same shape email_threads uses. Every existing row has
-- shot_id set, so this passes on the current data.
alter table public.ai_generations drop constraint if exists ai_generations_one_owner;
alter table public.ai_generations add constraint ai_generations_one_owner check (
  (shot_id is not null)::int + (entity_id is not null)::int + (look_id is not null)::int = 1
);

create index if not exists ai_generations_entity_idx on public.ai_generations (entity_id);
create index if not exists ai_generations_look_idx on public.ai_generations (look_id);

-- The old policy resolved the project through ai_shots on shot_id. With shot_id
-- now nullable that resolver returns NULL for a sheet, which would silently cut
-- project collaborators off from every character sheet. Extend it rather than
-- leave them looking at an empty cast.
drop policy if exists ai_generations_all on public.ai_generations;
create policy ai_generations_all on public.ai_generations for all to authenticated
  using (
    is_studio_member(studio_id)
    or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_generations.shot_id))
    or can_access_project(public.ai_entity_project(ai_generations.entity_id))
    or can_access_project(public.ai_entity_project(
         (select l.entity_id from public.ai_looks l where l.id = ai_generations.look_id)))
  )
  with check (
    is_studio_member(studio_id)
    or can_access_project((select s.project_id from public.ai_shots s where s.id = ai_generations.shot_id))
    or can_access_project(public.ai_entity_project(ai_generations.entity_id))
    or can_access_project(public.ai_entity_project(
         (select l.entity_id from public.ai_looks l where l.id = ai_generations.look_id)))
  );
