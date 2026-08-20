-- Crew meal ordering: the separate email that already goes out on every shoot.
--
-- On a real shoot the call sheet carries a lunch NOTATION, and a second email
-- goes out with the ordering link and a cutoff time. The producer then spends
-- the morning chasing whoever ignored it. Nothing here places an order: the
-- ordering platform (DoorDash, Uber Eats, ezCater) owns that, and none of them
-- expose a public API for ordering on someone's behalf anyway. What this owns
-- is everything either side of the link: who gets it, when it goes, who has
-- acted on it, and who still needs chasing.
--
-- Attached to the CALL SHEET rather than the project, because call sheets are
-- already multi-per-project and a meal belongs to one shoot day. A three-day
-- shoot gets three rounds with no special casing.

create table if not exists public.meal_rounds (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  call_sheet_id uuid not null references public.call_sheets(id) on delete cascade,
  -- Which meal. Most shoots only ever use lunch, but a night shoot orders
  -- dinner and a dawn call orders breakfast, and they can coexist on one sheet.
  meal text not null default 'lunch',
  -- The group-order link the producer pastes. We never parse or call it.
  order_url text not null,
  instructions text,
  -- When orders close. The ordering platform enforces its own deadline; this is
  -- ours, and it is what the reminder is timed against.
  cutoff_at timestamptz,
  budget_per_head numeric(8,2),
  -- Set to send later (the morning of), null to send immediately.
  send_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One round per meal per sheet: a second "lunch" on the same day is a mistake,
-- not a use case.
create unique index if not exists meal_rounds_sheet_meal_idx
  on public.meal_rounds (call_sheet_id, meal);

alter table public.meal_rounds enable row level security;
create policy meal_rounds_all on public.meal_rounds
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- Who is in the round, and what they have done about it.
--
-- A row here IS the inclusion list: no row means that person is not on this
-- order, which is how the producer drops the client and the agency from a crew
-- lunch without deleting them from the call sheet.
create table if not exists public.meal_responses (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  meal_round_id uuid not null references public.meal_rounds(id) on delete cascade,
  recipient_id uuid not null references public.call_sheet_recipients(id) on delete cascade,
  -- They clicked through to the ordering link. This is the honest signal: the
  -- platform will never tell us whether an order was completed, but "opened the
  -- link" is most of the value and needs nothing from the crew member.
  opened_at timestamptz,
  -- They said so themselves, for the person who orders off a forwarded link.
  ordered_at timestamptz,
  last_reminded_at timestamptz,
  reminder_count smallint not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists meal_responses_round_recipient_idx
  on public.meal_responses (meal_round_id, recipient_id);

alter table public.meal_responses enable row level security;
create policy meal_responses_all on public.meal_responses
  for all
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

-- The crew member's own page reaches these through the SERVICE client gated by
-- their call-sheet token, exactly as the confirm flow already does, so no
-- anon-facing policy is needed here.

comment on table public.meal_rounds is
  'A crew meal order round on a call sheet. Holds the ordering link, the cutoff and the send time. Never places an order.';
comment on table public.meal_responses is
  'Per-recipient state for a meal round. A row is the inclusion list; opened_at is a click-through, ordered_at is self-reported.';
