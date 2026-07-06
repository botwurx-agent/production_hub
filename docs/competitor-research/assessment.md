# Competitor assessment: StudioBinder vs The Hub

Date: 2026-07-06
Reference: StudioBinder (studiobinder.com), 29 screenshots in `./screenshots`
Purpose: benchmark our build against a mature, well-liked competitor and decide what to adopt.

---

## 0. TL;DR

StudioBinder is the strongest reference we have for one specific thing: **organizing a
production the way a producer actually thinks about it, and teaching the product to itself
as you go.** Their signature move is a phase-based, color-coded project workspace
(Write, Breakdown, Visualize, Plan, Shoot), where every tool lives under the production
phase it belongs to and carries a consistent color identity.

We are genuinely ahead of them on strategy (connectors, CRM-to-delivery spine, AI layer,
client review portal, dual theme). We are behind them on two things that matter a lot for
our stated "usability is the primary differentiator" bet:

1. **Workspace organization.** Our project lives on one long scrolling page plus a
   separate Production tab set. Theirs is a clean, phase-organized launcher. Ours does not
   yet "map to how commercial production actually works" as tightly as it should (our own
   principle 4.1).
2. **Onboarding and empty states.** Every StudioBinder surface teaches you what it is and
   how to use it (rich empty states, "Here's how it works", setup wizards with sensible
   defaults). We have almost none of this, and it is the single cheapest way to hit our
   "usable without a tutorial" bar.

The rest of this doc is the detail behind those two points, plus a prioritized list.

---

## 1. Where we stand (honest audit against our own principles)

### Genuinely strong
- **The spine is real and connected.** Lead -> Client -> Project -> Brief/Assets/Versions/
  Approvals/Activity is fully implemented, with multi-tenancy and RLS. StudioBinder has no
  CRM/lead front at all. Our lifecycle is broader than theirs.
- **Connectors already work** (Gmail, Slack, Google Chat, Drive, Calendar, Figma). This is
  our long-term moat and StudioBinder has nothing comparable. They are a closed island.
- **Client review portal** (public per-asset link, comment + approve, feedback flows back).
  StudioBinder shares view-only links; our review loop is arguably more focused for the
  commercial approval use case.
- **AI layer** (summaries, drafted updates, outreach, stalled-work flags). StudioBinder has
  none of this in what we saw.
- **Dual theme, token-first.** StudioBinder is light-only. Our theming discipline is a real
  differentiator for asset-review surfaces.
- **Production-ops depth** (shot board, call sheet, budget, gear, delivery) already exists.

### Thin spots (where the screenshots sting)
- **Project workspace organization.** We have Brief + Assets + Activity on one page and a
  separate `/production` tab group. There is no single, legible "here is everything about
  this job, grouped by production phase" home. A busy producer has to know where things
  live. StudioBinder makes it obvious at a glance.
- **Onboarding / first-run.** No personalization wizard, no guided setup cards, no
  "here's how it works" explainers. New surfaces are blank. This directly threatens the
  "usable without a tutorial" bar.
- **Empty states.** Ours are mostly plain. Theirs are a teaching moment every time.
- **Creation flows.** We tend to drop users into a form. They use short, friendly wizards
  with defaults and "you can always change this later," which lowers the stakes of every
  first action.
- **Consistent visual identity per area.** Our color is (correctly) reserved for status.
  But StudioBinder shows how far a consistent per-area color can go as pure wayfinding.
  Worth a deliberate decision (see section 3).

---

## 2. What StudioBinder does well, screen by screen

### 2.1 Onboarding wizard (screens 1-5)
A short, friendly, one-decision-per-screen flow: what will you use it for -> freelance vs
company -> industry -> sub-specialty (multi-select) -> "All set, welcome." Big illustrated
cards, brand imagery, a progress feel. It personalizes downstream defaults and, just as
importantly, it makes the empty product feel considered rather than intimidating.

Takeaway: even a 2 to 3 step version ("what kind of work", "solo or team", "connect a tool")
would set defaults and warm up the first-run experience.

### 2.2 Home / dashboard (screens 6-7)
Date + "Good evening, Dave" greeting. A **Customize** button. Guided setup cards with a
colored left accent border ("Create Project", "Add your company logo") that disappear once
done. Then widgets: Recent Projects, My Tasks, Recent Activity, My Team, with skeleton
placeholders and honest empty copy ("No recent activity").

We already have a customizable dashboard, so we are close here. What we lack is the
**guided setup cards** that walk a brand-new studio from zero to a first real project.

### 2.3 Feature empty states + "Here's how it works" (screens 8, 9, 15)
Every single feature area (Projects, Task Boards, Shot Lists) has the same template:
icon, headline, one-line value prop, a primary CTA, a 3-column illustrated "Here's how it
works", and a "Learn how to create X / View Tutorials" bar. This is a large, deliberate
investment and it is why the product feels easy. Nothing is ever a blank screen.

### 2.4 The project workspace: the big idea (screens 13-14)
This is the pattern to study hardest.

- A top phase-nav: **Write | Breakdown | Visualize | Plan | Shoot**.
- Below it, a color-coded module launcher. Each phase is a large colored tile, and its
  tools sit beside it as icon cards, all sharing that phase's color:
  - **Write** (orange): AV Scripts, Docs
  - **Breakdown** (blue): Stripboards
  - **Visualize** (purple): Shot Lists, Storyboards, Lookbooks
  - **Plan** (pink): Project Contacts, Calendars, Media Library
  - **Shoot** (green): Call Sheets, Locations
- A right rail for learning (StudioBinder Academy, Writing Guides).

The organizing principle is the production timeline itself. A producer does not hunt for a
feature; they think "I'm in the visualize phase" and everything for that phase is right
there, color-tagged. This is exactly our principle 4.1 ("map to how commercial production
actually works"), executed better than we currently execute it.

### 2.5 Type-driven creation (screens 11-12)
"Name Your Project" then "Select Type of Production" (Commercial or Product Video, Photo
Shoot, Documentary, etc.). The type presumably tailors which modules and templates surface.
For us, "Commercial", "Photo shoot", "Brand content" could pre-select the relevant phases.

### 2.6 Configurable specs with defaults (screens 16, 19, 20)
Shot Lists open a "Adjust Shot Specs" toggle grid (Color, Image, Shot Size, Shot Type,
Movement, Est Time, + advanced PRO fields). Storyboards ask aspect ratio and frames-per-row.
Every wizard says "you can always change this later." Progressive disclosure done right:
powerful, but never blocks the beginner.

### 2.7 Two-path creation (screens 17, 21)
A recurring "Start Blank (N items) OR Start with Images" choice. Low commitment, and the
"start with images" path is perfect for our reference-image-first commercial workflow.

### 2.8 Contacts by production role (screen 23)
Contacts filtered by **Crew / Talent / Extras / Clients**, with Role, Email, Phone, Rate,
Notes. Production-native categories, not a generic address book.

### 2.9 Production calendar as a phased Gantt (screens 24-25)
Template picker (Blank, Scripted Narrative, Unscripted Video, Photography) then a timeline
grouped by **Pre-Production / Production / Post**, with rows like Legal, Budgeting, Hire
Crew, Location Scouting, Equipment, Principal Photography. Group context menus. This is a
much richer "where does this job stand in time" view than a plain month calendar.

### 2.10 Call sheet builder (screens 26-29)
A wizard (title, date, call time, import from stripboard) -> layout picker (Standard/Simple)
-> a WYSIWYG builder with draggable HEADER blocks (Company, Staff, Day of Days, Weather,
Agenda, Notes), plus Grids/Styles/Templates, and a Design -> Recipients -> Preview & Send
flow with delivery tracking. Auto weather, sunrise/sunset, nearest hospital. Our call sheet
is solid but static by comparison; theirs is composable and sendable with read receipts.

---

## 3. The one real tension: color as status vs color as wayfinding

Our principle 4.2 says **color is a status signal, not decoration.** StudioBinder uses color
as **per-area identity** (orange = Write, purple = Visualize, etc.) for wayfinding. Both are
valid; they are different systems and they can coexist if we are disciplined:

- Keep **status color** exactly as it is (tinted chips with a dot: pending, approved,
  changes requested). This stays our signal language.
- Introduce a **muted, desaturated per-phase accent** purely for workspace wayfinding
  (a phase icon tint, a left border, a section header), clearly quieter than status chips so
  the two never compete. This is not the loud rainbow of StudioBinder; it is a restrained
  version consistent with "when in doubt, simpler and cleaner wins."

Recommendation: adopt phase-based *organization* from StudioBinder, but render it in our
quieter visual language rather than copying their saturated tiles.

---

## 4. What to adopt, and what to deliberately NOT copy

### Adopt
1. **Phase-based project workspace.** Reorganize the project detail around production phases
   for commercial work. A proposed mapping (see section 5) that fits our existing features.
2. **Rich empty states + "how it works"** on every major surface.
3. **Short creation wizards with defaults** ("you can always change this later").
4. **Guided first-run setup cards** on the dashboard (create project, add logo, connect a
   tool), auto-dismissing as completed.
5. **Two-path creation** ("Start blank" OR "Start from images/assets/Drive/Figma"), which
   plays perfectly to our connectors.
6. **Contacts by production role** category filter.
7. **Production calendar grouped by phase** (evolve our dashboard calendar / production tab).
8. **Composable, sendable call sheet** (we have the layout; add block toggles + send +
   simple delivery/opened tracking, which our Gmail connector can power).

### Do NOT copy
- **The saturated full-color tile UI.** It fights our restrained visual direction. Use the
  quieter per-phase accent instead.
- **Film/TV-centric modules** (Stripboards, AV Scripts, Day-of-Days) as first-class. We are
  commercial/CPG, not scripted narrative. Adopt the *organizing idea*, not their module list.
- **Locking core usability behind PRO.** Their onboarding constantly upsells (Autofilled
  Call Sheets, Styles, Templates all PRO). Our bet is usability first; do not gate the
  obvious path.
- **A closed island.** Their weakness is no connectors. Our whole thesis is orchestration.
  Lean into it.

---

## 5. Proposed phase mapping for our project workspace

Map our existing features onto commercial-production phases, so the project detail becomes a
phase launcher instead of one long page + a separate Production tab set:

- **Brief** (define): Brief, references, moodboard/Boards link
- **Create** (make): Assets + versioning, Figma/Drive imports, Boards
- **Review** (approve): Client review links, approvals, internal review, outstanding flags
- **Plan** (produce): Shot board, call sheet, budget, gear & crew, calendar
- **Deliver** (close): Delivery + billing, final assets, activity/summary

This keeps everything we have built, but arranges it as "where is this job in its
lifecycle" rather than by data type. Communication and Activity stay as an always-present
rail so the conversation follows the job through every phase.

Naming is a placeholder; the point is phase-first organization in our quiet visual language.

---

## 6. Differentiators to protect (do not lose these while chasing polish)

- Connectors / orchestration (Gmail, Slack, Chat, Drive, Calendar, Figma).
- Lead -> Client -> Delivery CRM spine (StudioBinder has no front-of-funnel).
- Client review + approval loop as a first-class, focused surface.
- AI layer (summaries, drafted updates, outreach, stalled-work flags).
- Dual theme, token-first, stable asset-review environment.

---

## 7. Prioritized recommendations

Ordered by impact on a real commercial job vs effort. Phase references map to our roadmap.

1. **Reorganize the project workspace around production phases** (section 5), rendered in our
   quiet per-phase accent. Highest impact on our core usability bet. Medium effort; mostly a
   layout/IA change over existing features.
2. **Add rich empty states + "here's how it works"** to Projects, Boards, Production, Review,
   Communication. Low effort, high perceived-quality and self-teaching payoff.
3. **Guided first-run setup cards on the dashboard** (create project, add logo, connect a
   tool), auto-dismiss on completion. Low effort.
4. **Short creation wizards with defaults** for new project (type-driven) and new shot board /
   call sheet ("you can always change this later"). Low/medium effort.
5. **Two-path creation everywhere** ("Start blank" OR "Start from assets/Drive/Figma").
   Reuses our import UI; strong tie-in to connectors. Low/medium.
6. **Contacts/People by production role** filter (Crew / Talent / Client / Agency). Low.
7. **Sendable call sheet** (block toggles + send via Gmail connector + opened tracking).
   Medium; leans on connectors we already have.
8. **Production calendar grouped by phase** (Pre-Pro / Shoot / Post) as a timeline. Medium.
9. **Light onboarding personalization wizard** (2 to 3 steps) to set defaults. Optional; do
   after the above.

Suggested first move: #1 and #2 together, on one project, run a real job through it, let
friction pick the next item (our principle 4.5).

---

## 8. Screenshots still worth capturing (not blocking)

To sharpen the picture, additional StudioBinder shots that would help:
- The Breakdown / Stripboard editor and Lookbooks (to see their tagging/reference model).
- The call sheet Recipients + Preview & Send + delivery-tracking screens in full.
- Any sharing / client-facing view (how they present work for external review).
- The Media Library and Locations modules.

We have enough to act on sections 1-7 now.
