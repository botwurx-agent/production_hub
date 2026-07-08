-- 0043: invoices AND estimates, with an explicit recipient.
-- project_invoices now mirrors either an invoice or an estimate created in
-- FreshBooks, and records who it was addressed to (independent of any linked
-- Client entity, so invoicing no longer requires one).
alter table public.project_invoices
  add column kind text not null default 'invoice',   -- invoice | estimate
  add column recipient_name text,
  add column recipient_email text;
