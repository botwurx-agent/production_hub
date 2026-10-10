-- Client revision rounds included per deliverable, matching what the SOW
-- says (commercial SOWs routinely specify two). Null = not tracked.
-- A round is SPENT when the client requests changes on a version through a
-- review link; the count is derived from approvals, never stored.
alter table public.projects add column revision_rounds smallint
  check (revision_rounds is null or (revision_rounds >= 0 and revision_rounds <= 20));
comment on column public.projects.revision_rounds is 'Client revision rounds included per deliverable, as the SOW states. Null = not tracked. A round is spent when the client requests changes on a version through a review link.';
