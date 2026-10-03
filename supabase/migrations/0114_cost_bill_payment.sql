-- The link from a cost to what BILL did with it.
--
-- Mirrors what 0111 did for FreshBooks, which has now been deleted, and the
-- shape is the same for the same reason: a cost is the studio's record of a
-- commitment, and these columns say what happened to it on the rail. They are
-- a RECORD rather than a source of truth. If BILL and this disagree, BILL is
-- right, which is why bill_status is read back rather than inferred.
--
-- NO FOREIGN KEYS, because none of these ids is ours: they are BILL's, and a
-- bill deleted on their side should leave a cost that says so rather than a
-- row that cannot be written.
--
-- These live on project_costs, which is is_studio_member ONLY (0070), so a
-- project collaborator cannot read them. That is deliberate and must stay:
-- knowing which vendor was paid what is exactly what the crew must not see.
alter table public.project_costs
  -- BILL's vendor, kept for provenance: it answers "who did this get paid to
  -- over there" without a lookup, and a changed vendor name here cannot
  -- silently repoint an already-sent bill.
  add column if not exists bill_vendor_id text,
  -- The bill created from this cost. Its presence is what makes a second send
  -- a refusal rather than a duplicate.
  add column if not exists bill_bill_id text,
  -- The payment submitted against that bill, if one has been.
  add column if not exists bill_payment_id text,
  -- BILL's own word for where the bill stands, read back rather than guessed.
  add column if not exists bill_status text,
  add column if not exists bill_synced_at timestamptz;
