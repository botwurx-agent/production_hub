-- A connector link is add-only unless its owner switches editing on. When
-- can_edit is true the link is also offered the update_* tools (change shots,
-- storyboard frames, tasks and draft call sheets). Default false, so every
-- link made before this stays exactly as it was. Still nothing here deletes
-- or sends; RLS (can_edit_project) remains the database's own check on each
-- write, since the connector runs as the link's owner.
alter table public.connector_tokens add column can_edit boolean not null default false;
comment on column public.connector_tokens.can_edit is 'When true the link may also CHANGE existing work (the update_* connector tools). False = add only. Every link made before this stays add only.';
