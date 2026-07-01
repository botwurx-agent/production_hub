-- ============================================================================
-- Security hardening (addresses database linter warnings).
-- ============================================================================

-- Pin a stable search_path on the trigger helper.
alter function public.set_updated_at() set search_path = public;

-- handle_new_user is a signup trigger only; it must not be callable via the
-- REST RPC surface by anyone.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The membership helpers are used inside RLS policies scoped to `authenticated`,
-- so authenticated must keep EXECUTE, but anon never needs them.
revoke execute on function public.is_studio_member(uuid) from anon;
revoke execute on function public.is_studio_admin(uuid) from anon;
