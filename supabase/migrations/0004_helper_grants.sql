-- ============================================================================
-- Lock down the membership helper functions to authenticated only.
-- Functions are granted EXECUTE to PUBLIC by default, so revoking from `anon`
-- alone leaves access via PUBLIC. Revoke PUBLIC, then grant authenticated
-- (RLS policies scoped to `authenticated` require EXECUTE to evaluate).
-- ============================================================================

revoke execute on function public.is_studio_member(uuid) from public, anon;
revoke execute on function public.is_studio_admin(uuid) from public, anon;
grant execute on function public.is_studio_member(uuid) to authenticated;
grant execute on function public.is_studio_admin(uuid) to authenticated;
