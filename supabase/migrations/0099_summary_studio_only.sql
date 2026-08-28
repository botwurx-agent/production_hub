-- The AI project summary is a producer's briefing generated from studio-wide
-- data: budget figures, billing state, pipeline. Money talk lands in the
-- stored prose routinely, and RLS cannot strip a sentence out of a paragraph,
-- so the row itself must sit with the money tables: studio members only.
-- Same class of fix as migration 0074 (money columns off collaborator-readable
-- tables); found when the operator went to invite two stylists onto a project
-- whose summary discussed the budget.
--
-- Drops the 0056/0093 pair (write via can_edit_project + read via
-- can_access_project) and restores the original studio-only policy. Reversing
-- this is recreating that pair.

drop policy if exists project_summaries_all on public.project_summaries;
drop policy if exists project_summaries_all_read on public.project_summaries;

create policy project_summaries_all on public.project_summaries
  for all to authenticated
  using (is_studio_member(studio_id))
  with check (is_studio_member(studio_id));
