-- The whole cut order as a reviewable document.
--
-- A client who wants shots rearranged is reviewing the SEQUENCE, not any one
-- shot, and until now there was nothing to send them: the per-shot review
-- covers "is this shot right", never "is this order right". target_id is the
-- project, like shot_list, since a project has exactly one sequence.
alter type public.approval_target add value if not exists 'sequence';
