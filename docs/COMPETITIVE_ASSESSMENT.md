# Competitive assessment: the Hub vs StudioBinder

Date: 2026-07-06. Written against the codebase as of commit `0631f62` and
StudioBinder's publicly documented 2026 feature set. This is a working
document: strike items as they ship, and fold the agreed priorities into
CLAUDE.md's roadmap.

Standing style rule applies here as everywhere: no em dashes.

---

## 1. What StudioBinder is

StudioBinder is the incumbent all-in-one pre-production tool for film and
video. Its core loop: import a screenplay, tag/break down elements (cast,
props, locations), auto-generate a stripboard shooting schedule and day out
of days reports, then spin call sheets from the schedule and send them to
cast and crew with delivery, view, and RSVP tracking. Around that core it
offers shot lists, storyboards, mood boards, a production contacts database,
task lists, a calendar, and file sharing. Pricing starts free (1 project,
10 contacts, sample call sheets only) and paid tiers start around $49, with
SMS call sheets gated to mid tiers and above.

Its most cited weaknesses in 2026 reviews:

- No native budgeting (no top sheet, no bid vs actual tracking).
- No real-time simultaneous multi-user editing.
- Pricing has grown expensive and confusing; essentials gated to high tiers.
- Steeper learning curve than the marketing suggests.
- Film-centric: the whole model assumes a screenplay and scenes. Commercial
  and content work has to be shoehorned in.
- No CRM, no communication hub, no invoicing/payments, no meaningful AI.

## 2. Where the Hub already wins

These are real, shipped advantages. They should shape positioning.

1. **Native budgeting.** Bid vs actual with categories, subtotals, and
   variance. This is StudioBinder's single most cited gap.
2. **CRM front of the spine.** Leads pipeline, conversion to client to
   project, follow-up flags, AI outreach drafts. StudioBinder starts at the
   project; the Hub starts at the relationship, which is how boutique
   studios actually live or die.
3. **Communication hub.** Gmail, Slack, and Google Chat threads linked to
   projects, leads, and clients, with reply/post and attachment handling.
   StudioBinder has nothing comparable.
4. **Client review portal.** Public per-asset share links with versioned
   preview, comments, and approve/request-changes, feeding back into
   activity and notifications. StudioBinder is weak on client-facing review.
5. **Connectors.** Drive, Figma, Calendar, Gmail, Slack, Google Chat.
6. **AI layer.** Project summaries, drafted client updates, drafted
   outreach, plus rules-based stalled-work flags. StudioBinder has no
   equivalent.
7. **Commercial-native model.** Flavor palettes, agency/production co
   fields, deliverable specs. The Hub speaks commercial production, not
   feature-film scheduling.

## 3. Gaps to close to be a viable competitor

Ordered by how much they matter for commercial production work, which is
the Hub's actual market. Film-only features are deliberately deprioritized.

### Tier 1: table stakes we are missing

**3.1 Call sheet distribution and confirmation tracking.**
This is StudioBinder's killer feature and our call sheet stops at a print
view. A call sheet nobody can send is half a call sheet. Needed:
- Send the call sheet by email from the app (branded, with a link to a
  live web version), later SMS (Twilio or similar).
- Per-recipient tracking: sent, bounced, viewed, confirmed. A dashboard of
  who has not confirmed, with one-click follow-up.
- This requires a transactional email path (Resend or similar); today the
  only outbound email is Gmail-connector replies.

**3.2 Multiple call sheets per project and a day schedule.**
Commercials are routinely 2 to 5 shoot days; the schema allows one call
sheet per project. Needed: call sheets per shoot day, plus schedule rows on
the sheet (time, scene/shot/setup, description) and an advance-schedule
block for the next day. This is the lightweight, commercial-shaped version
of StudioBinder's stripboard; a full film stripboard is not needed.

**3.3 Crew and vendor roster.**
Contacts today belong only to clients/leads (name, role, email, phone).
Crew exists only as free-text rows in the call sheet and gear list. Needed:
a studio-wide people database with position taxonomy (director, DP, gaffer,
HMU, etc.), default day rates, and notes, reusable across projects and
feeding call sheet and gear/crew entries by reference instead of retyping.
This also unlocks call sheet sending (recipients come from the roster) and
budget prefill (rates).

**3.4 Review depth: timecoded video comments and image pins.**
The portal has plain-text comments only. For commercial video work,
frame-accurate feedback is the daily pain (this is why Frame.io exists).
Needed: comments anchored to a video timecode (click the scrubber, comment
attaches at that time, clicking the comment seeks the player) and
click-to-pin comments on images. This turns the portal from "nice" into a
reason to switch.

### Tier 2: strong parity features

**3.5 Shot list metadata and list view.**
The shot board is presentation-first (great for treatments and client
decks) but has no shot size, camera, lens, or movement fields and no
sortable list view. Add optional camera metadata to cards plus a compact
list/table view and CSV export. One dataset, two views: deck for the
client, list for the crew.

**3.6 Lightweight tasks.**
StudioBinder has per-project task lists. The Hub has none (the old `shots`
todo table is orphaned dead code, see 6.1). A simple per-project checklist
with assignee and due date, surfaced in My Day on the dashboard, covers 90%
of the need.

**3.7 Public share links for shot board and call sheet.**
Already on the internal backlog. Both print views are auth-gated; agencies
and crew should get a token link like the review portal's.

**3.8 PDF/CSV export for budget, gear, delivery.**
Already on the internal backlog. Producers hand these to accountants and
line producers constantly.

### Tier 3: deliberately not chasing

**Script import, breakdown, stripboard auto-scheduling, DOOD reports.**
These are StudioBinder's moat for narrative film and the wrong fight for a
commercial-production product. Boards plus the shot board plus a day
schedule cover the commercial equivalent. Revisit only if real users ask.
Say this out loud in positioning: "built for commercial production, not a
film-school scheduling tool."

## 4. Differentiators

### 4.1 FreshBooks connector (get paid in the tool)

Strong idea and a natural fit: the Delivery tab's billing block is a stub
(status enum, single amount, free-text invoice number), and CLAUDE.md
already names billing as a planned connector. FreshBooks has a solid public
API: OAuth2, a Node SDK, CRUD for clients, invoices, payments, expenses,
items, and webhooks for invoice and payment events.

Concrete shape:
- Settings, Connections: add FreshBooks OAuth alongside Google/Slack/Figma
  (same pattern as `auth/figma/*`).
- Map Hub Client to FreshBooks client (nullable external reference on
  `clients`, consistent with the connection-ready schema rule).
- From the Delivery tab: "Create invoice in FreshBooks" prefilled from the
  budget total or deliverables; store the FreshBooks invoice id on
  `project_billing`.
- Webhooks (`invoice.update`, `payment.create`) flip billing status to
  invoiced/paid automatically and fire a notification. "The client paid"
  shows up in the Hub without anyone checking email.
- Dashboard: an outstanding-invoices tile next to the pipeline snapshot.

Two caveats: (a) FreshBooks is strong on getting paid (invoices, client
payment collection) but weak on sending payments out to crew/vendors; model
payables as FreshBooks expenses for now and consider Stripe or Bill.com
later if paying crew from the Hub matters. (b) Production FreshBooks apps
go through an app review step; start it early. Design the integration
behind a small interface (like `lib/ai.ts` does for providers) so QuickBooks
can slot in later, since plenty of studios are on QuickBooks.

Competitive framing: StudioBinder has neither budgeting nor billing. The
Hub closing the loop from bid to actual to invoice to paid, inside the same
project, is a genuinely differentiated story for studio operators.

### 4.2 AI layer revisit

What exists: three generators (project summary, client update, lead
outreach) plus rules-based stalled-work and follow-up flags. Good bones,
narrow surface. The differentiating direction is AI on production ops,
where no competitor plays:

1. **AI intake.** Paste an agency brief or award email; extract client,
   contacts, deliverables, dates, and budget signals; create the lead or
   project prefilled. First-touch magic moment.
2. **Brief to shot board draft.** Generate a starting set of shot groups
   and cards from the brief and moodboard; operator edits rather than
   staring at a blank board.
3. **Budget assist.** Suggest line items and rough ranges from the shot
   board, call sheet, and crew roster (rates). Rules plus LLM, clearly
   labeled as a draft.
4. **Call sheet sanity check.** Pre-send lint: missing hospital, no parking
   note, call time conflicts, sunset before wrap for exterior days. Cheap,
   high trust, mostly rules with an LLM pass for the weird stuff.
5. **Feedback digest.** Summarize a review round's comments into a
   deduplicated, actionable revision list per asset.
6. **Weekly studio digest.** One generated note across projects: what
   moved, what is stalled, what is unbilled. Builds on `lib/outstanding.ts`
   and the notifications layer.

Implementation notes: `lib/ai.ts` already abstracts providers and uses
`claude-opus-4-8` with adaptive thinking; the pattern (context builder plus
system prompt, no invented facts, no em dashes) extends cleanly. Items 1
and 5 want structured output (tool/JSON schema), not free text. Sequence
suggestion: 4 and 5 first (cheap, attach to Tier 1 features), then 1, then
2 and 3.

### 4.3 Positioning and pricing

- StudioBinder's pricing resentment (essentials gated behind ~$49+ tiers)
  is an opening: keep the operator-critical loop (call sheets, review,
  budget) in an honestly priced core tier.
- The wedge sentence: "StudioBinder organizes your shoot. The Hub runs your
  studio: pipeline, production, review, and getting paid, in one place,
  built for commercial work."

## 5. Suggested build order (grief-first, per CLAUDE.md section 7 logic)

1. Call sheet v2: multiple sheets per project, day schedule rows, email
   send with view/confirm tracking (transactional email foundation).
2. Crew/vendor roster feeding call sheets and gear (unlocks 1 fully).
3. Review portal depth: timecoded video comments and image pins.
4. FreshBooks connector: invoice from Delivery tab, payment webhooks,
   dashboard tile.
5. AI revisit wave 1: call sheet lint plus feedback digest, then AI intake.
6. Small parity sweep: shot list metadata/list view, lightweight tasks,
   public share links for board/call sheet, PDF/CSV exports.

Each step is usable on a real job on its own, per the phase rule.

## 6. Housekeeping found during the audit

1. Dead code: the flat `shots` table (migration 0017), the `ShotList`
   component, and `addShot/updateShot/deleteShot/swapShots` in
   `production/actions.ts` are unused (superseded by the shot board).
   Remove or explicitly park them.
2. Notifications read-state is studio-level, not per-user; fine for a
   single operator, needs revisiting before multi-seat sales.
3. Budget formatting is hardcoded USD (`en-US`); fine for now, note it.
4. Notifications fire only for client-review events; the Tier 1 items above
   (call sheet confirms, payments) should feed the same bell.
