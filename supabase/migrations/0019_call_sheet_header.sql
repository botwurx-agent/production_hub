-- Header block fields for the industry-style call sheet layout:
-- production company details + key contacts (producer/director/PM) + breakfast.
alter table public.call_sheets
  add column company_name text,
  add column company_address text,
  add column company_website text,
  add column company_phone text,
  add column producer text,
  add column producer_phone text,
  add column director text,
  add column director_phone text,
  add column pm text,
  add column pm_phone text,
  add column breakfast text;
