-- ============================================================================
-- Connected accounts: add provider-specific metadata (e.g. Slack team id /
-- user id). email_accounts already holds per-user OAuth for any provider.
-- ============================================================================

alter table public.email_accounts
  add column if not exists external_ref jsonb;
