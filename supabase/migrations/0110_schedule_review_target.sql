-- 0110_schedule_review_target
--
-- The schedule could not leave the building. Every other production document
-- (shot list, storyboard, call sheet, prop list) has PDF, a share link and an
-- email; the schedule shipped with none, so the one document a unit actually
-- reads on the day could only be looked at inside the app.
--
-- `schedule` joins approval_target so the EXISTING doc-review stack carries it:
-- review_links, review_comments (pins), approvals, doc_reviews and the no-login
-- /r/<token> portal all work with no new tables, exactly as `props` did in 0092
-- and `sequence` in 0083.
--
-- It is PROJECT-SCOPED, like shot_list / sequence / props: one schedule per
-- project, so target_id is the project id. That matters at two call sites
-- TypeScript cannot check, `targetInProject` and `createDocReviewLink`, which
-- both fall through to a `boards` lookup for any kind not named explicitly and
-- would silently never match. Both name it now.

alter type public.approval_target add value if not exists 'schedule';
