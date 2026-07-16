-- Sign-to-accept for estimates/proposals. share_token + viewed_at already exist.
-- On send, we freeze a JSON snapshot of the document so what the client signs
-- cannot be silently changed afterward; the public accept page renders the
-- snapshot, and the signature/audit trail is recorded here.
alter table public.billing_documents
  add column if not exists sent_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists signer_name text,
  add column if not exists signer_email text,
  add column if not exists signature_kind text,   -- 'typed' | 'drawn'
  add column if not exists signature_data text,    -- typed name, or data-URL of the drawn signature
  add column if not exists signed_ip text,
  add column if not exists snapshot jsonb;
