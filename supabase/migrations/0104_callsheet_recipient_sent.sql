-- Whether a call sheet actually went to a person, recorded rather than animated.
--
-- FROM A REAL SEND. Pressing Email flipped the button to "Sent" for two and a
-- half seconds and then back to "Email", because the only record was component
-- state. Twelve people in, the producer could not tell which of them had been
-- emailed and which had not: every row looked identical to an unsent one. On a
-- call sheet that is the worst possible ambiguity, since the cost of guessing
-- wrong is somebody not knowing where to be at 6am.
--
-- `sent_at` is the last time it went out and `send_count` is how many times,
-- which are different questions: the first says "this person has it", the
-- second distinguishes an original send from a resend after they never opened
-- it. Both are on the RECIPIENT, not the sheet, because call_sheets.status
-- already answers "has this sheet been sent at all" and cannot answer "did
-- Ryan get it".
--
-- Deliberately separate from `last_reminded_at` (0088), which counts automatic
-- chasing and is bounded at two. A send is a deliberate act by the producer and
-- is not capped.

alter table public.call_sheet_recipients
  add column if not exists sent_at timestamptz,
  add column if not exists send_count integer not null default 0;

comment on column public.call_sheet_recipients.sent_at is
  'When the call sheet was last emailed to this person. NULL means they have never been sent it.';
comment on column public.call_sheet_recipients.send_count is
  'How many times it has been emailed to them. Distinguishes a first send from a resend.';

-- Anyone already viewed or confirmed obviously received it, so they are
-- backfilled rather than being shown as never sent, which would read as a bug
-- on the first load after deploy. The timestamp is the earliest thing we know
-- happened, so it is never later than the truth.
update public.call_sheet_recipients
set sent_at = coalesce(viewed_at, confirmed_at),
    send_count = 1
where sent_at is null
  and coalesce(viewed_at, confirmed_at) is not null;
