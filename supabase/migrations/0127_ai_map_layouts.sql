-- Pipeline map: where things sit when somebody has arranged the map by hand.
--
-- The map's layout is AUTOMATIC (lib/pipeline-map.ts buildMap) and this row
-- only holds OVERRIDES, keyed by node id ("shot:<id>", "gen:<id>", "el:<id>",
-- "cut"), so a node that is deleted takes its override with it and a new one
-- lands in its automatic place. One row per project, so an arrangement is
-- shared by the whole team rather than kept in one browser.
--
-- jsonb for the call_sheets.layout reason: only ever read and written whole,
-- never filtered or joined on. parsePositions is the trust boundary out of it.
--
-- RLS is the project-scoped split from 0093: anyone on the job reads, editors
-- write.

create table public.ai_map_layouts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null unique references public.projects (id) on delete cascade,
  positions jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.ai_map_layouts enable row level security;
create policy ai_map_layouts_read on public.ai_map_layouts
  for select to authenticated
  using (public.is_studio_member(studio_id) or public.can_access_project(project_id));
create policy ai_map_layouts_write on public.ai_map_layouts
  for all to authenticated
  using (public.is_studio_member(studio_id) or public.can_edit_project(project_id))
  with check (public.is_studio_member(studio_id) or public.can_edit_project(project_id));
