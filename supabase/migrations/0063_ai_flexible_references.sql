-- Flexible, polymorphic references for AI generations: a generation can reference
-- any number of other generations (each carrying its own kind image|video +
-- provenance), each with a role. Generalizes the old parent_start_id/parent_end_id
-- (image-only, exactly two) so video-to-video, motion-driven, and multi-reference
-- flows are first-class. The old columns stay for back-compat/read.

create table if not exists public.ai_generation_refs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  ref_generation_id uuid not null references public.ai_generations(id) on delete cascade,
  role text not null default 'ref', -- start | end | motion | style | character | ref
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_refs_generation_id_idx
  on public.ai_generation_refs (generation_id);
create index if not exists ai_generation_refs_ref_generation_id_idx
  on public.ai_generation_refs (ref_generation_id);

alter table public.ai_generation_refs enable row level security;
drop policy if exists ai_generation_refs_rw on public.ai_generation_refs;
create policy ai_generation_refs_rw
  on public.ai_generation_refs
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));

alter table public.ai_shots
  add column if not exists input_mode text;
