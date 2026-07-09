-- 0047: an AI pipeline shot can go through the same review cycle as docs and
-- assets. The shot's picked frames (start/end) and take are the reviewed
-- surface. Comments reuse review_comments and internal/client sign-off reuses
-- approvals, both with target_type = 'ai_shot' (target_id = ai_shots.id);
-- doc_reviews carries the pipeline row so the shot shows on the Review page.
-- No new tables: this just allows 'ai_shot' as an approval target.
alter type public.approval_target add value if not exists 'ai_shot';
