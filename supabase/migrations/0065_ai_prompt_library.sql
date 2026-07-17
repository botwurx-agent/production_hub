-- Prompt / style library: reusable, named prompts and STYLE TOKENS (a look
-- fragment carried across shots for consistency) so a studio isn't retyping the
-- same 200-word prompt every batch, and a whole project can share one look.
-- kind = 'prompt' (a full reusable prompt) | 'style' (a look fragment appended to
-- prompts). project_id null = studio-wide (reusable across every project); set =
-- specific to that project's look. stage null = usable in either stage.

create table if not exists public.ai_prompt_library (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'prompt',
  name text not null default '',
  body text not null default '',
  stage text,
  target_model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_prompt_library_studio_idx
  on public.ai_prompt_library (studio_id);
create index if not exists ai_prompt_library_project_idx
  on public.ai_prompt_library (project_id);

alter table public.ai_prompt_library enable row level security;
drop policy if exists ai_prompt_library_rw on public.ai_prompt_library;
create policy ai_prompt_library_rw
  on public.ai_prompt_library
  for all
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
