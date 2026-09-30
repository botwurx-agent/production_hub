-- A cost can be handed to FreshBooks as a BILL, where the studio pays it
-- (FreshBooks Bill Pay). The payment itself never happens here: FreshBooks'
-- API can create a bill and read whether it was paid, but cannot initiate a
-- payment. These columns are the link back, so the budget can learn the bill
-- was paid without anybody marking it twice.
--
-- project_costs is is_studio_member only (0070), so no RLS change is needed.

alter table public.project_costs
  add column if not exists fb_bill_id text,
  add column if not exists fb_bill_status text,
  add column if not exists fb_bill_outstanding numeric(12,2),
  add column if not exists fb_synced_at timestamptz;

comment on column public.project_costs.fb_bill_id is
  'FreshBooks bill id once this cost was sent to FreshBooks to be paid.';
comment on column public.project_costs.fb_bill_status is
  'Last FreshBooks bill status read back: unpaid | overdue | partial | paid.';
