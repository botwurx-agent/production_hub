-- When the studio told a vendor their payment was on its way.
--
-- Nullable, written only when the email actually leaves, so "have I already
-- told her" is answerable from the row. A re-send stays possible on purpose
-- (the "they never got it" affordance the invite emails already have), but it
-- is then a deliberate repeat rather than a silent second notice.
--
-- No RLS change: project_costs is is_studio_member only (migration 0070), and
-- a remittance is studio business, not a collaborator's.
alter table public.project_costs
  add column if not exists remittance_sent_at timestamptz;

comment on column public.project_costs.remittance_sent_at is
  'When a remittance email was last sent to this cost''s vendor. Null means never sent.';
