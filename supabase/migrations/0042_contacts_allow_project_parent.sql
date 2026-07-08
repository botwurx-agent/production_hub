-- 0042: allow project-level contacts.
-- The contacts_one_parent check predated contacts.project_id (added in 0033),
-- so a project contact (project_id set, client_id/lead_id null) violated it.
-- Include project_id as a valid sole parent. Existing rows (project_id null)
-- still satisfy the constraint.
alter table public.contacts drop constraint contacts_one_parent;
alter table public.contacts add constraint contacts_one_parent check (
  (client_id is not null)::int
  + (lead_id is not null)::int
  + (project_id is not null)::int
  = 1
);
