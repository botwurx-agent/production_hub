-- 0049: a project's type, chosen at creation (general | live_action |
-- commercial | ai_video | cgi_vfx). A light label that tailors which module
-- cards surface on the hub (never a hard wall). Free text so the set stays
-- extensible without an enum migration.
alter table public.projects
  add column if not exists project_type text not null default 'general';
