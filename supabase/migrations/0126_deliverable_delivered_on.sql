-- The day a deliverable was actually delivered, beside its due date, so the
-- page can say "Due Oct 28 · Delivered Oct 26" and a late delivery reads as
-- late. A calendar day rather than a timestamp, because it is compared with
-- due_date (also a day) and a producer may need to set it by hand for work
-- delivered before it was recorded here. Existing delivered rows stay null:
-- the day is unknown and guessing one would be worse than leaving it blank.
alter table public.deliverables add column delivered_on date;
comment on column public.deliverables.delivered_on is 'The calendar day the deliverable was delivered. Stamped when it moves to Delivered, cleared when it moves back, editable for something delivered before it was recorded here.';
