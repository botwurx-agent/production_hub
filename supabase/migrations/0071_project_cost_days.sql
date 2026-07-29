-- How many days this invoice bills for, when it bills by the day.
-- Without it, "invoiced vs the agreed day rate" cannot actually be checked:
-- an amount alone says nothing about whether the rate was honoured. Nullable
-- because plenty of costs (kit rental, a flat fee, a licence) are not day work.
alter table public.project_costs
  add column if not exists days numeric(6,2);

comment on column public.project_costs.days is
  'Days billed, when the invoice bills by the day. Compared against the linked contact''s agreed rate to flag an overage. Null for flat-fee costs.';
