-- A reminder is a send, and neither reminder path was recording it.
--
-- FOUND ON A LIVE SHOOT. The operator was certain they had emailed Liddy and
-- the panel said "Not sent". They were right. Both chasing paths, the manual
-- "Remind N unconfirmed" button and the daily cron, send the same
-- /c/<token> link the first email carries, and both stamped only
-- last_reminded_at + reminder_count. So anyone whose only delivery was a
-- reminder read as never emailed, forever. Two of the five had already opened
-- the sheet within twenty seconds of that email, which is the proof it landed.
--
-- The code now stamps sent_at + send_count on both paths (see
-- remindUnconfirmed in callsheet-actions.ts and lib/callsheet-reminders.ts),
-- and lib/callsheet-status.ts reads last_reminded_at as an emailed timestamp
-- so the module cannot be wrong about the one question it exists to answer
-- just because a caller forgot a column.
--
-- THIS BACKFILL IS NOT THE ONE 0104 GOT WRONG. That one invented a send time
-- by copying viewed_at, a moment nobody was ever emailed at. last_reminded_at
-- is a real timestamp written at the moment the mail provider accepted the
-- message, so copying it across is recording what happened rather than
-- guessing at it. Applied to the live database on 2026-09-03; it repaired five
-- rows.

update public.call_sheet_recipients
set sent_at = last_reminded_at,
    send_count = greatest(coalesce(send_count, 0), coalesce(reminder_count, 1))
where sent_at is null
  and last_reminded_at is not null;
