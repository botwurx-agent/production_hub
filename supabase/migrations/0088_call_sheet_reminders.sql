-- Chasing the people who have not confirmed a call sheet.
--
-- Viewed/confirmed tracking already existed, but noticing the gap and doing
-- something about it was left entirely to the producer, on the day when they
-- have the least attention to spare. These two columns let a daily job nudge
-- the unconfirmed as the shoot approaches, with the same cap-and-gap shape the
-- review reminders use, so nobody gets chased into the ground.
--
-- Deliberately per RECIPIENT and not per sheet: the whole point is that only
-- the people who have not answered hear anything.
alter table call_sheet_recipients
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_count smallint not null default 0;

comment on column call_sheet_recipients.last_reminded_at is
  'When the unconfirmed nudge last went out. Null means never.';
comment on column call_sheet_recipients.reminder_count is
  'How many nudges have gone out. Capped in code so a shoot week is not a mailing list.';
