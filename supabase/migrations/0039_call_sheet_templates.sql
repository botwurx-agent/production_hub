-- Reusable call sheet templates (studio-scoped): save a sheet's block layout +
-- accent and apply it to any other call sheet.
create table if not exists public.call_sheet_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  layout jsonb,
  accent text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.call_sheet_templates enable row level security;
create policy call_sheet_templates_all on public.call_sheet_templates
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
