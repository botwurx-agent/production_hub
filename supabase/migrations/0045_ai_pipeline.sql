-- 0045: AI film/video generation pipeline (Phase 7), slice 1.
-- One Project, shared spine, production method PER SHOT (generated | live).
-- Organize-don't-generate: we track/import; provenance travels with every
-- generation. Reuses is_studio_member RLS + set_updated_at.

create table public.ai_scripts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade unique,
  content text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_scripts enable row level security;
create policy ai_scripts_all on public.ai_scripts for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create trigger ai_scripts_set_updated_at before update on public.ai_scripts
  for each row execute function public.set_updated_at();

create table public.ai_shots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  position int not null default 0,
  title text not null default '',
  beat text,
  method text not null default 'generated',   -- generated | live
  stage text not null default 'script',        -- script | image | video | post | delivered
  status text not null default 'in_progress',
  duration_sec numeric,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_shots_project_idx on public.ai_shots (project_id, position);
alter table public.ai_shots enable row level security;
create policy ai_shots_all on public.ai_shots for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create trigger ai_shots_set_updated_at before update on public.ai_shots
  for each row execute function public.set_updated_at();

create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  shot_id uuid not null references public.ai_shots (id) on delete cascade,
  stage text not null default 'image',   -- image | video
  version int not null default 1,
  text text not null default '',
  target_model text,
  params jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_prompts_shot_idx on public.ai_prompts (shot_id, stage, version);
alter table public.ai_prompts enable row level security;
create policy ai_prompts_all on public.ai_prompts for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  shot_id uuid not null references public.ai_shots (id) on delete cascade,
  prompt_id uuid references public.ai_prompts (id) on delete set null,
  stage text not null default 'image',       -- image | video
  kind text not null default 'image',        -- image | video
  status text not null default 'candidate',  -- candidate | approved | rejected
  role text,                                 -- start | end | take | final | null
  file_path text,
  external_url text,
  thumb_url text,
  platform text,
  model text,
  model_version text,
  seed text,
  aspect text,
  resolution text,
  fps int,
  duration_sec numeric,
  guidance numeric,
  cost numeric,
  params jsonb,
  parent_start_id uuid references public.ai_generations (id) on delete set null,
  parent_end_id uuid references public.ai_generations (id) on delete set null,
  generated_by uuid references auth.users (id) on delete set null,
  generated_by_name text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_generations_shot_idx on public.ai_generations (shot_id, stage, status);
alter table public.ai_generations enable row level security;
create policy ai_generations_all on public.ai_generations for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
