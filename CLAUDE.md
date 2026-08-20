# CLAUDE.md

This file is the operating context for building this product in Claude Code. Read it at the start of every session. It is the lean, build-facing reference. Deeper strategic context (the why, the market, the endgame) lives in PROJECT_BRIEF.md.

Note on naming: the product is named **Studio Flows** (domain studio-flows.com).
User-facing branding uses "Studio Flows" (wordmark) and an "SF" logo mark. This
document still often calls it "the Hub" from the placeholder era; treat those as
referring to Studio Flows (a doc cleanup, not a code one, since the code branding
is already renamed).

Note on writing style: no em dashes in any generated content (code comments, copy, docs, UI text). Use commas, colons, or parentheses instead. This is a standing preference.

---

## 1. What the Hub is, in one line

A connected pre-production hub for boutique commercial production studios that pulls a job's briefs, creative assets, versions, approvals, communication, and client and lead records into one organized home, built around how commercial production actually works.

## 2. Who it is for

Boutique to medium commercial production studios (food, beverage, CPG, and brand commercial work) and the brands and agencies they serve. The first user is the studio operator. The product is built for the operator first and used on real jobs before it is sold to peers.

## 3. Tech stack

- Framework: Next.js (App Router) with TypeScript
- Hosting: Vercel
- Backend and data: Supabase (Postgres, Auth, Storage)
- Styling: Tailwind CSS driven by design tokens (CSS variables), so light and dark themes are two value sets for the same tokens. Component library choice is open, but keep styling token-first from day one.

Do not change the stack without a deliberate reason noted here. This stack is chosen because it is proven for this builder and fast to ship with.

## 4. Core product principles

These govern every build decision. Weigh new work against them.

### 4.1 Usability is a primary differentiator (functional modern)
The space has several tools that do similar things. The Hub competes on being easier and more intuitive to use, not on having more features. Every feature should:
- require minimal clicks for the common path
- make the next action obvious
- map to how commercial production actually works (projects, shoots, clients, briefs, approvals), not to generic software patterns or database structure
- be usable by a busy producer on a live job without a tutorial

That last point is the bar. If a flow needs explaining, it is not done.

### 4.2 Visual design: refined, color as signal (visual modern)
The look should be thoughtfully designed and current, distinctive but not flashy or overdone. Reference the clarity of Monday.com and ClickUp, but diverge deliberately:
- Color is a meaningful status signal, not a decorative wash. Use small contained status tags (a tinted chip with a small dot), not full colored rows.
- Typography and whitespace carry the structure. The project name is the hero; client and dates sit quieter beneath.
- One confident brand accent color, used sparingly (brand mark, primary actions, active states), gives the product identity. Accent color is TBD, to be set with real design references.
- Surface the one thing that needs action (for example a pending approval) with a soft, quiet emphasis rather than anything loud.
- When in doubt, simpler and cleaner wins. Visual design always serves the functional experience and never competes with it.

### 4.3 Theming
- Build dual-theme (light and dark) from day one, token-first. Never hardcode colors.
- Default to following the user's system preference.
- Always include a manual toggle.
- Offer time-of-day auto switching only as an optional setting, off by default. Do not flip themes on people mid-task by default.
- Asset-review surfaces should lean toward a stable, neutral viewing environment, because the interface brightness affects how creative work is judged. Do not let the theme shift while a user is evaluating an asset.

### 4.4 Connection methodology: orchestrate, do not replace
The long-term architecture is that the Hub connects to the tools people already use (Figma, Google Drive, Gmail, billing, AI generation tools) and pulls their content into one project view, rather than forcing anyone to abandon those tools. Same idea as connectors in Claude: intelligence in the middle, reaching out to where data already lives.

Critical sequencing: this is the long-term architecture, not the v1 build. Live two-way integrations are the hardest, most finicky part and would stall progress if built first. Therefore:
- Build the Hub so it stands on its own first (manual entry and uploads).
- Design the data model from day one as connection-ready (nullable source and external-reference fields), so a connector can later populate an asset's Figma link or a project's billing record without a rebuild.
- Build actual connectors later, one at a time, starting with whichever removes the most tool-switching.

### 4.5 Ship the foundation, then layer (no two-year cave)
Build the foundation to a genuinely usable state, run a real job through it, then add the next layer. Each phase should be usable on a real job before moving to the next. One finished useful feature beats four half-built ones. Friction noticed during real use is the feature backlog.

## 5. Data model (the spine)

The spine runs from first contact to final delivery: Lead becomes Client, Client has Projects, a Project holds Briefs, Assets, Versions, Approvals, and Communication.

Entities and key relationships (plain language, not final schema):

- Lead: a prospect. Fields include company, source, pipeline stage (for example new, contacted, qualified, proposal, won, lost), notes, owner. Converts into a Client.
- Client: a brand or agency the studio works with (a converted Lead, or added directly). Has many Projects, has many Contacts.
- Contact: an individual person at a Client or Lead (agencies and brands have multiple stakeholders). Fields include name, role, email, phone. Belongs to a Client or Lead.
- Project: a single job or production. The central object. Fields include title, client reference, status (for example brief, in review, shooting, approved, delivered), due date, shoot date, owner and team. Has one Brief, many Assets, many Approvals, many Communication entries.
- Brief: the creative direction for a project. Fields include project reference, content, attachments.
- Asset: a creative deliverable or file in a project (image, video, storyboard, reference, cut). Fields include project reference, name, type, current version reference, status, and a nullable source field (manual upload now; later a connector link such as Figma or Drive). Has many Versions.
- Version: a specific iteration of an Asset. Fields include asset reference, version number, file or url, created date, notes. This is how nothing gets lost.
- Approval: a review or sign-off on an Asset or Version. Fields include target reference, reviewer (a Contact for client review, or a team member for internal review), status (pending, approved, changes requested), comments, timestamp.
- Communication / Activity: per-project messages, notes, and an activity timeline. Fields include project reference, author, content, type, timestamp, and a nullable external-thread reference for later email integration.
- User / TeamMember: people inside the studio using the app, via Supabase Auth. Operate across projects.

Connection-ready note: Asset.source, Project external references, and Communication external-thread id are nullable now and populated by connectors in a later phase. Include them in the schema from the start.

## 6. v1 scope

v1 is the foundation that everything else builds on, used on the builder's own next real job.

In scope for v1:
- Auth and studio team (Supabase Auth)
- The full data-model spine implemented in the database
- Basic CRM front of the spine: capture a Lead, set its pipeline stage, convert it to a Client, start a Project from it, so the whole lifecycle exists in simple form
- Project workspace: create a project tied to a client, a project list and board view (the refined, color-as-signal board design), and a project detail view
- Brief: attach and store a brief per project
- Asset upload and organization within a project, with manual versioning (upload a new version, see the version history)
- Basic status on projects and assets
- Internal activity and notes per project
- Dual-theme (light and dark), token-first, follow system preference plus manual toggle
- The refined visual design direction (color as signal, single brand accent TBD)

Explicitly NOT in v1 (deferred to later phases):
- Live two-way connectors (Figma, Drive, Gmail, billing). Architecture is connection-ready, but no connectors are built.
- A client-facing external review and approval portal. v1 keeps review internal.
- AI features (summaries, drafted updates, flags).
- The AI-video pipeline module (reference image to board to generation to organized takes) and previz or shot-list generation.
- Production-ops (bidding, quoting, budget bid-versus-actual, call sheets, gear, invoicing).
- Rich CRM (pipeline automations, follow-up triggers, outreach drafting).
- Time-of-day automatic theme switching (optional, later).

## 7. Roadmap (build order)

The order follows real grief: the stuff that hurts most on real jobs comes first. All of it sits on the same spine, so this is sequencing, not picking and choosing.

1. Phase 1 (v1): Foundation. The data-model spine, project home, basic Lead and Client records, brief, asset, manual versioning, internal activity, dual theme. Use it on a real job.
2. Phase 2: Creative and review layer. Client review and approval (comment and sign-off in one place), internal review separate from client review, deeper version tracking.
3. Phase 3: Communication layer. Centralized per-project communication that replaces scattered email threads, activity timeline, notifications and outstanding-action flags.
4. Phase 4: AI layer. Project summaries (where does this project stand), AI-drafted client updates, flagging stalled approvals and unactioned revision requests.
5. Phase 5: CRM and pipeline depth. Pipeline board, follow-up flags, outreach assistance, and eventually AI-drafted outreach.
6. Phase 6: Connections. Figma, Drive, Gmail, billing, added one at a time, starting with the one that removes the most tool-switching (likely the creative and feedback loop).
7. Phase 7: AI-video pipeline module. The forward-looking differentiator: organize the reference-image to board to generation to takes flow, track the version tree across an exploding set of generations, present takes cleanly for approval. Stay above the generation tools (organize, do not generate). Optionally previz and shot-list generation.
8. Phase 8: Production-ops. Bidding and quoting, budget tracking (bid versus actual), shoot-day logistics (call sheets, shot lists, gear), asset delivery, invoicing and billing status (connected to the billing tool).

## 8. Build conventions and guardrails

- Make each phase usable on a real job before starting the next. Do not boil the ocean.
- Token-first styling. Never hardcode colors. Both themes must always work.
- Hold every feature to the usability bar in section 4.1.
- Keep the visual direction in 4.2: refined, color as signal, single restrained brand accent, type and whitespace carry structure.
- Model the interface around production language, not generic software patterns.
- Keep the data model connection-ready (section 5) but build no connectors in v1.
- Update this file as decisions change, so it stays the single source of truth for the build.
- Maintain a running list of friction noticed during real use; that list is the live feature backlog.

## 9. Current status and next step

Strategy, scope, data model, and design direction are decided. Deployed on
Vercel (git-integration auto-deploy on push to `main`), live on Supabase
(project ref `wvcodunxakdiojgelbgc`). Naming still a placeholder ("The Hub").
The build has moved well beyond v1; the roadmap phases below have been largely
implemented (out of strict order, driven by the operator's real needs).

### Foundation (Phase 1) — done
- Next.js (App Router, TS) + Tailwind token-first OKLCH CSS vars; dual theme
  (data-theme system/toggle/localStorage) + data-accent (indigo). Fonts Plus
  Jakarta Sans + Hanken Grotesk. Token reference at /dev/tokens.
  THIRD THEME "paper" (BUILT): a warm neutral between light and dark, for long
  review sessions. Same token structure as light with the hue rotated from cool
  violet (282) to warm (around 80) and lightness dropped slightly: bg #f7f2e8,
  surface #fcfaf4, text #31271e. Contrast measured, not eyeballed (text/surface
  14.0:1, muted/surface 5.7:1, both clear AA). The status-chip backgrounds are
  darkened ~0.013 L and given +0.012 chroma because paper's surface is 0.985
  rather than pure white; without that the tinted chips separate LESS than they
  do on light. ThemePreference is now system|light|paper|dark and ResolvedTheme
  light|paper|dark ("system" only ever resolves to light or dark, since the OS
  reports nothing else). The two-state sun/moon flip became a small menu
  (components/theme-toggle.tsx) listing all four with a hint each; toggle() is
  kept as a light->paper->dark cycle for any existing caller. Print and export
  views still hardcode data-theme="light" on purpose.
- Supabase: full data-model spine, multi-tenancy (studios/memberships/roles),
  RLS scoped by `is_studio_member`, private `assets` storage bucket, signup
  studio-bootstrap trigger. Types in lib/database.types.ts (hand-maintained
  alongside migrations; add new tables to it when you add a migration).
- Auth (email/password), app shell (sidebar + topbar), Projects (list + board +
  detail with brief/assets/manual versioning/activity), Clients + contacts,
  Leads (pipeline + convert), Settings.

### Built since v1
- Dashboard home (KPI tiles, production calendar, My Day, Needs You, Upcoming,
  Pipeline, Recent activity, Messages; customizable widget show/hide).
- Communication: Gmail, Slack, Google Chat connectors (link threads/channels/
  spaces to a project/lead/client, read + reply/post, unread badge). Attachment
  handling: download, import to assets, attach on send (device files + project
  assets + Drive files). Visual attachment cards.
- Connectors (Phase 6): Google (Gmail + Chat + Drive + Calendar on one OAuth,
  scopes added incrementally) and Figma (separate OAuth). Drive: browse My Drive
  folders / search, import files as assets. Figma: paste file link, import
  frames as image assets. Calendar: two-way on the dashboard (view/create/delete
  events, Google Meet links, one-click join; can't embed the call). Settings →
  Connections manages all.
- Client review portal (Phase 2): per-asset public share link (`/r/[token]`,
  no login) to preview/comment/approve; feedback flows back into the project.
  Uses a SERVICE-ROLE Supabase client gated by token (lib/supabase/service.ts,
  lib/review-links.ts) + token-guarded file proxy. IMAGE assets get Frame.io-
  style PINNED comments: click the image to drop a numbered pin + matching
  comment, synced sidebar, resolve toggle (components/review/pin-review.tsx;
  review_comments gained pin_number/pos_x/pos_y/resolved_at in migration 0026;
  actions submitClientComment(pin) + resolveClientComment). VIDEO assets get
  timecode comments (components/review/video-review.tsx): pause + comment on a
  moment, markers on a timeline, click a comment to seek; review_comments.timecode
  (migration 0027); submitClientComment takes an optional timecode. Other file
  types keep the flat comment flow. PinReview/VideoReview are context-agnostic
  (parent passes onPost/onResolve). The in-app Review button (components/projects/
  review-modal.tsx, opened from AssetCard) reuses the SAME canvas: image -> pins,
  video -> timecodes, else flat, in an xl Modal, above the internal sign-off.
  Team + client comments share one stream per version (internal actions
  addReviewCommentAt / resolveReviewComment; no name gate for logged-in users).
  Modal gained a size prop (md/lg/xl).
- Generalized doc review (client-facing): the SAME Frame.io pin + approve/
  request-changes flow now works on whole doc surfaces, not just asset versions.
  review_links + review_comments gained nullable target_type/target_id (migration
  0030) and approval_target enum gained shot_list/storyboard/moodboard (migration
  0031). A doc link carries no asset/version: target_type in ('shot_list',
  'storyboard','moodboard'), target_id = project id (shot_list, the whole shot
  board) or boards.id (storyboard/moodboard). PinReview was refactored to
  delegate to a generic components/review/pin-canvas.tsx (pins over any surface
  node); components/review/doc-surface.tsx renders read-only shot list /
  storyboard / moodboard as the pinnable stage; components/review/doc-review.tsx
  is the portal shell (name gate + PinCanvas + decision). lib/review-links.ts
  gained gatherDocReview + DocKind/DocReviewData/DocSurface; r/[token]/actions.ts
  gained submitDocComment/resolveDocComment/submitDocDecision; share-actions.ts
  gained createDocReviewLink; components/review/share-doc-button.tsx is the
  "Share for review" button, wired into the shot list (subhead action), the
  storyboard editor header (per active board), and the moodboard (BoardsWorkspace
  reviewKind prop, per active board). /r/[token] branches on target_type: a doc
  link renders the live doc with pins, else the existing asset review.
- Doc review cycle (internal + external, two layers like assets): a doc can be
  put into the project's internal review pipeline so it shows on the Review page
  (/projects/[id]/review) alongside assets, grouped by the same status buckets
  (in_review / needs_changes / approved). doc_reviews table (migration 0032:
  studio/project/target_type/target_id/status, unique per target) is the pipeline
  row. Doc pages now carry a "Send to review" button (components/projects/
  send-to-review-button.tsx) instead of the client-share button; it calls
  sendDocToReview and, once in review, becomes a quiet "In review · View" chip.
  On the Review page each doc renders a DocReviewCard (components/review/
  doc-review-card.tsx): opens DocReviewModal (components/review/doc-review-modal.tsx
  = the SAME PinCanvas over DocSurfaceView + a team internal sign-off = the
  greenlight), and carries the client-share button (ShareDocButton, relocated
  here from the doc pages) so the flow is: send to review -> internal pins +
  greenlight -> share with client. Internal team comments reuse review_comments
  (author_id set, target_type/target_id); internal sign-off reuses approvals
  (target_type=kind, target_id, reviewer_user_id) and moves doc_reviews.status
  (approve->approved, request->needs_changes). doc-review-actions.ts:
  sendDocToReview / removeDocFromReview / addDocReviewCommentAt /
  resolveDocReviewComment / setDocApproval / getDocReviewDetail. Shared loaders:
  loadDocSurface (lib/review-links.ts, client-agnostic, used by both the service
  portal and the RLS internal path) + lib/doc-review-data.ts
  (loadDocReviewsForProject summary, loadDocReviewDetail for the modal).
- Produce band, real pages (were "Soon" stubs):
  - Project contacts (/projects/[id]/contacts): one roster per job, organized
    into FOLDER TABS (All / Crew / Talent / Extras / Clients) with counts.
    contacts gained project_id + company (0033) and type (category) + rate +
    notes (0035). Each production contact has a category (type) + position
    (role, a searchable combobox seeded from lib/crew-positions.ts POSITIONS by
    category, free text ok) + company + email + phone + day rate + notes. The
    linked client's contacts are merged in read-only under the Client folder.
    add/edit via contact-actions.ts (addProjectContact/updateProjectContact/
    deleteProjectContact; ContactInput carries type/rate/notes). components/
    projects/project-contacts.tsx = tabs + colored ContactCard (category top
    border + chip) + a lively on-brand ContactModal (category chips, PositionCombobox
    that actually opens, rate $/day, notes, Save & add another). Hub card shows
    roster count. (Multi-role per contact is a possible later add.)
  - Project calendar (/projects/[id]/calendar): month + agenda, NO Gantt
    (deliberate: a task-level Gantt is overkill/rots for short boutique jobs;
    the useful timeline is the STUDIO-wide slate view, one lane per project,
    now BUILT as a third view on /projects -- see "Studio slate" below). Shows the project's shoot_date/due_date as read-only milestones
    plus project_events (migration 0034: title/date/end_date/kind/notes; kinds
    prepro/shoot/review/delivery/other, colored) which the producer adds/edits/
    deletes. components/projects/project-calendar.tsx + calendar-actions.ts
    (addProjectEvent/updateProjectEvent/deleteProjectEvent). Multi-day events
    expand across the range in month view. Not wired to Google Calendar (the
    dashboard calendar covers account-wide Google events); this is the
    project's own dates. Hub card shows next date / event count.
- AI layer (Phase 4): provider-agnostic (lib/ai.ts, Anthropic or OpenAI).
  Project summary, AI-drafted client update, AI-drafted lead outreach. Rules-
  based (no-LLM) stalled-work flags (lib/outstanding.ts) and lead follow-up
  flags (lib/leads-followup.ts).
  POLISH BUTTON (composer rewrite, BUILT): a Gmail-style "polish this before I
  send it" in every Communication composer (Gmail reply in components/projects/
  project-email.tsx, plus the Slack and Google Chat panels). Entirely manual:
  nothing runs until pressed, nothing is sent, the producer reads/edits the
  result and presses Send themselves. Menu of four intents (Polish / Shorten /
  Warm up / Firm up); the rewrite replaces the composer text in place and an
  Undo restores the original verbatim (shown only while the box still holds
  exactly what the rewrite produced, so it cannot clobber later edits or
  reappear over a fresh message after a send). lib/ai.ts gained polishMessage +
  POLISH_INTENTS/isPolishIntent and a per-call CompleteOpts ({fast, maxTokens}):
  `fast` swaps in ANTHROPIC_FAST_MODEL (haiku) and sends a plain request, since
  adaptive thinking + output_config are main-model only. It is a NO-OP on the
  OpenAI path (the deployment's actual provider: OPENAI_API_KEY is set in
  Vercel, so polish runs on gpt-5-mini, already the small model). maxTokens is
  4000 there because on a reasoning model that budget also covers reasoning
  tokens; openaiComplete now throws a plain "too long to finish" when a call
  comes back empty with finish_reason 'length'. Server action
  app/(app)/polish-actions.ts polishDraft (auth + aiConfigured + 8000-char cap;
  never given project data, so it cannot invent facts). The button hides itself
  when no provider key is set, via components/ai/ai-availability.tsx (a context
  set once from aiConfigured() in the app layout) rather than threading a prop
  through every page with a composer. AnchoredPopover moved components/review ->
  components/ui since it is now shared.
- CRM depth (Phase 5): leads pipeline board, follow-up flags, AI outreach,
  editable lead notes. NOTE: superseded by the CRM restructure below (leads ->
  deals); the old leads UI is dormant (routes redirect), tables preserved.
- CRM restructure -> Accounts + Contacts + Deals (migration 0054) — Phase 1 of a
  full CRM. The old lead-centric model (one `leads` row = company + a single
  stage) could not represent repeat business (one company, many jobs over time),
  so the pipeline is now DEAL-centric:
  - Accounts REUSE the `clients` table (no rewiring of projects/contacts FKs): a
    company that can be a prospect before it is a client. Added `account_status`
    (prospect | active | past, default active), `owner_id`, `source`. Prospects
    show on the Clients page (a status-filter tab strip, components/clients/
    clients-table.tsx); winning a deal flips its account to `active`.
  - Deals = the pipeline object (`deals` table): title, value, probability,
    stage, expected_close_date, owner_id, source, notes, won_project_id,
    lost_reason, closed_at, sort. `deal_stage` enum inbound -> qualifying ->
    bidding -> awarded(won) / lost (stage doubles as status: awarded=won,
    lost=lost, rest open). Constants in lib/status.ts (DEAL_STAGE/_ORDER,
    DEAL_OPEN_STAGES, ACCOUNT_STATUS); money() formatter in lib/format.ts.
  - UI: /pipeline (deal board by stage w/ per-column count + summed value; list
    view; Mine/Everyone owner filter; open-pipeline value) + /pipeline/[id]
    (deal detail: editable fields, stage menu, mark lost w/ reason, delete,
    account's contacts read-only). New deal picks an existing account or creates
    a prospect inline. components/deals/*, app/(app)/pipeline/{page,[id],
    actions}. Nav "Leads" -> "Pipeline"; /leads + /leads/[id] redirect to
    /pipeline. Dashboard pipeline widget + KPI now read deals (open-deal count +
    open pipeline value), not leads.
  - Migration 0054 copies leads forward (converted lead -> won deal on its
    client; un-converted -> prospect account + open/terminal deal + repoint its
    contacts) and PRESERVES the leads table for rollback. leads-followup.ts /
    lead-context.ts / leads/actions.ts remain but are dormant (unused by the
    dashboard now).
  - CRM Phase 2 (BUILT, migration 0055): relationship activity timeline +
    tasks/reminders, both hanging off Account + Deal. crm_activities
    (studio/account_id/deal_id/kind/body/author_id/occurred_at; kind enum
    crm_activity_kind = note|call|meeting|email + system stage_change|created|
    won|lost) and crm_tasks (studio/account_id/deal_id/title/notes/due_date/
    done/done_at/assignee_id/created_by). An entry ALWAYS carries account_id
    (derived from the deal when logged on a deal) so an account's timeline/tasks
    roll up all of its deals' entries while a deal shows just its own. Constants
    CRM_ACTIVITY / CRM_MANUAL_ACTIVITY in lib/status.ts. Server actions in
    app/(app)/pipeline/crm-actions.ts (logActivity/deleteActivity/addTask/
    toggleTask/deleteTask + recordDealEvent, a server-internal helper). Pipeline
    actions (createDeal/updateDealStage/markDealLost) now emit system activity
    events (created / Moved to X / won / lost). UI: components/crm/
    activity-timeline.tsx (kind-pill composer + timeline) + components/crm/
    task-list.tsx (add w/ due date, check to complete, delete), shown on the
    deal detail page (/pipeline/[id]) and the account detail page (/clients/[id],
    which also gained a Deals card + account_status chip). Dashboard got a
    customizable "Tasks" widget (components/dashboard/task-widget.tsx: open tasks
    by due date, overdue in red, one-click complete, link to deal/account).
    Assignee defaults to the creator (no picker yet); author attribution on the
    timeline is not surfaced yet (both deferred).
  - CRM Phase 3 slice 1 (BUILT): comms auto-logging onto the relationship
    timeline (the moat), starting with EMAIL. No new tables/sync infra: a
    read-time merge (lib/crm-feed.ts loadAccountFeed) interleaves manual
    crm_activities with the account's LINKED email threads (email_threads by
    client_id -> subject + last_message_at, no Gmail API call) into one
    FeedEntry[] stream, and computes lastContactAt (most recent real contact:
    linked email or a logged call/meeting/email, ignoring system stage events).
    components/crm/relationship-feed.tsx (composer + merged read-only feed;
    email entries badged "auto", not deletable) replaces ActivityTimeline on the
    account page (/clients/[id]); "Last contact <ago>" shows in the account
    header + Activity card. The deal page keeps the manual-only ActivityTimeline
    (email links to accounts, not deals). NEXT slices (not built): Calendar
    meetings matched to an account by attendee email (needs a
    listEventsWithAttendees in lib/googlecalendar.ts + per-page fetch, guarded on
    calendar scope), then Slack/Chat message activity.
  - NEXT CRM phases (not built): reporting/forecast + AI next-best-action
    (Phase 4), saved views/CSV import/custom fields/dedupe (Phase 5). All hang
    off the Deal/Account objects, so each is additive.
- Boards: freeform moodboard/storyboard canvas (studio-wide, project-linkable),
  tabs, drag/resize/z-order, notes, zoom, desktop drag-drop, dots/grid/plain
  background; import via upload/project assets/Drive/Figma.
  - Milanote-like card types (Slice 1): a slim vertical TOOL RAIL on the canvas
    edge (Note / To-do / Link / Upload, divider, then Project assets / Drive /
    Figma; icon buttons w/ hover labels, components/boards/boards-workspace.tsx
    RailBtn) replaced the scattered add buttons. LINK
    cards: paste a URL -> lib/unfurl.ts fetches og/twitter meta (title/desc/
    image, SSRF-guarded via isFetchableUrl), the preview image is downloaded to
    storage; board_items kind='link' (url=destination, name=title, text=desc,
    storage_path=thumb). TO-DO cards: kind='todo', items as JSON in text
    ([{id,text,done}]), checkbox+inline-edit rows. No migration (reused
    board_items url/text/storage_path). BoardItemView gained url + thumbUrl
    (thumbUrl = signed storage image only, so a link's destination url is never
    misread as an image). actions: addLinkItem/addTodoItem/updateItemText.
    The "+ Add" dropdown was later replaced by a slim vertical TOOL RAIL on the
    canvas edge (RailBtn icon buttons w/ hover labels).
  - Columns / stacks (Slice 2, migration 0050): board_items gained parent_id
    (self-FK, on delete cascade) + sort. A column is kind='column' (title in
    name, only width meaningful, height flows from children). Top-level items
    stay absolutely positioned (parentId null); a column's children flow inside
    it ordered by sort and are NOT absolutely draggable (reorder via up/down,
    pop-out via detach). DRAG-INTO-COLUMN: on pointer-up of a top-level card,
    board-canvas columnAtPoint() hit-tests DOM rects of [data-column-id] and
    calls attachToColumn. In-column "+ Note / + To-do" add children directly
    (addNote/addTodoItem gained an optional parentId); other kinds get in by
    dragging. actions: addColumn/attachToColumn/detachFromColumn/setColumnOrder/
    updateItemName; BoardCanvas gained an onReload prop (workspace passes
    reload) used after structural changes.
  - Connection lines/arrows (Slice 3, migration 0051): board_connections table
    (studio/board/from_item_id/to_item_id, RLS is_studio_member, cascade on
    board_items delete). Drawn as an SVG overlay behind cards (edgePoint() trims
    each arrow to the card border; arrowhead marker). Create by dragging from a
    selected card's connect anchor (right-edge dot) onto another card
    (itemAtPoint() hit-tests [data-item-id] DOM rects on pointer-up ->
    addConnection). Click a line to select -> a delete X at its midpoint. Live
    rubber-band line follows the cursor while connecting. Only top-level items
    connect (endpoints inside columns are skipped). actions: getBoardConnections/
    addConnection(dedup either direction)/deleteConnection; workspace loads
    connections alongside items in reload() and passes them to BoardCanvas. This
    completes the Milanote arc (link cards, to-do, columns, connections).
  - Standalone line/arrow objects (no migration; kind='line' board_items row,
    endpoints + style as JSON in text via lib/board-line.ts parseLineData). Rail
    gets a Line tool (addLine). Rendered in their own interactive SVG above cards
    (only stroke + endpoints capture pointer events, so cards stay clickable);
    both endpoints drag, the body drags the whole line (lineDrag ref + effect in
    board-canvas). Selecting a line (selectedLineId lifted to the workspace via
    onSelectLine) swaps the tool rail for a LineStylePanel (boards-workspace):
    color swatches, start/end arrowheads, solid/dashed, weight, an optional
    label, delete. Style edits persist through updateItemText (reused); no new
    action beyond addLine.
  - Drag tools from the rail onto the board (RailBtn dragKind + HTML5 DnD;
    canvas onDrop reads dataTransfer 'application/x-board-tool' -> onDropTool
    creates at the drop point). Click still adds at a default spot.
  - Delete/Backspace removes the selected card/column/line/connection (guarded
    against firing while typing in an input/textarea/contentEditable).
  - UNDO/REDO (snapshot-based, the audit's Tier-2 item, boards first): a captured
    {items, connections} snapshot is replayed by restoreBoardState (app/(app)/
    boards/actions.ts) which reconciles the DB (upsert parents-then-children with
    original ids so connections/parents survive, delete extras, upsert+prune
    connections). lib/use-board-history.ts (useBoardHistory: undo/redo stacks,
    cap 60, capUndo/canRedo). BoardItemView gained storagePath so image cards
    reconstruct on undo (also fixed lib/board-share.ts mapping). Workspace holds
    the hook: pushHistory() captures pre-edit state at every mutation entry
    (adds, panel edits, delete); doUndo/doRedo apply the snapshot to local state,
    persist via restoreBoardState, reload for fresh signed URLs, toast Undone/
    Redone; history.reset() on board switch (per-board). Keyboard Cmd/Ctrl+Z /
    Cmd/Ctrl+Shift+Z (or Ctrl+Y), guarded while typing. Toolbar Undo/Redo buttons
    (disabled on empty stacks). Canvas captures gesture-level snapshots via an
    onBeforeChange(before) prop: captureBefore() clones pre-gesture state at
    startMove/startResize/line-drag, pushed at pointer-up ONLY if the pointer
    actually moved (>0.5px, so a plain click records nothing); discrete ops
    (connect/delete/attach/detach/reorder/note+heading blur) push immediately.
  - UNDO/REDO rolled onto the SHOT LIST + STORYBOARD editors (generic engine):
    lib/use-history.ts (useHistory<T>, same stacks/cap as boards) + reconcile
    actions restoreShotBoard (board-actions.ts, groups+cards) and
    restoreStoryboard (storyboard-actions.ts, one board's frames). CardView +
    FrameView gained storagePath/mimeType so image rows rebuild on undo. Both
    editors are prop-based (server state) + a central act()/bulk() dispatcher:
    capture at the top of act/bulk (bulk = ONE undo), and at each field on-blur
    ONLY when the normalized value changed (guarded, so an untouched blur records
    nothing) via an onCapture prop threaded into ShotRow/FrameCard. doUndo/doRedo
    replay the snapshot through the reconcile action + router.refresh() + toast;
    same Cmd/Ctrl+Z / Shift+Z keyboard + toolbar buttons. Shot list needs no
    reset (one board/project); storyboard resets history on active-board switch
    (per-board frame snapshots). Wiring done via subagents against a precise spec,
    reviewed + build-verified.
  - Card selection is LIFTED to the workspace (selected/onSelect props on
    BoardCanvas) so it can render contextual panels over the tool rail, same as
    the line panel. NOTE cards are now rich text (contentEditable storing HTML;
    NoteBody in board-canvas, seeded once, saves on blur via updateItemText) with
    a two-tab NotePanel (boards-workspace): Text tab = execCommand formatting
    (bold/italic/underline/strike/lists/link/clear, applied to the focused note
    via a data-item-id query + preventDefault), Box tab = color swatches
    (updateItemHue). The per-note inline color/delete header was removed in favor
    of the panel. Applying the same contextual-panel pattern to the other card
    types (link/todo/image/column) is the next step.
- Shot list (own page, off the production tab strip): /projects/[id]/shot-list
  renders ShotBoardEditor as a StudioBinder-style two-pane: LEFT sidebar = the
  project's shot lists (each shot_group = one list, with count + "New shot list"),
  RIGHT = the active list's shots as ROWS. Each row: select checkbox + asset
  selector (pick a project asset via setCardAsset, or upload) + Description +
  Shot Size + Shot Type + Camera Movement (datalist comboboxes, free text ok) +
  compact code/day. Selecting rows shows a toolbar: Duplicate / Move to
  (another list) / Delete + select-all (duplicateCard, moveCard, deleteCard;
  bulk = client loop). Cover (client/agency/director/etc.) lives in a collapsible
  "Cover". New lists seed 3 empty shots. shot_cards gained
  shot_size/shot_type/movement/asset_id (migration 0025). The flavor feature
  (palette + per-row tag) was removed from the UI; flavor_name/flavor_hue columns
  remain unused. Present/export view still at /production/board (list selector:
  all or one). Hub card links here.
- Production-ops (Phase 8): four SEPARATE pages, each linked from the hub's
  Produce band (no more shared tab strip): Call sheet (/projects/[id]/callsheet,
  industry layout, PDF export still at /production/callsheet), Budget
  (/projects/[id]/budget, bid vs actual), Gear & crew (/projects/[id]/gear),
  Delivery + billing (/projects/[id]/delivery). Each page = ProjectSubhead +
  the module component in a Card; server actions (actions.ts/budget-actions.ts/
  ops-actions.ts) revalidate their own page. Old /projects/[id]/production (and
  its ?tab= deep links) now redirect to the hub; production-tabs.tsx removed.
  PDF export = print view with app chrome hidden and forced light/exact colors.
  Call sheet is MULTI (like shot lists): call_sheets dropped its one-per-project
  unique + gained title/status/position (migration 0036); the page is a
  StudioBinder-style two-pane (components/production/callsheet-workspace.tsx:
  left = list of sheets w/ status chip + date + New call sheet; right = active
  sheet editor). Per-sheet actions in app/(app)/projects/[id]/callsheet-actions.ts
  (createCallSheet/renameCallSheet/setCallSheetStatus/deleteCallSheet/saveCallSheet
  by id + entry CRUD by call_sheet_id). call-sheet.tsx takes callSheetId; PDF
  export at /production/callsheet?cs=<id>. (Old call-sheet actions in
  production/actions.ts are now dead.)
  BLOCK-BUILDER editor (edit-on-the-sheet, WYSIWYG): the active sheet renders as
  the REAL call sheet you edit in place. Top is a fixed MASTHEAD (industry
  layout, always shown): left = studio logo (from Settings->Branding, passed
  page->workspace->builder as logoUrl; dashed "Add logo" link if none) + company
  + key contacts; center = production title + a CALL badge (general call time,
  date, day-of) + shooting call; right = info table (breakfast/lunch/wrap/
  sunrise/sunset/weather). Below the masthead are reorderable BODY blocks.
  call_sheets gained layout jsonb + accent (migration 0037). lib/callsheet-blocks.ts = block model
  (CallSheetBlock, FIXED_BLOCKS header/schedule/locations/contacts/company/cast/
  crew/notes, defaultLayout, normalizeLayout). components/production/
  callsheet-builder.tsx (replaces the old form CallSheet in the workspace):
  fixed blocks map to the structured columns (edit-in-place, save on blur);
  custom "text" blocks store title/body in layout; per-block hover rail =
  move up/down + hide (fixed) / remove (text); "Add block" palette re-adds
  hidden blocks or a custom text block; accent color picker. Persists via
  saveCallSheetLayout / saveCallSheetAccent (callsheet-actions.ts). The print
  view (/production/callsheet) honors hidden blocks + custom text blocks +
  accent, but keeps the industry 3-col header layout (full section reorder in
  the PDF is not yet reflected).
  SEND + ENGAGEMENT TRACKING: per-recipient shareable links with view/confirm
  tracking (like the client review portal, no in-app email). call_sheet_recipients
  (migration 0038: name/email/token/viewed_at/confirmed_at). The read-only sheet
  renderer was extracted to components/production/callsheet-document.tsx (shared
  by the print/export view AND the public page). Public page /c/[token]
  (force-dynamic, noindex, service-role gated by token): records viewed_at on
  open, shows a Confirm bar; app/c/[token]/actions.ts recordCallSheetView +
  confirmCallSheet (sets confirmed_at + activity + notification
  'callsheet_confirmed'). Loaders in lib/callsheet-links.ts. In-app: a "Send"
  button in the sheet header opens a RecipientsPanel (components/production/
  recipients-panel.tsx) = add name/email OR check people from the project
  contacts roster (production + linked client contacts, passed page->workspace->
  panel as contactOptions; already-added filtered out) -> copy that recipient's
  /c/<token> link, with Viewed/Confirmed columns; recipient actions
  addCallSheetRecipient/addCallSheetRecipients(bulk)/deleteCallSheetRecipient in
  callsheet-actions.ts. The
  Send button shows confirmed/total.
  TEMPLATES + DRAG-AND-DROP: call_sheet_templates (migration 0039, studio-scoped
  name/layout/accent). The builder toolbar has a Templates menu: save the current
  layout+accent as a named template, apply a saved one to the active sheet
  (client sets layout+accent + persists), or delete. Templates loaded studio-wide
  in the page -> workspace -> builder. Body blocks now reorder via native HTML5
  drag-and-drop (grip handle in the block rail; the up/down arrows remain).
  Actions saveCallSheetTemplate/deleteCallSheetTemplate. NEXT (later): optional
  in-app email send; per-sheet logo; full PDF section reorder.
- Studio logo upload (Settings → Branding); shows on sidebar, call sheet, shot
  board cover.
- Modals render via portal to document.body (avoids fixed-in-transform bugs).
- Notifications layer: studio-scoped `notifications` table (0024), bell dropdown
  in the topbar (unread badge, poll, mark read/all, needs-you row); client
  review actions generate notifications (lib/notifications.ts).
  PER-USER READ STATE (migration 0073): `notifications.read_at` was ONE SHARED
  FLAG, so in a multi-person studio whoever opened the bell first cleared it for
  everyone and a notification meant for the producer could be marked read by a
  colleague who only glanced at it. A notification is still a studio-wide
  BROADCAST; only "have I seen this" moved to `notification_reads`
  (studio/notification/user/read_at, UNIQUE on (notification_id, user_id) so a
  second mark is a no-op). Its RLS is deliberately NOT is_studio_member but
  `user_id = auth.uid()`, since a read mark is personal; the WITH CHECK also
  requires is_studio_member, so you cannot mark in a studio you have left.
  getNotifications reads the rows, then this viewer's read rows, and writes the
  per-user value INTO each item's `read_at`, which is the field the bell already
  rendered, so components/app-shell/notification-bell.tsx needed no change at
  all. markAllNotificationsRead only marks the same LIMIT the bell shows, not
  the studio's whole history, so clearing a badge cannot silently bury things
  nobody saw. The migration backfills a read row for every current member of any
  notification already marked read, otherwise the bell would look alarming on
  first load after deploy. `notifications.read_at` is RETIRED (commented as
  such in the DB, never read or written) and kept only for rollback.
- Project workspace is a colorful, everything-upfront HUB (StudioBinder-inspired
  launcher; the operator asked for bolder + more visible, NOT dialed down):
  /projects/[id]/page.tsx = hub (hero w/ gradient bar + status + lifecycle
  stepper, KPI row, AI summary, then module cards grouped in phase bands
  Plan (Brief, Assets) / Visualize (Storyboards, Shot list, Moodboard) /
  Review (Review & approvals, Communication) / Produce (Project contacts,
  Calendar, Call sheet, Budget, Delivery & billing), + a right
  rail of Needs-attention + Activity. Visualize's Storyboards + Moodboard are
  SEPARATE project pages, distinct from each other and from the studio-wide
  /boards. Storyboards (/projects/[id]/storyboards) = a STRUCTURED frame grid
  (StudioBinder-style): a storyboard is a boards row (kind='storyboard') and its
  ordered frames live in storyboard_frames (image + scene/description/sound/notes;
  migration 0029). components/production/storyboard-editor.tsx (two-pane: list of
  storyboards + active board's frame grid; per-frame upload/asset-pick);
  storyboard-actions.ts. Moodboard (/projects/[id]/moodboard) + the global /boards
  use the freeform BoardsWorkspace; boards.kind ('general' = left-nav scratch,
  else 'moodboard'/'storyboard') + project scope separate them (migration 0028).
  In Visualize, Storyboards comes before Shot list (it's the earlier step). Each
  module card shows LIVE data (brief snippet, asset thumbrows + status, review
  actions, comms counts, shot count, call sheet date, budget bid-vs-actual bar,
  delivery progress) and links to its own focused page:
  /projects/[id]/{brief,assets,review,communication,callsheet,budget,gear,delivery}
  (deep-link via initialTab). Assets vs Review split (operator's mental model):
  Assets = the full project LIBRARY (all files/refs, any status; upload/import);
  Review (/projects/[id]/review) = only assets in the review cycle (status
  in_review/needs_changes/approved), grouped by state, each opening the
  pin/timecode canvas + share. Move an asset into review via its AssetStatusMenu
  ("In review"). Shared asset loader: lib/project-data.ts (loadProjectAssets).
  Card shell + band label: components/projects/hub-card.tsx; sub-page header:
  components/projects/project-subhead.tsx. Module color = IDENTITY (icon tiles,
  band dots); status stays as chips (StatusTag) so the two color systems never
  compete. Client update card lives on the communication sub-page. Rationale +
  backlog: docs/competitor-research/assessment.md.
- Project archive (soft, non-destructive): projects.archived_at (migration 0040,
  null=active). Delivery stays a manual status; archiving is a deliberate click.
  actions.ts archiveProject/unarchiveProject (+ activity log). Archived projects
  are excluded from the Projects list/board default AND the dashboard query
  (.is("archived_at", null)); ProjectsView has an "Archived (n)" toggle to view
  them. Hub hero carries components/projects/archive-project-button.tsx (Archive
  w/ inline confirm -> back to /projects; Unarchive when archived). Single
  project pages still open when archived; the client detail page still lists a
  client's archived projects (history). NO hard delete yet (deferred; would also
  need to purge storage blobs).
- EmptyState (components/ui/card.tsx) supports rich empty states with an optional
  "here's how it works" 3-step row + hue; used on Projects/Leads/Clients/
  Communication/project Assets/project Review, and (added later) on the BOARDS
  workspace, the SHOT LIST editor, and the STORYBOARD editor, which previously
  showed a bare "none yet, create one" line. Per the competitor assessment these
  are the surfaces where a blank screen was costing us the "usable without a
  tutorial" bar.
- STUDIO SLATE (BUILT): the studio-wide timeline that the per-project calendar
  note kept pointing at. It is a THIRD VIEW on /projects (Board | List | Slate),
  not a new page and not on the dashboard calendar widget: it is the same
  project collection the page already loads, so it inherits the Archived toggle
  and any future filters, and costs no nav weight. (If a top-level Calendar page
  ever holds month + agenda + slate together, revisit.) lib/slate.ts is pure
  date logic (parses YYYY-MM-DD as UTC midnight so no timezone can shift a day):
  buildLanes() turns projects + project_events into per-lane SEGMENTS
  (prepro | shoot | post | delivered | overdue | undated), shootCollisions()
  finds days carrying more than one shoot. Producer-entered project_events win
  when a project has them; otherwise a lane is derived from created_at ->
  shoot_date -> due_date. Two rules worth keeping: a project past its due_date
  and not `delivered` draws an OVERDUE bar that runs to today (the overrun is
  the point), and `undated` is judged on the project having no dates AT ALL,
  never on whether anything drew in the current window (an early version
  labelled out-of-window projects "No dates set", which is a lie). Lanes with
  nothing in the window are omitted and counted in the legend.
  components/projects/project-slate.tsx renders it as ONE horizontal scroller
  containing a single CSS grid whose rail column is position:sticky left:0, so
  labels and lanes cannot drift apart; 4/6/12-week ranges persist in
  localStorage ("projects.slate.weeks"), paging moves whole weeks so columns
  never shift. `todayIso` is computed on the SERVER and passed down, matching
  the dashboard calendar, so the today line cannot differ between the server
  render and hydration. NOTE: Tailwind's /opacity modifier compiles to NOTHING
  on a var()-valued color in this setup (verified against the built CSS), so
  weekend tinting uses an inline color-mix; existing `bg-surface-2/50`-style
  classes elsewhere in the codebase are silently no-ops.
- FIRST-RUN SETUP CHECKLIST (BUILT, dashboard): lib/setup-steps.ts loadSetupSteps
  derives five steps (add a client / start a project / add your logo / connect a
  tool / invite your team) from REAL DATA (count queries + ctx.studio.logo_path),
  not from a "seen it" flag, so a step that gets undone correctly comes back and
  there is no stored state to drift. components/dashboard/setup-checklist.tsx
  renders them above the dashboard body with a quiet per-step left accent
  (wayfinding, deliberately lighter than a status chip); the whole block hides
  itself once every step is done, and a manual "Hide" persists in localStorage
  ("dashboard.setupDismissed") since it is a per-person preference about a hint,
  not studio state worth a migration.
- Bolder visual language rolled app-wide (operator wanted it less dialed down):
  shared IconTile (components/ui/icon-tile.tsx) = colored per-hue rounded icon
  chip for identity/wayfinding. PageHeader takes icon+hue and draws a quiet
  gradient accent under every page top. Dashboard StatTiles have a colored edge
  + tinted chip; dashboard section cards (TitledCard) have colored icon headers;
  Projects + Leads boards have tinted per-status/stage column headers with a
  colored top border. Status stays as chips (StatusTag); module/section/nav color
  is identity, kept separate so the two never compete.

### Email reply attachments: TWO separate bugs (both FIXED)
They produced the same symptom (attach a file, the email sends without it) but
hit different paths, and the first one masked the second.

**1. Device files never left the browser.** components/projects/project-email.tsx
addFiles() did:
```
setFiles((prev) => [...prev, ...Array.from(list)]);   // deferred
if (fileInputRef.current) fileInputRef.current.value = "";  // immediate
```
A FileList is a LIVE view of the input's selection, and resetting `value` empties
it. React batches state updates from event handlers, so the updater closure (and
the `Array.from` inside it) runs AFTER the handler returns, by which point the
list is empty. `files` stayed `[]`: no chip in the composer, no `files` entries
in the FormData, and server-side `attachments.length === 0` so sendGmailReply
took its plain-text branch. Fix: copy the FileList to an array FIRST, then clear
the input. Every other file input in the app (assets-dropzone, boards-workspace,
pipeline-workspace) already read-then-cleared; only this one had it backwards.
Worth remembering as a general rule: never read a FileList inside a setState
updater.

**2. The multipart MIME was malformed** (would have dropped PROJECT ASSET and
DRIVE attachments, which are collected server-side and so were never affected by
bug 1). See below.

### Email reply attachments: MIME bug (FIXED)
Attaching a file to a Gmail reply sent the email but silently dropped the
attachment. The cause was in lib/gmail.ts sendGmailReply: the multipart branch
built the whole message as an array and ended it with `.filter(Boolean)`. That
was meant to drop the optional In-Reply-To / References headers when empty, but
it also deleted the intentional `""` entries that are the MANDATORY blank lines
separating MIME headers from bodies. Gmail then never saw a multipart body,
accepted the send (HTTP 200), and rendered a plain message with no attachment.
Now only the optional headers are filtered; the structural blank lines are
built separately and carry comments saying what they are. Verified by decoding
the base64 `raw` the builder produces (harness kept in the session scratchpad).

### Attachment size limits: TWO ceilings, not one (lib/attachment-limits.ts)
The first fix applied ONE cap to the total, which wrongly blocked a Drive file
("over the 4MB limit") even though a Drive file never crosses the constrained
boundary. Attachments arrive by two routes and only one is ours to limit:
- `MAX_UPLOAD_BYTES` (4MB): a DEVICE file goes browser -> Server Action ->
  Gmail, so its bytes cross the ~4.5MB serverless request body. Over that, the
  request dies at the platform edge before our code runs, so it cannot be
  explained: the click just appears to do nothing. Checked in
  sendReplyWithFiles against the device files ONLY, and mirrored client-side in
  the composer (running byte total, Send disabled) so it is caught pre-upload.
  next.config.mjs raises Next's own `serverActions.bodySizeLimit` to 12mb,
  which does NOT lift the platform cap.
- `MAX_EMAIL_BYTES` (25MB): PROJECT ASSETS and DRIVE FILES are fetched
  server-side (collectAssetAttachments / getDriveFileBytes), so the only thing
  bounding them is Gmail's own limit. Checked in deliverReply on the assembled
  total.
The constants live in lib/attachment-limits.ts rather than the actions file
because a "use server" module can only export async functions and the composer
needs them client-side.
GMAIL UPLOAD URI: the plain `messages/send` endpoint takes the message
base64url-encoded inside JSON (a third bigger) and has its own request limit,
so it could not carry 25MB. sendGmailReply now switches to
`/upload/gmail/v1/users/me/messages/send?uploadType=multipart` (35MB ceiling)
when the raw MIME exceeds PLAIN_SEND_LIMIT (4MB): a multipart/related body with
a JSON part carrying `threadId` (so the reply stays threaded) and a
`message/rfc822` part carrying the raw bytes, no base64 inflation. Small sends
keep the original proven path. The outer boundary is generated separately so it
cannot collide with the message's own. Request SHAPE verified locally (routing,
both blank-line separators, threadId part, closing delimiter, byte fidelity);
the large path has NOT yet been exercised against the live Gmail API.

OVER GMAIL'S LIMIT: A DRIVE LINK INSTEAD OF BYTES (BUILT), mirroring what Gmail
itself does. A picked Drive file that would push the message past
MAX_EMAIL_BYTES is not attached; its `webViewLink` is appended to the reply body
under a "Shared file(s):" heading. splitDriveByLimit (lib/attachment-limits.ts)
does the split on a RUNNING TOTAL, not per file, so three 10MB files do not all
attach and then dead-end on the message-level check: the ones that no longer fit
simply become links. Google-native docs (Docs/Sheets/Slides) report size 0 and
always attach, since they export small. The server does the authoritative split
because it is the only side that knows how big the project assets are; the
composer mirrors the unambiguous per-file case (a `link` badge on the chip) so
the substitution is visible before sending.
SHARING IS WARN-AND-ALLOW, NOT AUTO-FIXED. lib/googledrive.ts now selects
`webViewLink` + `shared` in its fields param, so we can SEE whether a file is
link-shared. We cannot change it: writing a permission needs the full `drive`
scope, which is a Google RESTRICTED scope (verification + an annual third-party
security assessment), far too much to buy a checkbox. So when a file is headed
out as a link and is not shared, the composer shows an amber warning naming the
files, with a direct "Open in Drive" link to flip sharing, and still lets the
send go. Sending anyway is a legitimate choice: the recipient gets a
request-access prompt, which for an internal recipient is often fine.

### Stage vocabulary + stage controls (BUILT, no migration)
The four DB phases never change (`pre_pro -> shoot -> post -> delivered`); only
their labels do. The default label for the middle phase is now **"Production"**,
not "Shoot": that is the industry's own generic term (pre-production /
production / post-production) and the only one true across a live-action shoot,
a CG build, and a generated sequence. "Shoot" is the live-action SPECIALIZATION,
so it is now an override rather than the default. STAGE_LABELS in
lib/project-types.ts: live_action + commercial -> {shoot: "Shoot"}, ai_video ->
{pre_pro: "Concept", shoot: "Generation"}, cgi_vfx -> {pre_pro: "Concept",
shoot: "Production"}. Studio-wide surfaces that MIX types (board columns, list,
slate, activity log, AI context) use the neutral defaults via
PROJECT_STATUS[..].label; a single project shows its own type's name via
stageLabel(status, project_type).
Three fixes shipped with it, all found in operator testing:
- The board card's stage menu was CLIPPED: components/projects/project-card.tsx
  is an `overflow-hidden` Link and status-menu.tsx positioned the menu
  absolutely inside it, so you saw the "Move to stage" heading and none of the
  options under it (it looked broken rather than cut off; ColorMenu had already
  been hand-portaled for the same reason). StatusMenu now uses the shared
  AnchoredPopover, which gained a `prefer` prop ("above" default for composers,
  "below" for a chip at the top of a card).
- The board card never passed `projectType`, so it showed generic labels while
  the hub showed type-aware ones for the same project. ProjectRow gained
  project_type (+ the projects page selects it); the card's date label also
  reads "Production" instead of "Shoot" for generated/CG jobs.
- The hub's lifecycle stepper was a row of plain divs: the biggest, most
  obvious "this is your stage" element did nothing when clicked, and the only
  real control was a small chip in the corner. It is now
  components/projects/lifecycle-stepper.tsx (clickable, toasts, `canEdit=false`
  for collaborators), and the hero's DUPLICATE StatusTag + StatusMenu were
  removed so stage is stated and changed in exactly one place.

### Project type + creation wizard + vendor contacts (migration 0049) — BUILT
- projects.project_type (0049, free text default 'general'): general | live_action
  | commercial | ai_video | cgi_vfx. Light label that tailors which hub cards
  surface, never a hard wall. Constants in lib/project-types.ts (PROJECT_TYPES +
  projectType()/isProjectType()).
- New project is now a 2-step wizard (components/projects/new-project-button.tsx):
  step 1 pick a type (icon cards), step 2 the details form (carries project_type
  as a hidden input). createProject validates + stores it. The Client field has an
  inline "+ Add a new client" (name + brand/agency) that calls quickCreateClient
  (clients/actions.ts, no redirect, returns id+name), appends+selects it in the
  controlled dropdown, and stays in the wizard (client_id submits via a hidden
  input so it holds through the add flow).
- Hub tailoring (app/(app)/projects/[id]/page.tsx): a colored type badge in the
  hero; the AI Pipeline card in the Visualize band shows ONLY for ai_video (other
  types keep storyboards/shot list/moodboard). Everything else is still reachable.
  CGI/VFX intentionally uses the generic modules for now (no dedicated CGI
  pipeline yet; deferred until a real CGI job needs it).
- Vendors: added a `vendor` contact category (lib/crew-positions.ts) so the
  per-project roster gets a Vendors folder tab + curated vendor positions (CGI/3D
  studio, VFX, color house, post, sound, rentals, etc.). No migration: contacts.
  type is free text. External vendors live here; you communicate via the
  Communication module (linked threads) and review share links. NOT a studio-wide
  reusable vendor directory yet (deferred; contacts stay per-project).
- "Add from client": the project contacts roster (components/projects/project-
  contacts.tsx) has a "+ From {client}" button (shown when the linked client has
  contacts) -> ClientPickerModal (search the client's contacts) -> opens the
  Add-contact modal PREFILLED (name/role/company/email/phone), category defaults
  to the active tab, so you pull an existing client contact into the roster and
  set their job role/rate. (A contact can't be attached to both a client and a
  project per contacts_one_parent, so this copies rather than links.)
- Collapsible sidebar (components/app-shell/sidebar.tsx): a Collapse/Expand
  toggle rails the left nav to icons-only (w-[68px]) for a wider workspace; state
  persists in localStorage ("sidebar.collapsed"). Main content auto-widens (flex).

### Project-level access / collaborators (migrations 0056/0057) — IN PROGRESS
A second, narrower access tier below studio members: a "project collaborator" is
granted access to specific project(s) only (internal crew: DP, AD, PA, etc.),
NOT the whole studio. Collaborators are NOT in `memberships`; they live only in
`project_members`, so every studio-wide table (clients, deals, CRM,
communication, money, notifications, boards-general) stays invisible to them
automatically (those tables keep is_studio_member gating; a collaborator has no
membership). We only OPEN the project-scoped tables to them.
- Migration 0056 (APPLIED): `project_members` (project/user/role/added_by) +
  `project_invites` (project/email/token/role) tables; helpers
  `can_access_project(project_id)` (studio member OR project_members),
  `review_target_project`/`review_comment_project` (polymorphic approvals +
  review_comments -> project). 32 project-scoped table policies changed to
  `is_studio_member(studio_id) OR can_access_project(<project>)` (direct
  project_id, parent-subquery for indirect tables, resolver for the 2
  polymorphic). Storage bucket policy UNCHANGED (studio-folder scoped) -> option
  A: collaborators reach asset files via an access-checked server route (NOT yet
  built). Inert until project_members rows exist.
- Migration 0057 (APPLIED): `studios_collaborator_read` (a collaborator can read
  their project's studio row for the shell); RPCs `project_invite_preview(token)`
  (anon, for the accept page) + `claim_pending_project_invites()` (joins caller
  to every project that invited their email); `handle_new_user` now also skips
  personal-studio creation for a project invitee.
- Code (BUILT): StudioContext gained `isCollaborator` + `projectIds` (null for
  members); getStudioContext resolves a collaborator (no membership -> via
  project_members, studio from those projects). signIn/signUp + getStudioContext
  claim project invites. app/(app)/projects/[id]/team-actions.ts (inviteToProject
  /revokeProjectInvite/removeProjectMember/acceptProjectInvite). components/
  projects/project-people.tsx = staff-only "People" button on the project hero
  (invite by email -> copy /project-invite/<token> link, list collaborators +
  pending, remove/revoke). Accept flow: public /project-invite/[token] page
  (added to middleware PUBLIC_PATHS) -> AcceptProjectInvite (logged in) or an
  invite-variant SignupForm (logged out) -> lands on the project.
- Collaborator app-shell gating (step 3, BUILT): middleware forwards the current
  path as an `x-pathname` request header; app/(app)/layout.tsx reads it and, for
  a collaborator, redirects any non-/projects path to /projects (RLS is the real
  boundary; this is just navigation). Sidebar + Topbar take a `collaborator` prop
  and strip the nav to only "Projects". "New project" (projects list) and the
  ProjectPeople + Archive controls (project hero) are hidden for collaborators.
- Storage / asset files (step 4, BUILT via option A): lib/asset-storage.ts
  `assetStorage()` returns the "assets" bucket via the SERVICE client (falls back
  to the RLS client if no service key). Safe because the access gate is one layer
  up: reads sign paths that came from already-RLS-authorized rows, and
  server-side uploads are followed by an RLS-gated row insert; the service role
  only bypasses the studio-folder storage policy, never a project boundary. All
  7 read/sign sites now use it (loadProjectAssets, shot-list, storyboards +
  present, production/board, pipeline, boards/actions), so collaborators SEE all
  their project's images. Server-side uploads swapped too (storyboard frame,
  production shot-board image, moodboard device-file image) so a collaborator can
  add storyboard/moodboard images.
- Asset-version upload (step 5, BUILT): the browser still uploads DIRECTLY to
  storage, because routing bytes through a server action would hit the ~4.5MB
  serverless request-body cap and break video entirely. What changed is what
  authorizes the upload. app/(app)/projects/[id]/upload-actions.ts
  createAssetUploadUrl(projectId, fileName) reads the project through the RLS
  client (whose policy is exactly `is_studio_member OR can_access_project`, so
  the read IS the access check for members and collaborators alike), then mints
  a one-shot signed upload URL with the service role and returns {path, token}.
  components/projects/upload-file.ts uploadAssetFile calls that, then
  uploadToSignedUrl. The server picks the path, so the browser cannot choose
  which studio folder it writes into. The `versions` insert that follows was
  already collaborator-open, so the whole chain works.
- Doc-review image signing (BUILT): signPaths in lib/review-links.ts now signs
  via assetStorage() rather than the passed client. loadDocSurface serves both
  the public portal (service client) and the internal RLS path, and on the
  latter a collaborator has no membership, so the member-gated bucket policy
  refused to sign and every image came back blank.
- THE VERIFICATION BELOW IS IN DOUBT (found 2026-07-31, not yet re-run). The
  test account (stevenazari1@gmail.com) had SIGNED UP INDEPENDENTLY on 07-16,
  which gave it its own personal studio, and was invited as a collaborator on
  07-29. lib/studio.ts:57 returns a full member with isCollaborator FALSE as
  soon as the user has ANY membership row; the project_members branch at :78 is
  only reached when there are none. So the code path that produces the stripped
  nav and the single-project list could not have run, and the observation below
  and the code disagree. Treat the collaborator boundary as UNVERIFIED until
  re-run with an account that is INVITED FIRST and never signs up separately
  (handle_new_user skips personal-studio creation for a pending invitee, which
  is the condition the whole design rests on).
- THE UNDERLYING GAP, which is real regardless of how that re-test goes: a user
  cannot hold a membership in one studio AND collaborator access in another.
  The second is silently invisible, because the projects list scopes to the
  active studio and the switcher lists only membership rows. RLS still allows
  the project by direct URL (can_access_project), so nothing leaks; it just
  cannot be navigated to. This is the NORMAL shape for a freelance DP or editor
  who has their own account and gets booked on someone else's job, so it will
  arrive with real users. Fixing it means letting the context carry both
  (resolver + switcher together), not a patch.
- VERIFIED END TO END (2026-07-29, real second account): invite from the project
  hero -> email received -> accept link -> lands on the project. The collaborator
  sees a stripped left nav (Projects only) and the projects list shows ONLY the
  invited project, so the account reads as empty apart from that one job. No
  financial information appears anywhere on the project, and the contacts roster
  shows NO day rates, which is the important one because that protection lives in
  application code (the server-side strip) rather than in RLS. NOT yet exercised:
  the `ai_generations.cost` strip, since the test project was not an AI project;
  it is the same strip-and-guard pattern as the other two.
- KNOWN, DELIBERATELY NOT CHANGED: the app-layout redirect only guards paths
  OUTSIDE /projects, so a collaborator can reach /projects/<id>/budget,
  /delivery, /invoices and the project's Communication by typing the URL. Those
  tables are all is_studio_member, so the pages render EMPTY rather than leaking:
  no data escapes, but it reads as "the budget is blank" rather than "this is
  closed to you". Nothing links a collaborator there. If it is ever worth
  tightening, the fix is a per-page ctx.isCollaborator check on those four routes
  returning the branded not-found instead of an empty shell.

### Team invites / multi-user (migration 0048) — BUILT
Multiple people can now share one studio (the paid multi-user lever). The tenancy
plumbing (studios/memberships/roles owner|admin|member + RLS is_studio_member)
already existed; what was missing was a way to add a second person. Added:
- `studio_invites` table (studio_id/email/role/token/accepted_at/accepted_by/
  revoked) + RLS (is_studio_admin manages). Two SECURITY DEFINER helpers do the
  privileged bits: `studio_invite_preview(token)` (read an invite pre-membership,
  granted to anon, for the accept page) and `claim_pending_invites()` (join the
  caller to every studio that invited their email; bypasses the admin-only
  membership insert). `handle_new_user()` is now invite-aware: it SKIPS creating
  a personal studio when a pending invite matches the new signup email (so an
  invited user joins the inviting studio instead of getting a stray own studio).
- Reliable claim net (covers every auth path incl. email confirmation): signIn
  calls claim_pending_invites(); signUp-with-invite calls it too; and
  getStudioContext (lib/studio.ts) claims on the first app load when the user has
  zero memberships, then re-reads. So a freshly-invited user always lands in the
  right studio.
- AN INVITE IS CLAIMABLE ONLY BY A CONFIRMED ADDRESS (migration 0079). Both
  claim functions match the caller against an invite by EMAIL, so until the
  email is verified the address is not a credential: with Supabase's "Confirm
  email" off, anyone who knew an invited address could sign up as it and be
  joined to that studio (or project) on their first request. Both functions now
  look the caller up with `email_confirmed_at is not null`, so an unconfirmed
  user matches nothing. ORDER MATTERS: 0079 is only safe because the dashboard
  toggle was turned ON first (2026-07-30); with confirmation off nobody ever
  gets an email_confirmed_at and every invite would be permanently unclaimable.
  If that toggle is ever switched back off, revert 0079 with it. OAuth signups
  are unaffected (Supabase stamps the column when a provider asserts a verified
  address).
- Settings -> Team (components/settings/team-panel.tsx, app/(app)/settings/
  team-actions.ts): invite by email + role (member|admin) -> generates a private
  /invite/<token> link (auto-copied); list members with role dropdown + remove
  (owner protected, can't remove self); pending invites list with copy-link +
  revoke. Member emails are resolved from the invite they accepted (accepted_by
  -> email); the owner shows as the signed-in email. team-actions guards on
  ctx.role (owner/admin) and RLS enforces it at the DB too.
- Accept flow: public /invite/[token] page (app/invite/[token]/page.tsx, added to
  middleware PUBLIC_PATHS). Previews the studio/role via the rpc; if logged in ->
  AcceptInvite button (components/auth/accept-invite.tsx -> acceptInvite ->
  claim); if logged out -> an invite-variant SignupForm (hidden invite_token,
  prefilled read-only email, no studio-name field) or "sign in to auto-join".
- INVITE EMAILS (BUILT): both invite paths now email the link instead of only
  handing you one to copy. inviteMember (studio) and inviteToProject
  (collaborator) call a local sendInviteEmail helper built on lib/email.ts
  (Resend) + renderEmail; re-inviting an address that already has a pending
  invite RE-SENDS the mail, which is the "they never got it" affordance. Sending
  is BEST EFFORT by design: the invite row is already written and the token link
  still works, so a mail failure never fails the invite. Both actions now return
  `emailed: boolean` and the two panels (components/settings/team-panel.tsx,
  components/projects/project-people.tsx) show "Invite sent to x" on success or
  an amber "email is not set up here, send them the copied link" fallback; the
  clipboard is only hijacked when the link IS the delivery mechanism. The
  collaborator email states the access boundary out loud ("this project only,
  not the rest of the studio"). New lib/site-url.ts siteOrigin() replaces three
  identical copies of emailOrigin() (share-actions, native-invoice-actions,
  callsheet-actions).
- MULTI-STUDIO SWITCHER (BUILT): getStudioContext used to always pick the
  earliest membership, so a user invited to a second studio silently never saw
  it. The active studio is now the one named by the `sf_studio` COOKIE when the
  user still belongs to it, else the oldest membership (lib/active-studio.ts
  readActiveStudioId + ACTIVE_STUDIO_COOKIE). A cookie, not a column, because
  it is a per-browser view preference; it is only ever a hint, since the id is
  matched against the caller's own membership rows before use and RLS is the
  real boundary either way. switchStudio (app/(app)/studio-actions.ts) verifies
  membership, sets the cookie, revalidates the layout; the caller then navigates
  to /dashboard because the current URL may carry an id from the studio just
  left. UI: components/app-shell/studio-switcher.tsx replaces the sidebar header
  block (a plain label for a single-studio user, a menu when there are 2+), and
  the UserMenu carries a md:hidden studio list since the sidebar is hidden on
  phones. Collaborators are passed an empty list (their studio entry is
  synthesised, so a switcher would be meaningless).
- NOT yet: a locked read-only "viewer" role (would need an RLS write/read split
  across all tables via an is_studio_editor() helper; deferred). Internal ungated
  feedback in the working/overview view is the next pipeline step (step 2 of the
  plan).

### DECISION (2026-07): documents yes, in-app PAYMENTS deferred
After research (docs/launch payment landscape: Melio now Xero-owned; Stripe is
the pragmatic rail; Paystand the B2B-ACH purist), the call is: in-app payments
is NOT a differentiator for the ICP (agency/brand clients pay net-30 via PO ->
AP -> ACH; they won't click a pay button in a vendor app), so DON'T build
payments now; let demand pull it (revisit Stripe Connect + embedded Payment
Element + ACH only if a real user asks). What IS worth it is the DOCUMENTS +
tracked sign-to-accept. BUILT (migration 0060): the native document generator
supports "Send" — freezes a JSON snapshot into billing_documents.snapshot, shares
a 192-bit /p/<token> link (public, no login, service-role gated + rate-limited,
middleware public path), where the client reviews and (for proposals) signs
(typed or drawn) to accept. Audit trail (signer_name/email, signature_kind/data,
signed_ip, accepted_at) on billing_documents; a signed doc is immutable (re-send
blocked after accept). components/production/billing-document.tsx (read-only
renderer from snapshot) + billing-accept-form.tsx (signature pad) +
lib/billing-doc.ts (DocSnapshot) + lib/billing-links.ts (loadBillingDocByToken) +
app/p/[token]/{page,actions}. The native document generator is thus UN-paused
(documents only); the FreshBooks connector + payment collection stay OFF.
Legally: typed/drawn name + audit trail = a valid e-signature (E-SIGN/UETA) for
proposals; DocuSign-grade only needed for binding contracts, not built.

THREE-TYPE DOC MODEL + STYLE EDITOR + ATTACHMENTS (migration 0061, per the
operator's real flow: "Estimates get sent > if required a proposal gets sent to
sign > once signed an official invoice gets sent"). billing_documents.kind is now
estimate | proposal | invoice (was invoice|estimate). Separate numbering series
on billing_profiles: estimate_prefix/next_estimate_no (EST-), proposal_prefix/
next_proposal_no (PROP-), invoice_prefix/next_invoice_no (INV-). SIGNATURE now
belongs to PROPOSALS ONLY: the /p/<token> page shows the signature pad only when
snapshot.kind==='proposal' (acceptBillingDoc guards kind==='proposal'); estimates
+ invoices get a plain share link with view tracking (no signature). One send
action serves all kinds: sendBillingDoc (renamed from sendDocForSignature) freezes
the snapshot (now including style + attachments) + shares the token + marks sent;
the workspace labels the button "Send for signature" for proposals, "Send" for the
rest. STYLE EDITOR (FreshBooks-style "Customize style", per the operator's
screenshot): per-document template + theme color + font, editable in
invoice-workspace's StylePanel and frozen into the snapshot on send. Columns on
billing_documents: template ('classic'|'modern'|'bold'), accent_color (hex, falls
back to profile default), font ('modern'=sans|'classic'=serif). Studio-wide
defaults on billing_profiles (default_doc_template/_accent/_font) seed new docs;
"Save as default for new documents" writes them (saveDefaultDocStyle). Option sets
+ helpers (DOC_TEMPLATES/DOC_FONTS/DOC_ACCENTS/fontStack/safeAccent/DocStyle) in
lib/billing-doc.ts; the renderer (billing-document.tsx) branches on template
(classic=right-aligned title, modern=accent header band, bold=big accent title),
tints headers/totals with the accent, and applies the font stack inline (works on
the public page, no extra font loading). ATTACHMENTS (proposals): a proposal can
carry supporting files (scope doc, contract, reference PDF). billing_document_
attachments table (studio-scoped, is_studio_member RLS); addDocAttachment
(server action, FormData, server-side upload to the studio-folder assets bucket),
deleteDocAttachment. Frozen into the snapshot (name + storagePath) on send;
loadBillingDocByToken signs them for the public page; the renderer lists them as
openable links. Actions live in native-invoice-actions.ts; updateDocStyle +
saveDefaultDocStyle + addDocAttachment + deleteDocAttachment. Hub card now reads
all kinds (doc count + signed-proposal count).

THREE-WAY DELIVERY (email / link / PDF), per the operator (FreshBooks parity):
every billing doc can be delivered three ways. (1) SEND BY EMAIL: emailBillingDoc
(native-invoice-actions) freezes+shares (reuses sendBillingDoc), then emails the
/p/<token> link via lib/email.ts (Resend) + renderEmail; gated on
emailConfigured() threaded page->workspace as emailEnabled. A reusable
components/production/send-doc-email-modal.tsx (To/Subject/Message, FreshBooks-
style "Send Proposal 101748") owns the form; the parent passes defaults + an
onSend, so call sheets / other docs can reuse it next. (2) COPY LINK: the
existing sendBillingDoc share link. (3) DOWNLOAD PDF (print-to-PDF, matches the
call-sheet export): app/(app)/projects/[id]/invoices/[docId]/print renders the
LIVE doc through BillingDocument in a data-theme="light" wrapper (forced light +
print-color-adjust:exact) with PrintButton; the "Download PDF" button opens it
with ?auto=1 and components/production/auto-print.tsx fires window.print(). One
source of truth for the snapshot: lib/billing-doc.ts buildDocSnapshot(doc, lines,
profile, attachments) is used by BOTH sendBillingDoc and the print route, so the
PDF always matches what the client is sent.

DELIVERY ROLLED TO OTHER DOCS (call sheet + shot list + storyboard). Shared
pieces: components/production/auto-print.tsx (fires window.print() when a print
view is opened with ?auto=1) + the reusable SendDocEmailModal. (1) CALL SHEET:
the builder's PDF button is now one-click ("Download PDF", opens
/production/callsheet?cs=<id>&auto=1 in a new tab, auto-prints). Email + per-
recipient links already existed (RecipientsPanel). (2) SHOT LIST + STORYBOARD:
their present/export views (/production/board, /storyboards/present) gained
?auto=1 support, and each editor's action row now has a one-click "PDF" button
(present?...&auto=1) plus an "Email" button (components/review/email-doc-button.tsx
-> SendDocEmailModal -> emailDocReviewLink in share-actions.ts, which creates/
reuses the /r/<token> client review link and emails it). Both gated on
emailConfigured() threaded page (ctx.studio.name + emailConfigured) -> editor as
emailEnabled/studioName. The existing ShareDocButton (copy link) stays, so both
now offer link + email + PDF. NEXT (if wanted): moodboard + asset review email,
and a forced-light wrapper on the present views (they print from light theme
today).

### Billing / invoicing — FreshBooks/payment paths BUILT BUT ON HOLD (payments deferred, see decision above)
Two invoicing paths were built and are deployed on `main`, but the whole area is
PAUSED pending a decision on the billing platform. Both are non-intrusive (see
below); leave them parked. The operator wants to choose the integration before
optimizing the flow + IA of this whole section.
- REVISITED 2026-07-29 and CLOSED AGAIN, keep as is. FreshBooks now has Bill Pay
  (direct ACH to vendors, no payroll detour), which removes the OPERATOR's
  friction. It does not change ours. API facts, checked against their docs so
  nobody has to look a third time: Bills are createable/listable
  (POST /accounting/account/<id>/bills/bills, GA), Vendors and Bill Payments are
  BETA, and Bill Payments can only RECORD a payment, never INITIATE one. Their
  hosted pages are still not embeddable. So an integration could push a cost out
  as a bill and read paid/unpaid back, but the studio would still leave the app
  to pay, which is the same hand-off that paused this originally. Operator chose
  to keep things as they are. Only revisit if a real workflow demands it, not
  because FreshBooks shipped a feature.
- The open decision: **FreshBooks vs Melio (melio.com)**. FreshBooks =
  orchestrate-only (its API creates invoices but the document editor, hosted
  invoice page, and payments all live on FreshBooks' surface, so we always hand
  off; that limitation is why this is paused). Melio = a payments/AP-AR platform
  whose API/embeddable pieces could let the invoice experience AND the payment
  (ACH/card) happen inside the Hub. Melio is the likely direction because it
  keeps layout + pay in-app. Revisit the whole flow once confirmed.
- Path A — FreshBooks connector (Phase 1, migrations 0041/0043): OAuth
  (app/auth/freshbooks/*), Settings->Connections card, lib/freshbooks.ts
  (create/send/get invoice+estimate, documentViewUrl), lib/billing.ts (token
  refresh), billing-actions.ts (createProjectDocument/send/sync), the
  billing_accounts + project_invoices tables. UI = components/production/
  invoicing-panel.tsx on the Delivery page (New invoice/estimate ->
  recipient + line items). NOTE: operator rejected the in-app create modal;
  the agreed direction (not yet built) was to REPLACE it with a hand-off that
  opens FreshBooks' own editor. Env: FRESHBOOKS_CLIENT_ID/SECRET (set in Vercel;
  App registered, redirect production-hub-steel.vercel.app/auth/freshbooks/callback).
  Only shows/acts when FreshBooks is connected.
- Path B — native invoice/estimate generator (slice 1, migration 0044): a
  built-in, FreshBooks-independent document maker modeled on call sheets.
  billing_profiles (studio From-block + number series; edit in Settings ->
  Billing profile), billing_documents + billing_document_lines (per-line tax %).
  Page /projects/[id]/invoices = components/production/invoice-workspace.tsx
  (two-pane: doc list + WYSIWYG editable invoice: From/logo, Bill-To fill-from-
  contact, line items w/ per-line "+ Tax" % popover, subtotal/tax/discount/
  total, Notes + Terms; autosave). native-invoice-actions.ts. Reached via a link
  on the Delivery page. NOT yet built: PDF export + shareable send link w/ view/
  paid tracking (was the next slice). It's its own page, so nothing hits it
  unless navigated to.
- If asked to clean up the billing area while paused: hide the two entry points
  (the "Open invoice generator" link + the InvoicingPanel on
  app/(app)/projects/[id]/delivery/page.tsx). The DB tables are additive/dormant.

### Environment variables (set in Vercel; needed to reproduce in a new env)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required for the client review portal `/r/...`)
- `NEXT_PUBLIC_SITE_URL` (optional; canonical origin)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Gmail/Chat/Drive/Calendar). Enable
  those APIs + add scopes in Google Cloud; users reconnect to grant new scopes.
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET` (Figma app scope: `file_content:read`;
  redirect `<domain>/auth/figma/callback`)
- `FRESHBOOKS_CLIENT_ID`, `FRESHBOOKS_CLIENT_SECRET` (billing connector, ON HOLD;
  redirect `<domain>/auth/freshbooks/callback`, e.g.
  production-hub-steel.vercel.app). Set in Vercel already.
- AI (optional): `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default gpt-5-mini) or
  `ANTHROPIC_API_KEY`; `AI_PROVIDER` to force one.

### Schema / migrations
DB changes are applied via the Supabase MCP `apply_migration` and mirrored as
files in supabase/migrations. THROUGH 0088. Recent: 0088 =
call_sheet_reminders; 0087 = version_poster_path; 0086 =
review_comment_pin_page; 0085 = project_binders; 0084 = editor_handoffs; 0083 =
sequence_review_target; 0082 = flatten_cast_to_references; 0081 = cast_prompts;
0080 = ai_cast_layer; 0079 = invites_require_confirmed_email; 0078 =
asset_type_document; 0077 = agent_threads. Older (0049: project_type; 0048 =
team_invites; 0047 =
ai_shot_review; 0046 =
ai_generation_prompt; 0045 =
ai_pipeline; 0044 = native_invoice_generator; 0043 =
project_documents_kind_recipient; 0042 = contacts_allow_project_parent; 0041 =
freshbooks_billing; 0040 = project_archive; 0039 =
call_sheet_templates; 0038 =
call_sheet_recipients; 0037 = call_sheet_layout; 0036 = call_sheets_multi;
0035: contact_details; 0034 =
project_events; 0033 = project_contacts; 0032 = doc_reviews; 0031 =
doc_approval_targets; 0030 = generic_review_target). When adding a
table/column, also hand-update lib/database.types.ts.
Note (0042): the contacts_one_parent check now allows project_id as the sole
parent (it predated project-level contacts and was rejecting them).

### Working notes for a fresh session
- Dev branch: whichever `claude/...` branch the session is assigned (most
  recently `claude/agent-creation-continue-7j6opc`; before that
  `claude/production-hub-phase-1-km1k0k`). Deploy = get the commit onto `main`,
  which Vercel auto-deploys.
- The reliable way to deploy is `git push origin <dev-branch>:main`, NOT a local
  merge. The dev branch is cut from `origin/main`, so this is a clean
  fast-forward on the remote and needs no checkout.
- WATCH OUT FOR A STALE LOCAL `main`. On 2026-07-30 the local branch was an
  UNRELATED history (50 commits, no common ancestor with origin/main's 70), an
  artifact of how the repo was set up rather than a branch anyone worked on. It
  held no unique work: a file-level comparison found exactly one file absent
  from origin/main, components/projects/drive-import-button.tsx, whose Drive
  import had been refactored into add-asset-button / add-asset-menu /
  drive-browser. It was realigned with `git branch -f main origin/main`, and the
  old tip is preserved as the tag `stale-main-backup` (122ed21). It mattered for
  one reason: a `git push --force origin main` from it would have replaced
  twenty commits of shipped work with a months-old snapshot. If a session ever
  finds `git checkout main` silently reverting the working tree, or a merge
  refusing on "unrelated histories", check `git merge-base main origin/main`
  before doing anything else.
- GitHub write now works via the Claude GitHub App (installed with Contents:
  read+write on the repo). Both `git push` and the GitHub MCP push. Vercel shows
  these commits as VERIFIED. (History: earlier in the session the App was
  read-only, which blocked all pushes until it was granted write. If pushes ever
  403 again with "Resource not accessible by integration" or "denied to
  botwurx-agent", the App lost write access -> re-grant it, do not fight git.)
- A local stop-hook flags every commit as "Unverified" because it can only see
  local state (no signing key in-env); ignore it. Author is already
  noreply@anthropic.com and GitHub verifies the App-pushed commits. Do NOT
  rebase deployed history to satisfy it.
- Standing style rule: no em dashes in any generated content.

### Open decisions to revisit (after the operator tests the full flow)
- Assets vs Review UI: operator leans toward NO review capabilities on the
  Assets page (keep it a pure library). Deferred until they run the end-to-end
  flow and decide. When picked up: strip the Review-canvas button, the review/
  sign-off signal, and the ShareReviewButton from AssetCard when it's on the
  Assets page (add a `review` prop, default off) but keep them on the Review
  page. Also decide how a file enters Review: (1) a "Send to review" button on
  the asset [recommended], or (2) an "Add to review" picker on the Review page.
- **Sending email attachments larger than the cap. RESOLVED for Drive files
  2026-07-29 (see "Over Gmail's limit" below). Still open for a PROJECT ASSET
  or a device file over 25MB**, where the answer would be a /r/<token> review
  link rather than bytes: createReviewLink() already mints one per asset and
  app/r/[token]/file is a token-guarded proxy, so for a project asset it is a
  one-call reuse that inserts the URL into the reply body; a device file would
  be uploaded into the project first (createAssetUploadUrl +
  uploadToSignedUrl already bypass the request cap) and then linked. Arguably
  better than an attachment for creative work at ANY size, because feedback
  lands on the asset (pinned comments, approve / request changes) instead of
  dying in an email thread. Not built: no one has hit it yet.

### Pre-launch hardening pass (BUILT, branch claude/pre-launch-audit-competitive-a08026)
Ahead of first beta users. Full write-up in docs/launch/pre-launch-audit-2026-07.md
(audit + competitive assessment) and docs/launch/beta-launch-checklist.md
(manual steps + follow-ups). Shipped:
- Auth recovery: /forgot-password + /reset-password (resetPasswordForEmail ->
  /auth/confirm recovery session -> updateUser) + resend-confirmation surfaced on
  login when a confirm link fails. New public paths in middleware.
- Error handling: app/global-error.tsx (self-contained), app/error.tsx,
  app/(app)/error.tsx; branded app/not-found.tsx + projects/[id]/not-found.tsx;
  loading.tsx skeletons (dashboard/projects/project hub) + components/ui/skeleton.
- SSRF fix in lib/unfurl.ts: safeFetch DNS-resolves every hop and rejects
  private/reserved IPs, follows redirects manually (both unfurl + board image DL).
- Swallowed write errors surfaced: projects status/color/archive/update +
  notification mark-read now return + log via lib/log.ts reportError (the seam
  Sentry hooks into). Minimal toast at components/ui/toast.tsx (+ Toaster in the
  app shell); status/color/archive/client-picker menus toast on failure.
- Paused billing entry points hidden on the Delivery page (BILLING_ENABLED flag).
- Legal: app/(legal)/{terms,privacy} (placeholders + counsel note), linked from
  auth footer, public in middleware.
- CI: .github/workflows/ci.yml (tsc + build; no eslint config in repo).
- Observability: Sentry (@sentry/nextjs, instrumentation*.ts + sentry.*.config +
  withSentryConfig) inert until NEXT_PUBLIC_SENTRY_DSN; Vercel Analytics in root
  layout. Adds ~76kB client first-load (tunable).
- Feedback: migration 0058 `feedback` (RLS insert-only; read via dashboard) +
  app/(app)/feedback-actions.ts + components/feedback/feedback-modal.tsx in the
  user menu.
- Rate limiting: lib/rate-limit.ts (best-effort in-memory) on /r + /c public
  actions. Completed .env.example (adds SUPABASE_SERVICE_ROLE_KEY etc).
- Security: Next.js bumped 14.2.15 -> 14.2.35 (patches critical Server Actions
  DoS + middleware SSRF). Remaining audit items need a Next 15/16 (React 19)
  major upgrade, deferred. Supabase leaked-password protection is ON (it is a
  PRO-plan feature, not a free toggle; the project was upgraded 2026-07-30 and
  the advisor lint cleared). Migrations now through 0065 (0059 project_tasks, 0060
  billing_document_signatures, 0061 billing_proposals_style_attachments, 0062
  review_due_dates, 0063 ai_flexible_references, 0064 ai_generation_starred, 0065
  ai_prompt_library, 0066 ai_batch_review).
- AUTH EMAIL BRANDING (docs/launch/supabase-auth-emails.md) — DONE 2026-07-30,
  verified end to end. Signup confirmation, password reset and email change are
  generated by SUPABASE AUTH, not by lib/email.ts, so they used to send from
  Supabase's shared SMTP with Supabase branding. Custom SMTP now points at the
  same Resend account the app already uses (smtp.resend.com:465, username the
  literal `resend`, password the `re_` API key, sender the EMAIL_FROM address on
  its verified domain), all three templates are branded, and Site URL matches
  NEXT_PUBLIC_SITE_URL exactly (https://app.studio-flows.com; the `app.` matters,
  since the session cookie is set on whichever host serves the confirm route).
  Template links target our own /auth/confirm with token_hash + type, so the
  recipient sees our domain rather than the project's supabase.co host.
  /auth/confirm ALSO ACCEPTS A PKCE `code`, and that branch is load-bearing
  rather than defensive: Supabase's DEFAULT templates use
  {{ .ConfirmationURL }}, which routes through the project's own /auth/v1/verify,
  spends the one-time token there, and redirects to us with a code. The route
  originally took only token_hash, so it threw away a valid session and sent the
  user to /login?error=confirmation_failed reading "may have expired" -- false on
  the first click, then TRUE on every retry, because the first click had spent
  the token. The auth log is the tell: a 303 carrying a `login` event followed by
  403s reading "One-time token not found". Do not collapse the route back to one
  branch; the default template is what a fresh project ships with.
  requestPasswordReset now reportErrors a genuine send failure while keeping its
  neutral "if an account exists" message (an unknown address is deliberately not
  an error there, so anything returned is real), because a total mail outage
  previously rendered as "check your inbox" and was invisible. WHEN AUTH MAIL
  BREAKS, READ THE AUTH LOG FIRST (Supabase → Logs → Auth, or get_logs): a dead
  send is a `POST /recover` 500 with the SMTP error attached, which names the
  cause in one line instead of an hour of guessing at spam folders.
  /auth/confirm also guards its `next` parameter: it went straight from the query
  string into new URL(), where a protocol-relative //host resolves to another
  origin, so a valid token could have been spent on an off-site redirect.

### Review-round polish (Tier 1 #3) — due dates + auto-reminders BUILT
Migration 0062 added `due_date` + `last_reminded_at` + `reminder_count` to
review_links (the client review link, which covers both asset and doc reviews).
When you Email a review (EmailDocButton -> SendDocEmailModal, which gained an
optional "Respond by" date field via a `dueDateField` prop), emailDocReviewLink
persists the recipient + due_date on the link and includes the date in the email.
The client portal (/r) shows a DueBanner (components/review/due-banner.tsx):
amber "Please respond by X", red "Response was due X" once passed, hidden once the
client has decided; wired into both ClientReview and DocReview (gatherReview +
gatherDocReview now return dueDate). AUTO-REMINDER: a daily Vercel Cron
(vercel.json crons, 15:00 UTC) hits /api/cron/review-reminders (GET, gated on
`Authorization: Bearer $CRON_SECRET`); lib/review-reminders.ts runReviewReminders
finds overdue, non-revoked links with a recipient that the client hasn't responded
to (no approval via the link), emails a nudge, and stamps last_reminded_at +
reminder_count (cap 3, min 2 days between). Middleware PUBLIC_PATHS gained
`/api/cron`. NEW ENV: `CRON_SECRET` (set in Vercel; documented in .env.example).
SIDE-BY-SIDE VERSION COMPARE (slice B, BUILT): components/review/version-compare.tsx
(two panes, each with its own version picker, images object-contain) is wired into
the client portal (components/review/client-review.tsx): for IMAGE assets with 2+
versions, a "Compare versions" toggle by the version pill swaps the PinReview canvas
for the compare view (before/after a revision), "Back to review" returns. STILL TODO:
the in-app review modal (review-modal.tsx) only gets one version's signed URL, so
compare there needs the parent to sign all versions (deferred); surfacing due/overdue
on the internal Review page is also still open.

### Frame.io-grade video review (migration 0067) — BUILT
The /r client portal (and every internal surface that reuses the same canvas)
now matches or beats Frame.io on the video review experience. All of it lives in
the SHARED player + rail, so the client portal, the in-app ReviewModal, the AI
shot review, and the master-cut review all gained it at once.
- Player (components/review/video-player.tsx): playback speed (0.25-2x), loop,
  volume slider, real broadcast timecode HH:MM:SS:FF (click to toggle to
  seconds), scrub-bar hover preview timecode, J/K/L shuttle + arrows + , / .
  frame step + M mute + F fullscreen, and a keyboard-shortcut popover. fmtTimecode
  is the new export; fmtTime (decimal seconds) stays for tight chips.
- DRAWN ANNOTATIONS (the Frame.io signature): pause, hit Draw, mark up the
  frame, then write the comment. TOOLS (matching Frame.io's set): arrow, line,
  rectangle, ellipse, freehand pen, 5 colours, plus UNDO / REDO over the
  in-progress drawing (Clear wipes it). A shape stores exactly two points
  (start + end) and is drag-to-draw; the pen stores the whole path. Arrowheads
  are computed from the segment angle and scale with the stroke width.
  A shape with no drag is discarded as a stray click rather than saved as a
  dot. normalizeDrawing whitelists the tool name (unknown -> pen), caps a
  shape to 2 points, and drops a shape that has fewer.
  The palette lives in components/review/draw-toolbar.tsx and is SHARED by the
  video canvas and the PIN canvas, so markup works on images, shot lists,
  storyboards, moodboards and AI shots as well as video (pin-canvas.tsx gained
  the DrawCanvas overlay inside the same box the pins are positioned in, so a
  drawing and its pins stay aligned; placePin is skipped while drawing so a
  stroke never also drops a pin). The pin composer gained the same always-
  visible Draw + Emoji controls as the video one. Every pin caller forwards the
  drawing: client-review, review-modal, cut-review-view, doc-review,
  doc-review-modal, doc-review-view and ai-shot-review-canvas. components/review/draw-canvas.tsx is the
  draw/replay layer (pointer capture, DPR-aware, ResizeObserver); lib/review-
  drawing.ts is the model. Strokes are stored NORMALIZED (0..1 of the media box)
  so a drawing made on a laptop replays correctly on a phone or in fullscreen,
  and line weight scales with the box. normalizeDrawing() is the trust boundary
  for the PUBLIC portal: whitelists the pen colour (no arbitrary string into
  canvas strokeStyle), clamps size 1-24 and every coord to 0..1, caps 60 strokes
  x 400 points, rejects junk. Selecting a comment replays its drawing.
- THREADED REPLIES: review_comments.parent_id (self-FK, cascade). One level
  only: a reply inherits the parent's moment and carries no anchor/drawing of
  its own, enforced server-side (`!parent &&` on the pin/time branches). Every
  comment action validates the parent belongs to the same version/doc target
  before accepting, so a token can't graft a reply onto another review.
- Rail: filter (All / Open / Resolved / Mine), sort (Timecode / Newest /
  Oldest), search across a thread and its replies, comment numbers (#N), and a
  drawing badge. "Mine" keys off the reviewer's typed name in the portal.
- Actions all gained (parentId, drawing): submitClientComment + submitDocComment
  (public, service-role) and addReviewCommentAt + addDocReviewCommentAt
  (internal, RLS). PortalComment gained parentId + drawing, so every loader
  (review-links, project-data, doc-review-data) selects the two new columns.
- RANGE COMMENTS (migration 0068 = review_comments.timecode_end): a note about a
  STRETCH ("this whole section drags"), not one frame. timecode stays the
  in-point so every existing point comment and marker is untouched; timecode_end
  is the out-point, null for a point comment. Composer: "Set out" marks the
  out-point at the playhead (if it lands before the in-point, the in-point is
  nudged back rather than erroring), chip reads "in to out" with a clear button.
  On the scrub bar a range draws as a translucent BAR behind the numbered dot;
  clicking a range comment PLAYS just that stretch and stops (ScrubVideoHandle
  gained playRange; a stopAt ref halts playback and is cleared by any manual
  play/scrub). Server side, all four comment actions validate out > in and
  Number.isFinite before storing.
- EMOJI (components/review/emoji-picker.tsx): a curated 30-emoji palette
  (Reactions / Tone / Notes) in the composer, inserted AT THE CARET not
  appended. Deliberately no picker dependency shipped to the public portal.
- DISPLAY SETTINGS menu (the gear, matching Frame.io's): GUIDES
  (components/review/video-guides.tsx) = rule of thirds, title/action safe
  (90%/80% broadcast convention), and CROP MASKS 1:1 / 4:5 / 9:16 that dim
  outside the target aspect, computed from the video's NATURAL size so it flips
  between pillarbox and letterbox correctly (this one beats Frame.io for the
  ICP: every commercial job ships social cutdowns and "does the product survive
  the crop" comes up on every review). ZOOM Fit/2x/4x with drag-to-pan (clamped,
  disabled while drawing). DOWNLOAD THIS FRAME grabs a PNG via a SEPARATE
  crossOrigin video element, so a bucket without CORS headers fails with a
  message instead of breaking playback for everyone.
- QUALITY SWITCHING is NOT built and cannot be without a transcoding pipeline:
  `versions` stores ONE file (storage_path), so there are no alternate
  renditions to switch between. The settings menu reports the true source
  height (from videoHeight) and says so. Real switching = a worker that
  ffmpeg-encodes 1080/720/540 on upload + a renditions table + HLS or a source
  picker. Scoped, not started, pending the operator's call.
- COMPOSER TOOLBAR FIX (was a real bug): the portal passes
  `disabled={!name.trim()}`, and the old composer HID the Draw / Range controls
  and the emoji picker while disabled, so on first load (before typing a name)
  neither existed on the page. The toolbar is now always rendered below the
  textarea, Frame.io style (timecode chip, Pin, Range, Draw, Emoji, then Post),
  and merely inert when gated. Never hide a capability behind a gate; disable it.
- EDIT / DELETE / REACTIONS (migration 0069). review_comments gained
  `author_key` + `edited_at`; new table `review_comment_reactions`
  (studio/comment/emoji/author_id|reviewer_key/reviewer_name, is_studio_member
  RLS, UNIQUE on (comment_id, emoji, coalesce(author_id, reviewer_key)) so a
  toggle is idempotent).
  - AUTHORSHIP WITHOUT LOGIN: the portal has no accounts, so the typed name
    cannot authorise an edit (anyone with the link can type any name). Instead
    lib/reviewer-key.ts mints a random per-browser id kept in the `sf_rk`
    COOKIE (a cookie, not localStorage, so the SERVER render can read it and
    mark which reactions are yours on first paint). editClientComment /
    deleteClientComment require review_link_id match + author_key match + a
    null author_id, so a client can only touch what their own browser wrote and
    can never edit a studio comment.
  - Internally (RLS) editReviewComment / deleteReviewComment require
    author_id === ctx.userId. Admins are deliberately NOT special-cased:
    silently rewriting a colleague's review note is worse than asking them to.
  - Deleting a comment cascades its replies (FK), and the confirm says so.
  - Reactions render as chips under a comment (count, highlighted when yours,
    hover shows reactor names) + an add-reaction picker;
    lib/review-reactions.ts REACTIONS is the 7-emoji whitelist the public
    action validates against. lib/review-reactions-load.ts rolls rows up per
    comment; loadProjectAssets/gatherReview/gatherDocReview take the viewer id
    (user id internally, cookie key publicly) to compute `mine`.
- REPLIES ARE FIRST-CLASS: the reply composer has its own EmojiPicker (the
  caret-insert helper was generalised to insertAtCaret and is shared by both
  composers), and a reply carries reactions + edit/delete + an "(edited)"
  marker + a Client/Studio badge, same as a root comment. The server needed no
  change: a reply always carries the parent's version_id (or doc target), so
  the reaction and edit ownership checks already covered it.
- Second instance of the same "hidden when gated" bug, also fixed: the REPLY
  composer was `replyTo?.id === c.id && !disabled`, so clicking Reply before
  typing a name silently did nothing. It now renders inert with the gate
  message as its placeholder.
- VERSION SWITCHING IN THE PORTAL (was a real gap): the client portal rendered
  only the CURRENT version, and previous versions were bare download links, so
  a client could never see the comments left on v1 once v2 landed (the IQ Bar
  link had both its comments on v1 and none on v2 -- they were unreachable).
  client-review.tsx now holds a `viewingId`: version pills (`v1`, `v2 · latest`)
  swap the review canvas AND the comment thread, and the media/compare/download
  URLs all follow the viewed version. An older version is READ-ONLY -- an amber
  banner says so with a "Back to vN" button, the composer is disabled with that
  reason as its hint, and the approve / request-changes block is hidden, because
  the open round is always the latest version (submitClientDecision is pinned to
  latest.id, never the viewed one).
- Internally the capability already existed but was mislabelled: each row in the
  version history has View (in-app viewer) and Review (the comment canvas for
  THAT version); the third link was called "Open" while actually being a raw
  file download, so it read as the only action. Renamed to "Download".
- NOT built: comment attachments (a paid-tier question, per the operator), CC
  captions, per-comment @mentions.

### Budget: cost ledger (slice 1 of "dynamic budget", migration 0070) — BUILT
`budget_lines.actual` used to be a number you typed, with no provenance: the page
could say you were $4,200 over but not why, who, or against what document. Actual
is now a LEDGER, the same move that makes an Asset a file plus Versions.
- `project_costs` (0070): studio/project/budget_line_id (nullable, a cost can
  land before anyone categorises it)/vendor/contact_id/description/amount
  numeric(12,2)/invoice_number/invoice_date/due_date/status (received ->
  approved -> paid)/storage_path/file_name/notes. Constants + roll-up in
  lib/costs.ts (COST_STATUS, costStatus, MAX_COST_DOC_BYTES, lineActual,
  rollUpActual).
- RLS IS DELIBERATELY `is_studio_member` ONLY, not the
  `is_studio_member OR can_access_project` that migration 0056 gave the other 32
  project-scoped tables. A project collaborator (DP, AD, PA) can reach the
  project and must NOT see what the rest of the crew charged. The migration says
  so in a comment; do not "fix" it to match its neighbours.
- DERIVED ACTUAL: a budget line with costs attached reports their SUM and its
  cell goes read-only (showing an invoice-count chip); a line with none keeps
  the typed number, so the fast manual-estimate workflow still works and no
  pre-ledger figure is stranded. Unassigned costs still count toward the project
  total, since the money left the account whether or not anyone categorised it.
  `rollUpActual` is shared by the budget page AND the project hub card, because
  the hub read `actual` directly and would otherwise disagree with the page
  about the same project.
- GOTCHA worth remembering: postgres `numeric` comes back from PostgREST as a
  STRING, so every amount goes through `Number(...)`. A plain `+` would
  concatenate ("200.50" + "99.50" = "200.5099.50"). Asserted in a scratchpad
  harness along with the NaN-degrades-to-0 and unknown-status cases.
- UI: components/production/cost-ledger.tsx (list + add/edit modal + click-to-
  advance status chip + on-demand signed doc URL) mounted under the estimate
  table; a fourth "Still owed" tile. Vendor can be picked from the PROJECT
  ROSTER, which carries an agreed day rate, so the modal shows "agreed rate
  $X/day, N days at that rate" against the invoiced amount. Actions in
  app/(app)/projects/[id]/cost-actions.ts (addCost/updateCost/setCostStatus/
  deleteCost/uploadCostDoc/getCostDocUrl); the invoice document is signed on
  CLICK, not on page load, since most rows are never opened.
- SCOPE LINE TO HOLD: this answers "what did this job cost and who is owed". It
  does not become POs, payroll, approval chains, or AICP bid ledgers (that is
  Saturation.io's ground, and the audit already said no to it).
- Slice 4 (margin + unpaid rollup) and slice 5 (payment schedule) are BUILT,
  see below.

### Budget slice 5: payment schedule / deposits (migration 0072) — BUILT
Came straight out of real use: a CGI vendor wanted 25% up front and the balance
later, and the ledger could only express "one cost, paid once". A cost is now a
COMMITMENT and `cost_payments` are the events against it, the third instance of
the parent-holds-the-figure / children-hold-what-happened shape (assets ->
versions, budget_lines -> project_costs).
- `cost_payments` (0072): studio/cost_id/label/amount/due_date/paid_at/method/
  notes. `paid_at` NULL means scheduled (owed, not yet sent); set means the money
  is gone. One nullable timestamp rather than a status enum, because a payment
  has exactly two honest states and the date is the thing worth recording.
  RLS is_studio_member ONLY, matching project_costs (a collaborator must not see
  what the studio owes its vendors).
- `summarizePayments(committed, payments, manualStatus)` in lib/costs.ts is the
  whole roll-up. With NO payments it falls back to the manual status chip, so
  every pre-existing cost keeps working untouched; with payments the schedule is
  authoritative and the chip becomes a READ-ONLY derived chip (Scheduled / Part
  paid / Paid), the same rule that makes a budget line's actual read-only once
  costs back it. Returns owed, state, nextDue (undated payments sort last, since
  a payment with no date cannot be "next"), and `unscheduled` so a schedule that
  does not add up to the commitment is surfaced in an amber line rather than
  silently short. Half a cent of tolerance on "settled" so a percentage split
  does not leave a rounding crumb owed forever.
- `depositSplit(committed, percent)` computes the balance as the REMAINDER, not
  a second percentage, so the two halves always add back to the total exactly.
  Surfaced as a "Deposit + balance" quick action (percent + two due dates +
  "already sent"), which REPLACES any existing schedule rather than appending,
  since it builds a whole schedule.
- STILL OWED IS NOW PRECISE everywhere: the budget tile, the ledger header, and
  the dashboard widget all sum `summarizePayments().owed`, so a part-paid
  commitment reports only its remainder. The dashboard widget also shows the
  NEXT PAYMENT's date rather than the cost's own, re-sorts on that effective
  date (the query's ordering no longer holds), tags the row "balance" when part
  paid, and drops a cost whose schedule fully settles it even though its manual
  chip never moved.
- UI: components/production/payment-schedule.tsx, expanded per row from a
  button in the cost's action group that reads "Split" (no schedule) or "1/2"
  (paid/total). `todayIso` is computed on the SERVER and threaded down, matching
  the slate and the dashboard, so an overdue payment cannot render differently
  after hydration.
- summarizePayments and depositSplit are unit-tested in the scratchpad,
  including the exact deposit-then-balance sequence, the numeric-as-string case,
  overpayment (never negative owed), and a 33.33% split summing back to the
  whole.
- STILL OPEN: the extractor is told to read the amount due AFTER any deposit
  already paid, so a closing invoice that instead states the FULL total would
  double count against a deposit logged separately. Nothing detects that yet;
  the schedule is the structural answer (one commitment, two payments) but
  nothing forces its use.

### Budget slice 3: cost from an emailed invoice + rate flagging (migration 0071)
Two halves, both about connecting the ledger to what already exists.
- COST FROM A GMAIL ATTACHMENT: freelancers email invoices, so the invoice
  should never have to touch a desktop. An attachment whose mime is a PDF or an
  image gets a "Log as a cost" button next to "Add to assets" (components/
  projects/log-cost-attachment.tsx), shown only when the thread is tied to a
  PROJECT, since a cost has to land somewhere. draftCostFromAttachment fetches
  the bytes, extracts, and returns the draft PLUS the project's budget lines and
  roster (the Communication module has no reason to have loaded either), then
  the SAME CostModal opens prefilled. On save, attachEmailInvoice re-fetches the
  bytes from Gmail and stores them. Deliberately fetched TWICE rather than
  parked in storage during the draft step: abandoning the form then leaves no
  orphaned invoice behind. CostModal is now exported and takes optional
  `initial` / `initialFilled` / `attachment` props; when `attachment` is set the
  file picker is replaced by a line naming the file that will be filed.
  DEGRADES GRACEFULLY: with no AI key, an unreadable document, or a file over
  the cap, the modal still opens empty rather than erroring, because filing the
  invoice against a typed-in cost is most of the value.
- RATE VS INVOICED (migration 0071 = project_costs.days): a true check needs a
  DAY COUNT, which was the missing piece. An amount alone says nothing ($2,400
  is either three fair days or one dear one), and dividing the total by the rate
  to guess days would fire on every kit fee and overtime line, which is worse
  than no flag. So `days numeric(6,2)` is nullable (a flat fee, a rental, and a
  licence have no day count), the extractor reads it ONLY when the invoice
  states a quantity, and lib/costs.ts `rateCheck` compares days x agreed rate
  against the invoiced amount with a $1 tolerance so ordinary rounding is not a
  discrepancy. It returns null unless BOTH a rate and a day count are known.
  Surfaced as a RateNote line in the modal (matches / over / under, or a prompt
  to add the days) and an amber "over rate" chip on the ledger row. rateCheck
  and the days parsing are unit-tested in the scratchpad, including the
  numeric-arrives-as-a-string case.

### Budget slice 2: invoice extraction (AI, draft-and-confirm) — BUILT
Attach an invoice to the add-cost modal and the form fills itself. The contract
is the same as the composer's Polish button: the model ASSISTS, the human
COMMITS. `extractInvoiceDraft` never writes; it returns a draft, the producer
checks it, and the existing addCost does the saving. A financial record is never
created from a model reading a document unattended.
- MULTIMODAL PATH (lib/ai.ts, the app's first): `AiDocument` (base64 + mediaType
  + fileName) -> anthropicReadDocument / openaiReadDocument. Bytes go inline as
  base64 on both providers, so nothing has to be cleaned up afterwards.
  Anthropic: `document` block w/ Base64PDFSource for PDFs, `image` block
  otherwise (the SDK's media_type union is narrower than image/*, so anything
  unexpected is sent as png rather than cast). OpenAI Chat Completions: a
  `{type:"file", file:{filename, file_data:"data:...;base64,..."}}` part for a
  PDF, `image_url` w/ a data URL for an image (Chat Completions does NOT take a
  remote file URL, that is Responses-API only, which is why bytes are inlined).
  VERIFICATION STATUS: the OpenAI path is CONFIRMED WORKING in production
  (2026-07-29, real invoice through gpt-5-mini on the deployed app), so the
  `file`/`file_data` request shape above is correct as written; do not "fix" it
  against half-remembered docs. The Anthropic shape is checked against the
  installed @anthropic-ai/sdk 0.110.0 types (DocumentBlockParam /
  Base64PDFSource) but has NOT been run live, since OpenAI is the deployment's
  actual provider.
- `parseInvoiceDraft` is the TRUST BOUNDARY between model output and a money
  field, and is unit-tested in the scratchpad. It strips code fences, finds the
  JSON inside surrounding prose, rejects a hallucinated budget_line_id by
  whitelisting against the project's real line ids, rejects negative/absurd
  totals, rounds to cents, and validates dates as REAL days (2026-02-31 becomes
  null instead of rolling into March). Bug caught by those tests: an amount of
  "n/a" strips to "" and `Number("")` is 0, so an unreadable total would have
  landed as $0.00 and read as a real zero cost; empty digit strings now become
  null.
- VENDOR MATCHING IS DETERMINISTIC, not a second model call: `matchVendor`
  normalizes and compares against the project roster (exact first, then
  containment either way so "Jane Doe" matches "Jane Doe Lighting LLC"), with a
  4-character floor so a two-letter company name cannot match half the roster.
  Also unit-tested. No match leaves the cost unassigned rather than guessing,
  since filing a cost against the wrong crew member is worse than leaving it
  blank.
- UI: attaching a file auto-runs the read (that IS the feature), showing
  "Reading the invoice...", then an amber banner naming exactly which fields
  were filled plus "check the amount against the document before saving", and an
  Undo that restores the pre-extraction values verbatim. A non-USD currency
  raises a toast rather than being silently treated as dollars (we store one
  currency). The whole thing hides itself when no AI key is set, via the
  existing useAiEnabled context.
- CAP FIX from slice 1: MAX_COST_DOC_BYTES was 8MB, but the file crosses a
  Server Action, so the ~4.5MB serverless request body applies and an 8MB file
  would die at the platform edge with no error we could show. Now 4MB, matching
  MAX_UPLOAD_BYTES on the email path. (The rest of this class is now fixed too,
  see "Server Action upload caps" below.)

### Server Action upload caps: the whole class, swept (no migration) — BUILT
Any file that travels browser -> Server Action -> storage crosses the ~4.5MB
serverless request body. Over it, the request is killed at the platform EDGE
before our code runs, so there is nothing to catch and nothing to report: the
click just appears to do nothing. A cap above that ceiling is therefore not a
cap at all, it is dead code. `MAX_UPLOAD_BYTES` (4MB, lib/attachment-limits.ts)
is the one true limit for this path, and a grep for `file.size` across the
server actions found FOUR sites that were wrong or missing:
- `addDocAttachment` (native-invoice-actions.ts): checked 25MB, so it could
  never fire. Now MAX_UPLOAD_BYTES, and mirrored CLIENT-side in
  invoice-workspace.tsx's onPickFile so an oversized proposal attachment is
  refused before the upload rather than vanishing.
- `saveStoryboardFrameImage` (storyboard-actions.ts) and the shot-board card
  image (production/board-actions.ts): NO cap at all.
- The moodboard device-file import (boards/actions.ts): no cap, and it takes
  SEVERAL files, so the check is on the TOTAL (they share one request body, so
  five 1MB images blow the same ceiling one 5MB image would).
`branding-actions.ts` was already 3MB, under the ceiling, so it was left alone.
NOT changed: the asset-version upload, which deliberately goes DIRECT to storage
via a server-minted signed URL (createAssetUploadUrl + uploadToSignedUrl) and so
is not bound by this at all. That is also the durable answer if a genuinely
large storyboard or moodboard image is ever needed: move those to the signed-URL
path rather than raising a number that physics will ignore.

### Budget slice 4: margin + studio-wide unpaid rollup (no migration) — BUILT
Closes the loop: the ledger already knew what a job COST, and billing_documents
already knew what was BILLED. Slice 4 just puts them on one page.
- MARGIN BAND on the budget page (its own bordered block, deliberately NOT a
  fifth tile: "did we stay on budget" and "did we make money" are different
  questions and should not read as one row of numbers). Billed / Job cost /
  Margin $ and %, plus a bar showing cost as a share of billed, which turns red
  on a loss.
- BILLED comes from the project's `kind='invoice'` billing_documents ONLY. An
  estimate or a proposal is what you hoped to charge, not what you charged.
  Totals live on billing_document_lines, so they are summed with the SAME
  `computeTotals` the document renderer uses (one source of truth). When no
  in-app invoice exists it falls back to `project_billing.amount`, the manual
  figure on the delivery page, mirroring how a budget line falls back to its
  typed actual. The band states which source it used, so the number is never
  unexplained.
- `marginOf` (lib/costs.ts) is unit-tested. Percentage is margin ON REVENUE
  (profit / billed), what a studio quotes, not markup on cost, and is NULL when
  nothing has been billed: dividing by zero would otherwise print Infinity next
  to a dollar figure and look authoritative.
- UNPAID ROLLUP: a customizable dashboard widget ("Unpaid invoices",
  components/dashboard/unpaid-costs.tsx, added to TOGGLEABLE in dashboard-body).
  Total owed + an overdue count + the six nearest by due date, each linking to
  that project's budget. Overdue is computed against the SERVER's todayStr
  (already passed for the calendar) so it cannot differ between the server
  render and hydration, and dates parse as UTC so no timezone shifts a day.
  ARCHIVED projects are excluded: their bills are still owed, but they are not
  what a producer is being chased about this week, same reasoning that keeps
  archived projects off the board. Staff-only by construction, since
  project_costs is is_studio_member and the dashboard already redirects
  collaborators.

### Agreements: NDAs, MSAs, SOWs, change orders (migration 0076) — BUILT
Shaped from two REAL documents the operator supplied (a brand SOW they signed,
and a subcontractor SOW from a production company that hired them). Both agreed
on three things, and those three drove the model:
- A SOW is a CHILD of a master agreement ("governed under the Master Services
  Agreement dated 1/28/2026"; "part of and subject to the Subcontractor
  Agreement"). Hence `parent_id`, and scope following the relationship: NDA and
  MSA belong to the ACCOUNT (signed once, govern everything after), SOW and
  change order belong to a PROJECT. The project page shows the account's masters
  as read-only INHERITED context ("In place with the client") without claiming to
  own them, which answers "is there an NDA in place" without a hunt.
- BOTH parties sign. The proposal flow has ONE signer, fine for "client approved
  this estimate" and not for a contract. So two signer name/date pairs, and
  `signState` derives unsigned | partial | signed from them rather than storing a
  status that could disagree. The row spells out WHICH side is missing, since
  "awaiting signature" is useless otherwise.
- The studio is usually the RECEIVER. `direction` defaults to inbound and the
  stored PDF is the normal case, not an afterthought.
RLS is is_studio_member ONLY: a contract states fees, so it sits with the money
tables, not the project-scoped tables a collaborator reads. `expires_date` +
`isExpired` against a SERVER-resolved todayIso flags a lapsed NDA.
UI: components/agreements/agreement-list.tsx is shared by the account page
(kinds nda/msa/other) and /projects/[id]/agreements (sow/change_order/nda/other,
plus a hub card in the Produce band). Actions in app/(app)/agreement-actions.ts.
OUTBOUND GENERATION IS DELIBERATELY NOT BUILT: the operator has no NDA/SOW
template of their own, and writing legal text is not our business. Revisit only
when they bring counsel-reviewed language; the mechanism (token page, signature
pad, snapshot) already exists on the proposal path to reuse.

### Agreements: read an inbound SOW (no migration) — BUILT
A received SOW is a source of truth about what the studio PROMISED: named
deliverables at named prices on named dates. Retyping that into the project is
the work this removes.
- lib/ai.ts `extractSow` + `parseSowDraft`, reusing the multimodal AiDocument
  path built for invoices. The prompt was written against BOTH real documents,
  because they differ: the brand one gives prose deliverables with an initial
  payment and a total, the subcontractor one gives a milestone table plus a
  per-deliverable fee table summing to a stated total. It must handle either.
- `parseSowDraft` is the trust boundary and is unit-tested against both shapes,
  including that the six Wave line fees add back to $57,544. It caps the list at
  60 rows (a runaway list is a misread, and each row becomes a project row),
  drops a nameless deliverable (nothing to file it against), rejects negative or
  absurd money, reuses the empty-digits fix so "n/a" does not become $0.00, and
  validates dates as REAL days. A date RANGE uses the last date, since that is
  the delivery date.
- Deliverables are PROPOSED, not applied: a checklist with per-row tick, running
  selected total, and Undo restoring the pre-read form verbatim. Applying calls
  `applySowDeliverables`, which APPENDS (never replaces hand-entered rows) and
  routes fees to `deliverable_pricing`, the studio-only table from 0074, never
  back onto the collaborator-readable `deliverables` row.
- PAYMENT TERMS go into the agreement's NOTES as text, not into a structure.
  Deliberate: cost_payments is money OUT, and there is no receivable-schedule
  object. Inventing one is a bigger decision than this slice. The terms stay
  readable without reopening the PDF, which is most of the value.
- `governedBy` is surfaced as a prompt ("it says it is governed by X, file that
  on the client") rather than auto-creating a parent, since we cannot know
  whether that MSA is already on file.

### Gear & crew day rates (migration 0075)
A `$/day` column on the Gear & crew page, plus a per-line `qty x rate` figure
and a "$X/day" total next to the confirmed count.
- The rate is NOT a column on `gear_items`: that table is collaborator-readable
  (can_access_project), so a column there would reopen precisely the leak 0074
  closed. It lives in `gear_rates` (studio/gear_item unique/rate,
  is_studio_member RLS), loaded via loadGearRates and written via setGearRate in
  lib/rates.ts, exactly like contact_rates. THIS IS THE PATTERN for any future
  money field on a project-scoped table: side table, never a column.
- Deliberately PER DAY, not per job. This page has no day count, and
  multiplying by a guessed one would misstate the number. Turning it into a job
  total is the budget page's business, where the day count lives.
- updateGearItem strips `rate` out of the gear_items patch and routes it to the
  side table; `canSeeRates` hides the column but is cosmetic, since RLS is the
  boundary.

### Collaborators and money columns: now enforced by RLS (migration 0074)
The long version of how this landed, because the first two attempts were both
wrong in instructive ways.

RLS is ROW-level. It cannot mask a single column of a row the viewer is allowed
to read, and column privileges are per-ROLE, so they cannot help either (a
studio member and a project collaborator are both `authenticated`). Three money
columns therefore sat on tables that migration 0056 opened to collaborators:
- `contacts.rate` (crew day rates, readable from the project roster)
- `deliverables.rate` (what the CLIENT is charged per deliverable)
- `ai_generations.cost` (spend per AI generation, in the provenance panel)

FIRST FIX (superseded): strip the column server-side in the page component,
hide the input, and drop the key in the write path. That worked, but it had to
be remembered at every new read site, and the third column was found only by a
LATER full sweep, having been missed by spot-checking.

DURABLE FIX (migration 0074): each value moved to its OWN is_studio_member
table (`contact_rates`, `deliverable_pricing`, `generation_costs`, each unique
on its parent id, cascade on delete), and the old columns were DROPPED. Dropping
is the point: leaving them would leave the leak open. A collaborator's query now
returns no rows, so the value is null with no application check at all.
- lib/rates.ts holds the six helpers (loadContactRates / setContactRate and the
  two equivalents). They deliberately contain NO isCollaborator check: RLS is
  the boundary. Do not add one, and do not move a value back onto the parent.
- Read sites merge the map back on (contacts page, budget roster,
  cost-actions' draftCostFromAttachment roster, delivery page, pipeline page).
  Write sites call the setters after the parent row is written.
- The `canSeeRates` / `canSeePricing` / `canSeeCost` props SURVIVE but are now
  COSMETIC: they hide an input so a collaborator is not shown a money box they
  cannot fill. Their doc comments say so. Deleting them would leak nothing.
- `deliverables.qty` stayed put: a count is not sensitive on its own.
- VERIFIED: a query for money-shaped columns across every can_access_project
  table now returns NONE. The typed Supabase client also turns any future
  attempt to read the old columns into a compile error, which is how all the
  read sites were found.
- Worth knowing for the next one: because the client parses select strings at
  compile time, `npx tsc --noEmit` after dropping a column IS the audit. Every
  site that touched it fails to build.

### Runner (the agent layer, migration 0077) — BUILT
An in-app assistant called RUNNER (left nav, Cmd/Ctrl+K) that reads the studio
and PROPOSES changes. Named for the production role: a runner fetches things,
checks things and reports back, and never decides, which is exactly the
contract below. It is a NAV ROW THAT OPENS A PANEL, not a page: the panel
slides over what you are reading and preselects the project whose page you are
on, both of which a route change would throw away (components/agent/
agent-open.ts is a toast-style pub/sub so the sidebar row, the mobile topbar
button and Cmd+K all drive one AgentMount in the shell). It first shipped as a
topbar icon next to the theme toggle, which the operator correctly called
hidden: a headline feature in the utility tray reads as a utility. Studio-wide with a project selector that defaults to whatever
project page you are on. This is the first thing built as a MARKET BET rather
than from real friction (the operator's call: peers are shipping agents and its
absence reads as dated), so the test is week two: if it is not being opened, it
stops, and there is a lot to stop.

THE CONTRACT, which is the whole design: the model never writes. Read tools run
for real; write tools are named `propose_*`, touch nothing, and return a CARD
listing every value that would be saved, with Create and Cancel. Only
`confirmCard` writes, and it does so by calling the ORDINARY SERVER ACTIONS the
UI calls (addCost, addTask, updateProjectStatus, ...). That is deliberate and
should not be "optimised" into direct database access: it means the assistant
inherits every existing guard (requireStudioContext, RLS, the money-column split
from 0074, the studio derivation, revalidation) instead of needing a second
safety layer that would drift. Same reasoning as the invoice extractor and the
Polish button: the model assists, the human commits.

- ARCHITECTURE. lib/agent/messages.ts = the normalized conversation shape plus
  both provider conversions (NO "server-only" on purpose, so it is testable).
  Anthropic carries tool calls as content BLOCKS and needs every result for one
  turn in a SINGLE user message; OpenAI carries them as a FIELD and needs one
  message per result with content null on a pure tool turn. Getting that wrong
  surfaces as a 400 from an API, not as anything readable, which is why it is
  unit-tested. lib/agent/loop.ts = provider dispatch (runTurn: one round trip
  in, text + tool calls out). lib/agent/tools.ts = registry + system prompt.
  lib/agent/read-tools.ts, cards.ts, values.ts, schema-map.ts, suggestions.ts.
- ROUTE HANDLER, NOT A SERVER ACTION (app/api/agent/route.ts, maxDuration 60).
  maxDuration belongs to the route segment and a Server Action inherits it from
  the calling page; the assistant is reachable from every page, so as an action
  its time limit would vary by route and a three-hop answer would die on some
  pages and not others. Streams newline-delimited JSON events (thread / step /
  text / card / error / done) so the panel can say "Reading the project" while
  it happens. The final text is NOT token-streamed: that needs partial
  tool-call accumulation on both providers, which is a lot of fiddly code for a
  paragraph, and the wait is in the steps.
- READS: five FAT tools (search, get_project with a sections argument,
  get_money, get_crm, get_attention) plus ONE OPEN `query` tool. Fat rather
  than granular because every call is a round trip: eight small reads is eight
  sequential hops before the first word. The open tool is the important one: it
  removes the ceiling where the assistant can only answer questions somebody
  thought to write a tool for ("which client asks for the most revision
  rounds" needs no new code). get_money and get_attention reuse
  summarizePayments / rollUpActual / marginOf / getOutstanding, so the
  assistant and the dashboard cannot disagree about the same number.
- THE QUERY TOOL'S BOUNDARY, and this is the part worth remembering: RLS is the
  real boundary for tenancy, but RLS will happily hand a studio member their
  OWN Google refresh token. So lib/agent/schema-map.ts is a generated whitelist
  of tables AND columns that excludes the credential tables (email_accounts,
  billing_accounts), every share token (review_links.token and its six
  siblings), drawn signatures, and the assistant's own conversation log.
  Columns are listed explicitly and `*` is never sent, so a column added to the
  database but not to the map is simply unreadable: it fails CLOSED, which is
  the right direction when the thing being withheld might be a token or a day
  rate. Regenerate the map when you add a table (same hand-maintained rule as
  database.types.ts).
- WRITES: eleven cards (log_cost, add_payment, mark_paid, create_task,
  log_activity, add_deliverable, move_project_stage, move_deal_stage,
  create_deal, add_contact, add_event). Deliberately NOT built, and not for
  timidity: no delete, no archive, and nothing that leaves the building (no
  sending email, no minting a share link, no invites). Deleting has no undo
  outside boards/shot list/storyboard, and a wrong send cannot be recalled.
  A card also has to be readable in two seconds; if a proposed change cannot be
  summarised in a handful of labelled fields, it does not belong here, because
  a confirmation you cannot check is not a confirmation.
- lib/agent/values.ts holds the parsers, used TWICE: once building the card and
  again in confirmCard, because the payload goes through the browser and comes
  back. Same "n/a" must not become $0.00 rule as the invoice extractor. Bug the
  tests caught: date() sliced to 10 characters before validating, so an ISO
  timestamp silently became a date and so did "2026-08-14garbage"; it now
  matches a time suffix deliberately and rejects trailing junk.
- THREADS ARE SCOPED, not one endless conversation (no migration; 0077 already
  had project_id, which was written once and never read). A thread belongs to a
  PROJECT or to the studio as a whole, and a scope can hold many. Opening the
  panel, or changing the project selector, calls openAgentScope, which resumes
  that scope's most recent thread only if it was used in the last 8 HOURS and
  otherwise starts a fresh one. The window is rolling rather than "today"
  because "today" needs the caller's timezone and this runs on the server.
  Reason it matters is correctness, not tidiness: each turn replays the last 40
  messages as context, so a thread running for weeks feeds the model facts that
  have since changed (a deposit now paid, a cut now approved) and it will state
  them confidently. This also fixed a real bug: changing the project used to
  keep the SAME thread, so the model saw ten turns about one job under a system
  prompt naming another. The route now stamps agent_threads.updated_at on every
  turn, without which the resume rule would be measuring when a thread STARTED.
  The client no longer stores a thread id at all (a stale one in sessionStorage
  would reopen a week-old conversation); only the scope is remembered.
  components/agent/thread-history.tsx is the history list, grouped by project
  because the question is "what have I been asking about Hint", not "what did I
  say on Tuesday"; picking one moves the project selector to match.
- Migration 0077 (agent_threads + agent_messages) persists the conversation.
  RLS is `user_id = auth.uid()`, NOT is_studio_member: a conversation carries
  what one person asked in their own words, and a colleague has no more business
  reading it than reading their notebook. Same shape as notification_reads.
- Panel: components/agent/{agent-mount,agent-panel,action-card,dictation,
  agent-open}.
  Never opens on a blank box (lib/agent/suggestions.ts seeds four chips from
  REAL state: an overdue vendor by name, a stalled project by name), because an
  empty chat box is how these features die and it fails the section 4.1 bar.
  Dictation is the browser's own speech API, so no audio is uploaded and it
  costs nothing; it hides itself where unsupported. Staff only (aiConfigured &&
  !isCollaborator, decided on the server) since it reads studio-member tables.
- NOT built, in rough order of likely usefulness: dropping a file into the chat
  to get a cost card (the multimodal extractInvoiceDraft path already exists, so
  this is mostly wiring and is the strongest remaining add), draft_email_reply
  into the Gmail composer, token streaming, and a scheduled read-only digest
  (which carries none of the autonomy risk because it cannot write, and the
  cron + Resend plumbing is already there).
- COMMERCIAL INTENT (operator, 2026-07-30): Runner is meant to sit in a PAID
  TIER, probably the highest one, as one reason among several rather than the
  only reason. Two consequences for anyone building here. (1) The gate is one
  function, lib/agent/access.ts canUseRunner(ctx), and it is called in exactly
  three places: the app layout (shows the nav row), the /api/agent route, and
  confirmCard. The last two are the REAL gate; hiding a nav row is presentation.
  When a plan column lands on `studios`, change that one body and nothing else.
  (2) Runner is the only feature in the app with a genuine PER-USE cost, which
  is the honest argument for it being the top tier, but it also means the tier
  cannot be priced without usage data. Nothing records tokens yet. Adding a
  token count per turn to agent_messages is small and worth doing BEFORE pricing
  rather than after.
- WHERE THE TIER LINE SHOULD FALL, as advice not decision: on SURFACES, not on
  "uses AI". The Polish button, the invoice extractor and the SOW reader are
  already shipped, already AI, and are helpers inside a flow; pulling them into
  a top tier later would read as taking something away. Runner is a surface of
  its own and has never shipped free, so gating it costs nobody anything they
  already had.
- LIMITS (lib/agent/limits.ts), added before beta because Runner is a CHAT BOX
  attached to a metered API, and a chat box invites holding down Enter. Two of
  them, deliberately different in kind. A per-user BURST limit (12 turns / 5
  min) uses the in-memory limiter and is honest about being best-effort. The
  DAILY cap (200 turns per studio / rolling 24h, RUNNER_DAILY_LIMIT overrides)
  is the one that actually bounds the bill, so it counts REAL ROWS: every turn
  already writes a user message to agent_messages with a studio_id and a
  timestamp, so the count IS the usage, shared across instances, no new table.
  It fails OPEN if the count query errors, since taking Runner down for everyone
  over a hiccup is worse than one uncounted question. Checked BEFORE any model
  call.
- SMOKE TEST: `GET /api/agent` makes one minimal round trip through the exact
  path a real turn takes (runTurn with the full tool registry) and returns
  {ok, provider, model, ms, replied, toolCalls} or the RAW provider error.
  VERIFIED WORKING 2026-07-30 on the deployment: ok true, provider openai,
  model gpt-5-mini, 17 tools, ~1.9s. So the OpenAI tool-calling request shape in
  lib/agent/messages.ts is confirmed correct as written; do not "fix" it against
  half-remembered docs. The ANTHROPIC tool shape is still unexercised (checked
  against the SDK types only), same status as the multimodal path. It
  exists because the tool-calling REQUEST SHAPE is the one thing that cannot be
  verified without a live key, and a shape mistake arrives as a 400 from an API
  rather than as anything readable. Staff only, rate limited like a turn. The
  error is raw on purpose: the audience is whoever deployed it.
- Provider failures are SANITIZED on the way to the browser (readableFailure in
  the route): a raw "OpenAI 400: {...}" in a chat bubble tells a producer
  nothing and reads as broken. Full detail still goes to Sentry.
- Env: OPENAI_AGENT_MODEL / ANTHROPIC_AGENT_MODEL / OPENAI_AGENT_EFFORT, all
  optional. It defaults to the model already configured so it never silently
  costs more than the deployment budgets for. gpt-5-mini can do this; a bigger
  model will pick tools better, which is the trade to revisit if it misroutes.

### AI summary rendering (no migration) — BUILT
The project summary was rendered as `whitespace-pre-wrap` muted grey text, so
the structure the model was already producing (one status sentence, then
labelled groups with "- " items) was thrown away and the operator got a grey
paragraph to hunt through. lib/summary-format.ts parseSummary() reads it back
into { lead, groups, rest } and components/projects/project-summary.tsx renders
the lead at 15px in full text colour (it is the twenty-second read), each group
behind a tinted status chip with a dot (green done / blue in progress / amber
waiting on / indigo next action / red watch, which is colour AS SIGNAL, these
labels are states), and items as spaced rows in full text colour rather than
muted.
- PARSED rather than switching the prompt to JSON, deliberately: summaries
  already stored in project_summaries are plain text and would otherwise render
  worse than before, and a model that drifts from the format should degrade to
  readable prose rather than to an error.
- NOTHING IS EVER DROPPED. Unrecognised lines come back in `rest` and are still
  shown as prose; an announced but empty group is discarded as noise.
- The model writes the two shapes interchangeably ("Waiting on:" then bullets on
  following lines, or "Waiting on: - a - b" inline), so both are handled. The
  inline split requires a dash with space on BOTH sides so "re-shoot the hero"
  is not broken in two. Unit-tested in the scratchpad against both shapes plus
  the hyphen case, unknown labels, and empty input.

### Project documents (migration 0078) — BUILT
The paperwork side of a job: permits, insurance certificates, licences,
delivery specs, agency schedules. Everything that arrives from outside, mostly
by email, and is not creative work. Came from the marketing question "where did
that PDF go", which the app could not answer.
- NO NEW TABLE. A document is an `assets` row with type='document' (0078 adds
  the enum value). The deciding argument is VERSIONS: a document is superseded
  constantly (call sheet v2, reissued permit, re-signed certificate), and a
  documents table without version history turns the second copy into a second
  row, which is exactly the spec_FINAL_v2.pdf mess this exists to end. Reusing
  assets also means storage signing, the token-guarded file proxy, collaborator
  access, search and the Runner schema all work unchanged.
- loadProjectAssets gained a `side` argument ("creative" default | "document").
  Creative EXCLUDES documents, so every existing caller (assets page, review,
  hub counts) keeps meaning what it meant and paperwork never appears in the
  creative library.
- PROVENANCE IS THE POINT, and it was missing. The old importAttachment stored
  only gmail_message_id + gmail_attachment_id, both unreadable, so a filed PDF
  read as Scan_20260814.pdf and "which email did this arrive in" was
  unanswerable without going back to Gmail. importAttachmentAsDocument
  (email-actions.ts) also stores from / subject / received_at, and
  lib/documents.ts documentSource() renders them as one line ("From Sean Doe,
  Aug 14, re: Final delivery specs"). Without that the page is just a folder,
  and Drive is a better folder.
- UI: an "Add to documents" button on an email attachment card, shown by
  isDocumentMime (anything not image/video/audio) on a thread tied to a
  project. It sits alongside the existing "Add to assets" and "Log as a cost",
  since a PDF can legitimately be any of the three. One click, no modal, on
  purpose: filing has to cost less than leaving it in the inbox.
  /projects/[id]/documents (components/projects/project-documents.tsx) lists
  them with source line, version count, Open, New version, plus direct upload.
  Deliberately NO review status and NO share-for-approval: nobody pins a
  comment on an insurance certificate. Hub card in the Produce band.
- ROUTING STAYS SPLIT, and this matters or the good structure unravels: a
  contract still goes to `agreements` (studio-only, two signature dates,
  expiry), an invoice still goes to a cost on the budget (amount, payment
  schedule, rate check). Documents is explicitly the "everything else" home.
- ACCESS, decided deliberately: documents ARE readable by project
  collaborators, because crew should see the call sheet and the permit, and the
  page says so out loud ("Crew with access to this project can see these"). The
  sensitive categories already have studio-only homes. If that turns out wrong,
  the fix is a per-document visibility flag, not a move to another table.
- PROJECT-SCOPED, not studio-wide (operator's call). A studio-wide library
  immediately raises "where does the master insurance certificate live", which
  is a different question.
- Bug found while building: email-actions.ts called reportError without
  importing it, so TypeScript was resolving it to the DOM's global
  reportError(e) (one argument). Every error in that file was being swallowed
  into the browser global rather than reaching Sentry. Now imported from
  lib/log.

### Guided tours (no migration) — BUILT
Cards that pop up over the real UI and say what things are. Held to one rule,
because section 4.1 says a flow that needs explaining is not done: a tour is
ORIENTATION, never INSTRUCTION. It answers "what is here and where does it
live", which is a real wayfinding problem now that a project has fourteen
module pages. It must never answer "how do I fill in this form", because that
hides a bad form instead of fixing it. Practical test when writing a step: if
you type the word "click", you are writing instruction, stop.
- lib/tour/tours.ts is the content (pure data). Two tours: `welcome` (the shell:
  setup checklist, nav, Runner, notifications) auto-runs once on the dashboard,
  and `project-hub` (stepper, the phase bands, needs-attention) auto-runs once
  on a project. Steps are anchored by `data-tour` ATTRIBUTES, not CSS selectors,
  so restyling cannot break them.
- THE RULE THAT STOPS IT ROTTING: a step whose anchor is not on the page is
  DROPPED, never rendered pointing at nothing, and a tour with no surviving
  anchored steps does not start at all. So deleting an element costs one step
  rather than breaking the tour, and the sidebar steps disappear by themselves
  on a phone (no sidebar) with no mobile-specific code.
- SPLIT ON PURPOSE: components/tour/tour-guide.tsx is the single renderer,
  mounted ONCE in the app shell, and components/tour/tour-trigger.tsx is the
  first-run starter that pages mount. An earlier version had the auto-start
  inside the renderer, which meant the "Take the tour" entry in the user menu
  silently did nothing on every page that did not mount one. tour-open.ts is
  the same pub/sub shape as the toast and Runner.
- "Seen" is localStorage (`tour.seen.<id>`), written when a tour ENDS rather
  than starts, so closing the tab mid-tour does not count as having taken it.
  Same call as the setup checklist: a per-person hint is not worth a migration.
  Known cost: a second machine offers it once more.
- The user menu's "Take the tour" replays, and picks the tour for the page you
  are on (the project one on a project, the shell one everywhere else). A tour
  that can only run once is one you cannot return to when you finally need it.
- The project tour is staff only (it talks about budget and agreements, which a
  collaborator cannot open).
- Positioning: preferred side, then whichever has room, then clamped to the
  viewport; the target is scrolled into view BEFORE measuring, since measuring
  mid-scroll puts the card where the element used to be. The scrim is one
  element (a 9999px spread box-shadow on the ring), not four.
- SCROLLING IS NOT scrollIntoView({block:"center"}), and this was a real bug
  found in testing: centring puts an element's MIDDLE on screen, so a STRETCHED
  anchor (the sidebar's <nav> is flex-1, so on a long dashboard it is as tall as
  the document) scrolled the page to somewhere near the calendar and drew its
  ring off the edge as a lone vertical line. scrollToShow now moves the MINIMUM
  distance and aligns the TOP when the target is taller than the viewport, and
  the ring rect is clamped to the viewport. The step also stopped anchoring to
  <nav> and anchors to the links inside it. Rule for a new anchor: point at
  something that hugs its content, never at a flex-1 or h-full wrapper.
- NOT built: tours that span pages (a step that navigates and resumes), which
  is a large jump in complexity for orientation content that does not need it.

### PDF import: read a document, get a shot list or a storyboard — BUILT
A client sends a treatment deck or a board as a PDF, and retyping it is the
work this removes. Reached from the shot list and the storyboard editors.
Tuned across three runs of the operator's REAL deck and then rebuilt twice
against a real board, which is the lesson: synthetic pages gave false
confidence every time.
- PANELS COME FROM THE DOCUMENT'S OWN PLACED PICTURES, not from slicing the
  page. lib/pdf-client.ts replays the operator list with a CTM stack to recover
  each image's placement rectangle; lib/panels.ts turns those into panels
  (`panelsFromImages`, painter's-order `coveredShare`/`trimAgainst` so an image
  buried under a later one is not offered twice).
- FURNITURE IS KEYED ON THE IMAGE OBJECT, never on position. The first version
  keyed on position and so classified all sixteen frames of a template board as
  a repeating logo and dropped every one of them. A logo is the SAME PICTURE on
  most pages; a template slot is a new picture in the same place. An image with
  no id is never furniture: keeping a logo costs one unticked panel, dropping a
  frame costs the import.
- CAPTIONS ARE GEOMETRY, NOT LANGUAGE (lib/captions.ts). A PDF carries a
  coordinate for every word, so `captionFor` reads the text printed under a
  panel (`belowRuns`) and, for a two-column board, beside it (`besideRuns`,
  band bounded HALFWAY to the neighbouring panels so frame two's description
  does not land in frame one's caption). `splitCaption` breaks it into
  scene / description / sound using the board's own labels; where a board uses
  none, the caption stays whole rather than being guessed at. The model's
  captions remain the FALLBACK for a board whose captions are drawn into the
  artwork.
- SHOT-LIST SIDE, two rules that came from the real deck: a cut is identified
  by a heading naming a DURATION, and only the beats under the longest one are
  read (told simply to "return every list", the reader counted the :15 as
  another list and returned three shots twice); and a supers-only script sets
  on-screen text in CAPITALS and beats in sentence case, so case is the stated
  separator. Visual-direction pages are asked for by name, since a deck usually
  describes the look before it lays out the script and each of those lines is a
  shot someone has to get. The boundary is whether the writing describes
  something SEEN, which is what keeps strategy slides out.
- THE CONFIRM STEP had to say what it was doing. It offered thirty-six "panels"
  for a sixteen-frame board, most of them cropped paragraphs. An automatic
  band-slicing fallback now keeps only slices that contain a picture (a page
  with no placed pictures is left alone, since that is a scan where the artwork
  IS the page; an explicit 3x3 the operator asked for is also left alone).
  Each tile carries the frame's number and the first line of its description,
  and the heading says "3 frames read from the file" against "9 cut by grid"
  rather than the word "detected".
- Verified end to end on the operator's ZELVARA board: 16 of 16 frames, every
  shot number, voiceover and shot description in its own field.

### Production documents look related to each other — BUILT
`components/production/production-cover.tsx` is the SHARED dark cover for the
shot list and storyboard exports (a second copy would have drifted the moment
either changed). It reads the project's `shot_boards` row, so filling the job
block in once on the shot list is what makes the storyboard export arrive
dressed. Storyboard frames restyled to match how the shot list presents a shot:
two up rather than three so a description is readable at print size, the frame
number on the picture, captions labelled Shot / Sound / Motion in the same small
uppercase. Bug fixed on the way: the storyboard export never forced light, so a
producer working in dark mode printed white type onto white paper.

### Confirm before an irreversible delete (components/ui/confirm.tsx) — BUILT
A storyboard, a shot list and a call sheet all sat behind a bare x and all three
take their children with them, with no undo to recover into (the editors
snapshot frames WITHIN a board, so there is nothing left once the parent is
gone). Same module-level pub/sub as the toast, one host in the app shell, so any
client can `await confirmAction()`. window.confirm stays as the fallback when no
host is mounted, since failing open on a delete guard is the right failure mode.
Each prompt names the thing and counts what goes with it; the call sheet one
says out loud that links already sent to crew will stop working.
DELIBERATELY NOT on frame, shot and card deletes: those have working undo, and a
prompt on a reversible action trains people to dismiss prompts.

### AI pipeline: voiceover, sequence review, editor handoff (0083, 0084) — BUILT
- VOICEOVER is a third STAGE on a shot, beside image and video (no migration:
  stage and kind were already free text). Filing generated VO as a project asset
  would have lost the only fact that matters, which read plays over which clip,
  and handed twenty files against twenty clips to whoever assembles the cut.
  AudioPanel is deliberately leaner than StagePanel (no references, no prompt
  library, no start/end roles: a read has a line, a voice and a take you pick)
  but shares the generation row, so provenance, cost, reject, star and pick
  needed no second implementation. `kindForStage` replaces a video-else-image
  ternary that would have filed audio as an image.
- EDITOR HANDOFF (`editor_handoffs`, 0084): a token page that hands the picked
  takes to whoever cuts. Deliberately NOT a review_link, because a review link
  exists to collect a DECISION and carries due dates, reminders and approvals;
  reusing it would have put handoffs in front of the overdue-review cron. LIVE
  rather than a snapshot (operator's call), and the page states when the
  sequence last changed. Files go out as `01_Paris-Cafe.mp4` and
  `01_Paris-Cafe.mp3`, same stem, so the pair survives a Finder sort by name.
  Bug caught pre-ship: the handoff found a take with a plain find() on role,
  correct while every pick was a picture; a VO take carries the same role, so
  without splitting by `stage !== "audio"` the editor would have been served
  audio where the clip goes.
- SEQUENCE REVIEW (0083 adds `sequence` to approval_target): a client who wants
  shots rearranged is reviewing the ORDER, not any one shot, and the per-shot
  review could never ask that. target_id is the project, like shot_list.
- IMAGE STAGE IS ONE POOL called References (operator spotted the doubling and
  was right): loose references in "Built from" AND candidates below were the
  same thing, a picture put on this shot, and which becomes a frame is decided
  by tagging Start or End, not by which box it was added to. THE VIDEO STAGE
  KEEPS THE SPLIT and this must not be flattened for symmetry: a motion clip
  driving a v2v generation is an INPUT and a take is an OUTPUT, so merging them
  would put the driving clip in the running for the cut. The sequence strip now
  skips only UNTAGGED references when picking a thumbnail, since one tagged
  Start is exactly what it should show.
- SCRIPT EDITOR is capped (about twenty lines) with the browser's own drag
  handle, height remembered per browser. Capped rather than moved into a modal,
  because the script is READ WHILE the sequence is built.

### Image performance: resized copies everywhere a stored image is drawn small
The operator reported "images take forever", and the cause was that a grid of
postage stamps was pulling full generator output (20 to 34MB PNGs). Supabase
Storage transforms on the fly and caches, so `signThumb` / `signThumbs`
(lib/asset-storage.ts) sign a resized copy and the caller falls back to the
original when resizing is unavailable. THE PATH IS LIVE ON THIS PROJECT
(confirmed on the deployment, it is a Pro-plan feature).
Covered: the assets library, storyboard frame grid, shot list row thumbnails,
the asset pickers inside both editors, the moodboard canvas, the public shared
board, the elements page, the candidate grid, the sequence strip, the triage
filmstrip, the Start/End frame slots (a pair of 220px boxes that were pulling
34MB each, not lazily, which was the bulk of it), the 20px element chips in
Built from, and the loose reference row. Everything lazy.
Board images take 1200px rather than 640, since a card can be dragged large.
DELIBERATELY NOT CHANGED: print and export views, and the review surfaces. A
client approving artwork is JUDGING the image; a compressed copy is the wrong
trade in exactly those two places.
Worth remembering: the first sweep was incomplete and the operator had to report
it twice. When fixing a class, grep for every draw site rather than the ones you
remember.

### Elements: batch entry and vocabulary (no migration) — BUILT
Follow-ons from the references rework, all from real use.
- Add SEVERAL elements at once, and BY LINK in batch, without the
  save-then-return step the operator called out ("I need to click create and
  then add my link").
- A bulk-added element records its handle, which is its name, since Higgsfield
  derives it the same way.
- A clashing handle now NAMES the element that already holds it.
- The toolbar is two buttons instead of five.
- WARDROBE is its own category. It used to live inside Prop, whose hint read
  "Wardrobe, a prop, a product", which made the one continuity question the page
  exists to answer take a hunt.
- AUTO is retired from the picker. It means "not sorted yet", which is the
  platform declining to insist; here the category IS the grouping, so an element
  with no category is one in the wrong place. It stays in the list, first and
  unpickable, because kindMeta falls back to the first entry for an unknown kind
  and that fallback has to read as uncategorised rather than mislabel it.

### Client project binder (migration 0085) — BUILT
From the operator's producer friend: bigger clients ask to "see it all in one
spot", and assembling that by hand costs four to six hours a job.
THE FEATURE IS LEAVING THINGS OUT. His two examples were a director's notes
column and a backup plan for a stunt the client never asked about, both things
the studio holds and the client should not see. So a binder is a CHECKLIST over
what the project already contains and the default for anything is OFF: a call
sheet added on Friday is not in a binder shared on Monday, because nobody said
it could.
- Composed from the renderers that already exist (DocSurfaceView for shot list /
  storyboards / moodboards / sequence, CallSheetDocument for call sheets). A
  storyboard in a binder has to look like the storyboard the client approved,
  and using the same component is the only way to guarantee that.
- ONE renderer serves the client's page, the studio's preview and the PDF, so
  what prints is what they were sent. Each section starts a page.
- LIVE rather than a snapshot (same call as the editor handoff); the builder
  says so.
- Sharing is a SEPARATE press from creating, so a link leaking from a half-built
  binder does not open: `loadBinderByToken` treats never-shared exactly like
  revoked.
- "Hide notes" BLANKS THE FIELD BEFORE RENDER rather than hiding a column in
  CSS. A value absent from the payload cannot be recovered from view-source,
  which is the standard for a document leaving the studio.
- Contacts carry no day rates (they live in a studio-only side table since
  0074), and `BinderContact` says so in the type because a binder is precisely
  where somebody would think to add them back.
- lib/binder.ts is pure and unit tested (unknown section defaults off, a deleted
  one drops out instead of rendering empty, a stored order survives).
- NOT yet run against a real project.

### PDF review with pins, page by page (migration 0086) — BUILT
A PDF fell into the portal's "everything else" branch: a preview, a flat comment
list, one text box. Fair when a PDF meant an invoice; not fair once a director's
storyboard started arriving as one, since a board is the thing a client most
wants to point at. It was skipped originally because a pin is a position within
a rendered media box and a browser's own PDF viewer cannot be measured or drawn
over.
- components/review/pdf-review.tsx renders each page to a CANVAS with the same
  pdf.js the importer uses, and hands it to PinCanvas as an ordinary pinnable
  surface. Everything the image path has (numbered pins, drawn markup, threaded
  replies, reactions, resolve, edit/delete) comes for free.
- `review_comments.pin_page` (0086) is the one genuinely new thing, because a
  PDF is SEVERAL surfaces. The rail shows only the current page's comments; a
  comment with no page (everything written before this, and anything left
  without pinning) shows on page one rather than disappearing. Page chips carry
  their own comment counts. Bounded on insert in both comment actions, so a page
  number from the public portal cannot be arbitrary.
- ZOOM RE-RENDERS, it does not stretch (Fit / 1.5x / 2x / 3x). Scaling up a
  1400px raster gives bigger blur and answers none of the complaint, which was
  that a client could not read the type. The cache is keyed by page AND zoom,
  capped at eight entries, and the previous render stays on screen while the
  sharper one is made.
- PinCanvas's stage now uses `[justify-content:safe_center]`. A centred flex
  item wider than its container overflows equally both ways and the left half
  becomes unreachable, since scrolling cannot go below zero. Every pinnable
  surface gets that, not just PDFs.
- Wired into BOTH the client portal and the in-app ReviewModal, so the studio's
  own review is not the poorer of the two.

### PDF page-one previews in a folder (migration 0087) — BUILT
Every grid drew a PDF as the same grey document glyph, so a folder of
storyboards, treatments, permits and delivery specs looked like one tile
repeated. A storyboard is a picture and should look like one in the folder.
- NO SERVER-SIDE RASTERIZER, deliberately: one means a native dependency loaded
  on every cold start to make a thumbnail. Page one is rendered in the BROWSER
  with the pdf.js already loaded for the importer and the review canvas, then
  posted back and stored (`versions.poster_path`, 0087; action
  app/(app)/projects/[id]/poster-actions.ts). It happens ONCE PER VERSION, ever;
  everyone after is served a ~40KB jpeg down the same path an image thumbnail
  takes and never downloads the document.
- The poster hangs off the VERSION, not the asset (v2 of a board has a different
  first page), and is derived data throughout: no access of its own, never the
  file anyone opens, clearing it costs a thumbnail rather than a document.
- Three rules keep the one-off cost from re-creating the slow-grid problem it
  exists to fix: nothing renders until the tile is on screen, ONE document
  renders at a time page-wide (a module-level promise chain, or ten boards would
  be ten simultaneous large downloads), and a file that fails is not retried in
  that session.
- components/projects/pdf-thumb.tsx. Its observed box must generate a real rect,
  never `display: contents`, or it never reports as on screen.
- Cropped to the TOP, since a page's title block identifies it and centring a
  tall page in a 4:3 tile cuts exactly that off.
- Wired into the assets grid and the documents list (which earns it most: a
  column of filenames tells you nothing about which permit is which).

### The asset viewer is a real window now (no migration) — BUILT
Opening a file from an asset card used a HAND-ROLLED dialog, so it was the one
window in the app with no Expand, no resize grip and no memory of its size. On a
PDF that is the worst place to be missing it.
It now uses the shared Modal, which needed three additions rather than a second
implementation: `titleNode` (a heading that is an editable filename plus a meta
line), `actions` (Open in new tab / Download / Delete, placed before Expand and
Close), and `bodyClassName` (a viewer wants a stage that centres media on a
neutral ground, not the default padded scroller). Size is remembered under
`asset-viewer`.
Expanding makes the DOCUMENT bigger, not the margins: the stage reads
`useModalRoomy` and grows the media, same rule the review canvases follow.
Handled rather than inherited: Escape while renaming cancels the rename, so the
input stops the key before it reaches the window's Escape-to-close.
DELIBERATE SPLIT, operator confirmed ("I like it the way it is, it gives you
both options"): Open serves the browser's own PDF viewer (fast, text selection),
Review serves the pinnable canvas. Do not collapse them.

### Call sheet confirmations: chased automatically (migration 0088) — BUILT
Per-recipient view/confirm tracking already existed (0038); acting on the gap was
left entirely to the producer, on exactly the days they have least attention to
spare.
- `call_sheet_recipients.last_reminded_at` + `reminder_count` (0088), and a
  daily cron at `/api/cron/callsheet-reminders` (lib/callsheet-reminders.ts,
  second entry in vercel.json, same 15:00 UTC and same CRON_SECRET guard). Its
  own route rather than folded into the review reminders so a failure in either
  cannot take the other down.
- THREE BOUNDS, because chasing crew is the fastest way to turn a helpful
  product into an annoying one: nothing fires until the shoot is within THREE
  DAYS (a sheet built three weeks out stays quiet), one a day at most CAPPED AT
  TWO (after that it is a phone call), and confirming stops it instantly since
  the query only ever sees unconfirmed rows. A sheet whose date has PASSED is
  dropped rather than chased. Only `sent`/`confirmed` sheets, never a draft.
- The email says "tomorrow" or "in 2 days" rather than a bare date.
- MANUAL COUNTERPART: `remindUnconfirmed` behind a "Remind N unconfirmed" button
  in the Send panel. It shares the same cap, so a manual chase plus the daily job
  cannot double up on one person.
- EMAILING A SHEET NOW MOVES IT Draft -> Sent (`markSheetSent`). Without it the
  status only moved if someone clicked the chip, which nobody does, and the
  reminders deliberately skip a draft, so they would silently never have fired.
  Only ever forwards: a sheet marked Confirmed is not walked back.
- SEEING IT, which is what breaks down at twenty people. The Send panel leads
  with three tallies (Confirmed n/total, Viewed but not confirmed, Not opened)
  plus filter chips, so "who has not answered" is one click. Those three are
  genuinely different problems: someone who opened it and did not confirm is
  probably fine, someone who never opened it may not have the link. The project
  hub's call-sheet card carries the same confirmed count, amber until everyone is
  in and green when they are.
- Added the `call_sheet_recipients` foreign keys to lib/database.types.ts, which
  the hub's embedded count needs (they were `Relationships: []`).

### Getting information out of an archived project
Asked by the operator, and worth recording because the answer is "it already
works" plus one gap that was closed. Archiving is SOFT: it sets `archived_at`
and nothing else, no rows removed, no files deleted, and there is no hard delete
anywhere in the app on purpose. Three routes back in: the Projects page
"Archived (n)" toggle, the client detail page (which still lists their archived
projects, usually the fastest months later since you remember the brand before
the job title), and Runner, whose `search` reaches archived projects and whose
`get_project` never filtered them.
CLOSED: `loadAgentContext` listed live projects only, so opening Runner while
standing ON an archived project silently fell back to studio scope, which is
exactly backwards for the case that sends someone there. The project you are on
is now added to the list even when archived. The picker still does not offer
archived jobs to browse, which is right: it is for the work in front of you.
CORRECTLY EXCLUDED and not to be "fixed": archived projects stay out of the
dashboard, the studio slate, the unpaid-invoice widget and `get_attention`.
Their bills are still owed, they are just not what a producer is being chased
about this week. Ask about one by name and the money still shows.

### Next step
STILL NOTHING QUEUED (reconfirmed by how the 2026-08 session ran: every item in
it came from the operator hitting something in real use, which is the rule
working). As of 2026-07-29 the operator has deliberately parked the
whole proposed backlog: run real jobs, and only build when something actually
gets in the way. That IS the project rule (section 4.5 / section 8), so do not
open a session by proposing features off the list below. Ask what got in the
way, or work on what is asked.

UNVERIFIED, as of 2026-08-20, and worth knowing before building on top:
- The CLIENT BINDER (0085) has never been run against a real project.
- The SHOT LIST side of the PDF import is unverified against the ZELVARA board;
  only the storyboard side was checked end to end.
- The call sheet AUTO-REMINDER has not yet fired on a real shoot. The manual
  "Remind N unconfirmed" button exercises the identical email path, so that is
  how to test it without waiting for a shoot date.
- RUNNER had been opened 8 times ever at last count. The week-two decision the
  build itself set ("if it is not being opened, it stops") is still unmade. Do
  not quietly let that lapse: either check usage and decide, or say so.
- The marketing site is live with four dashed placeholder boxes
  (public/marketing/shots/ is empty; scripts/capture-shots.mjs exists to fill
  them).
- Stewart's (the producer friend's) list still has open items: Wrapbook
  positioning, insurance bundling, zip-code permit lookup, a mobile on-set mode,
  a storage plan, a help desk, and Communication always open.

The parked items, so they are findable WHEN friction hits (not before):
- Review-round edges, all half-built already: due/overdue never surfaces on the
  INTERNAL review page (the client portal shows it, the studio cannot see which
  reviews are late); version compare is image-only; the in-app ReviewModal is
  handed one version's signed URL so compare does not work there at all.
- Weekly studio digest (lib/outstanding.ts + Resend already exist). Low value
  for a solo operator who is in the app daily; revisit when a second person
  joins or during a long shoot.
- AI feedback summarizer: turn a noisy review round into a revision brief.
  Revisit when a round actually gets noisy.
- CSV/PDF export for budget + contacts: DECLINED 2026-07-29, not how the
  operator works. Only revisit if a beta user asks.
- Collaborator money/comms pages render EMPTY rather than closed (see the
  collaborator section). Deliberate; fix only if it reads as broken.
- `ai_generations.cost` strip is unverified by a real collaborator login, since
  the test project was not an AI project. Same pattern as the two that were
  verified.

BILLING/INVOICING IS ON HOLD (see the "Billing / invoicing" section above)
pending the FreshBooks-vs-Melio decision; do not extend it until confirmed.
Remaining roadmap if the operator asks for direction: Phase 7 (AI-video
pipeline) is the flagship differentiator and is the one thing worth proposing
unprompted. See docs/DEVELOPMENT.md for setup.

AI PIPELINE (Phase 7, the flagship differentiator): architecture is DECIDED and
specced in docs/ai-pipeline.md. Key decision: one Project, same spine, with
production method as a PER-SHOT property (generated | live) so a single project
is all-AI, all-live, or hybrid; organize-don't-generate; provenance/lineage is
the moat; stages-as-data for future-proofing. A clickable mockup (Sequence /
Shot cockpit / Triage) was shown to the operator.
- Slice 1 (BUILT): spine + Script editor (rich text) + Sequence strip + per-shot
  image/video StagePanels with candidate triage, start/end/take roles, and
  provenance capture (platform/model/seed/etc) on every generation; bulk upload
  of candidates; per-candidate prompt (migration 0046).
- Slice 3 (BUILT): review, reusing the EXISTING doc-review stack. An AI shot is a
  new DocKind `ai_shot` (approval_target gained 'ai_shot', migration 0047; no new
  tables, reuses doc_reviews/review_comments/approvals/review_links). A "Send to
  review" button on the shot header (components/production/pipeline-workspace.tsx)
  calls sendDocToReview(projectId,'ai_shot',shotId) via a confirm modal
  (SendToReviewControl) that SPELLS OUT what's being sent (this shot + which of
  start/end frames + take are picked), so it's never a black box; once in review
  the header shows an "In review · Open" chip linking to the shot's review page.
  The shot then shows on the project Review page as a DocReviewCard whose "Open
  review" goes to a FULL PAGE (app/(app)/projects/[id]/review/shot/[shotId]/
  page.tsx -> components/review/shot-review-view.tsx), NOT the cramped modal, so
  media is large (frames render one-per-row, object-contain; the take gets the
  full timecode scrubber). Docs (shot_list/storyboard/moodboard) still use the
  DocReviewModal; only ai_shot got the full page. The page carries the internal
  team greenlight + a "what's in this review" chip row + the ShareDocButton for
  the client via /r/[token] (DocReview portal, same review + approve/request-
  changes). loadDocSurface gained an ai_shot branch (frames + take + a playable
  takeVideoUrl from ai_generations that carry a role); loadDocReviewsForProject
  resolves the shot title; targetInProject + createDocReviewLink validate the
  shot belongs to the project. The review canvas ADAPTS to the pipeline stage
  (components/review/ai-shot-review-canvas.tsx): a picked take VIDEO -> the
  timecode scrubber (reuse VideoReview: pause + comment at a moment, markers on a
  timeline, click to seek), with the start/end frames shown as a reference strip
  above; before a take exists (image stage) -> the pin canvas over the frames.
  Comment actions carry timecode as well as pin (addDocReviewCommentAt +
  submitDocComment gained a timecode arg; review_comments.timecode already
  existed from asset video review). Both the internal DocReviewModal and the
  client DocReview portal branch on surface.kind==='ai_shot'. NEXT for pipeline
  review: site-wide guest "view-only" invites deferred (share links cover
  external review for now).
- FLEXIBLE INPUTS refinement (migration 0063, foundation BUILT): the pipeline no
  longer hardwires image candidates -> Start/End -> video. Rationale: broader ICP
  (film/creative/CGI studios doing look-dev + video-to-video), and the category
  now does v2v / motion-driven / video-first, confirmed by a Higgsfield MCP
  capability scan (30+ models, media_import, motion_control, reference elements).
  - ai_generation_refs (studio/generation_id/ref_generation_id/role/position;
    is_studio_member RLS): a generation (output) references ANY number of other
    generations (inputs), each an image OR video, with a role (start | end |
    motion | style | character | ref). Generalizes the old
    parent_start_id/parent_end_id (image-only, exactly two); every input stays
    lineage-tracked (the moat). Actions in pipeline-actions.ts: addGenerationRef /
    removeGenerationRef / setGenerationRefs.
  - ai_shots.input_mode (frames | image_to_video | video_to_video | text_to_video,
    default 'frames'): a per-shot selector in the cockpit header (generated shots)
    that makes the IMAGE STAGE OPTIONAL. frames/image_to_video show the image
    candidates -> Start/End stage; video_to_video / text_to_video skip it and go
    straight to the video stage (video-first / v2v). updateShot gained input_mode.
  - References area on BOTH stages (BUILT): AddRefModal + ReferencesPanel let you
    attach references as status='reference' generations, kept out of the
    candidate/take grid (StagePanel splits gens into refs (status==='reference')
    + pool). Roles are stage-specific (REF_ROLES map): image stage = character /
    style / element / ref (the characters, styles, elements the shot's images are
    generated from); video stage = motion (driving v2v clip) / style / character /
    ref. Rendered for every generated shot's image AND video StagePanel. AddRefModal
    accepts MULTIPLE files AND MULTIPLE links (one per line, share pages or direct
    URLs) in one go; role applies to all; kind auto-detected per item; addReferences
    action (client-uploads files, server-fetches+stores links, bulk-inserts, per-
    link failure report). Sequence-strip thumbnails pick the first renderable gen
    (signed media or a direct image/video URL, skipping share-page-only URLs and
    reference inputs) and render video reps as <video> not <img>.
  - IMPORT FROM HIGGSFIELD (BUILT, the X-factor): pull the pool of clips a studio
    generated on an external tool straight into a shot, eliminating the download/
    re-upload round trip. Generation stays external; we organize + review + pick.
    UI = an Import button on BOTH stage panels (video: "Import from Higgsfield";
    image: "Import from link") -> ImportModal (paste up to 40 links, one per line,
    share pages OR direct media URLs; + platform/generated-by/prompt). Each link
    is fetched SERVER-SIDE, stored, and inserted as a CANDIDATE in the pool with
    provenance auto-stamped (platform auto-detected from the host, external_url=
    source link). The single-candidate AddGenModal ALSO takes any link now (not
    just a direct file URL): its submit calls addGenerationFromLink, which fetches
    + stores a share page OR direct URL and merges auto-provenance with manual
    overrides, so a share link pasted there pulls the real media in and previews
    (the old external_url-only path that couldn't preview a share page is gone). Partial success is reported
    per link with retry. lib/media-import.ts fetchMediaFromUrl (SSRF-safe via
    lib/unfurl safeFetch/isFetchableUrl; handles a direct .mp4/image URL OR parses
    og:video/og:image on a share page; 200MB cap). importFromHiggsfield action in
    pipeline-actions.ts (loops, downloads, service-uploads to
    <studio>/pipeline/<project>/, bulk-inserts). GenCard + FrameSlot now RENDER
    VIDEO (kind==='video' -> <video> thumb + controls in the open modal) so
    imported clips are viewable/playable in triage. Constraint that shaped this:
    Higgsfield's public REST API/SDK is generation-only (NO list-generations/media-
    history endpoint; that browse ability lives only in their agent-consumed MCP),
    so a fully-automatic "sync my whole pool" button is not buildable on their API
    today. The paste-links import gets the value now; the agent/MCP auto-pull is a
    later build tied to the parked BYO-Claude direction.
  - AUTO-FILL PROVENANCE FROM A LINK (BUILT): link-sourced candidates no longer
    need manual provenance typing. lib/media-import.ts now derives, per fetched
    file: platform (detectPlatform, from the URL host: Higgsfield/Kling/Runway/
    Pika/Luma/Sora/Midjourney/etc.), aspect (aspectRatio, snapped to common
    ratios) + resolution (resolutionLabel: video -> 720p/1080p/1440p/4K by short
    side, image -> WxH) read from the REAL media (imageDimensions parses PNG/JPEG/
    GIF/WEBP-VP8X headers; mp4Info parses the moov box = mvhd duration + the video
    trak's tkhd WxH), and a prompt hint from the page's og:description. Wired two
    ways: (1) importFromHiggsfield auto-stamps platform/aspect/resolution/
    duration/prompt on every imported clip (platform detection wins, batch
    platform is the fallback); (2) the manual AddGenModal single-URL path has an
    "Auto-fill from link" button (inspectMediaLink action fetches + returns the
    derived fields; fills platform/aspect/resolution/duration + prompt-if-empty).
    DELIBERATELY NOT auto-filled: model/seed/guidance -- no platform exposes them
    via a share link or standard file metadata (they'd need a real per-platform
    API connector, which the operator chose to skip); they stay optional manual.
  - TRIAGE FAST-LANE (BUILT, migration 0064 = ai_generations.starred): the fan-out
    fast lane for judging a batch. A "Triage N" button on each StagePanel pool
    (image or video, shown when >1 candidate) opens a FULL-SCREEN neutral-dark
    overlay (components/production/triage-view.tsx, portaled to body; neutral bg
    regardless of theme per the asset-review principle). Keyboard-first: ← →
    (or j/k) move, x reject/restore, s star, 1/2 tag Start/End (image), Enter
    pick take (video), c add-to-compare, esc close. Decisions are OPTIMISTIC
    (instant local override merged over the server row, persisted in the
    background via setGenerationStatus/setGenerationStarred/setGenerationRole,
    reconciled when the RSC payload refreshes). STAR is a shortlist tier between
    kept and the final pick (new `starred` column, orthogonal to status + role)
    so you narrow 100 -> a few -> the one. Filter chips (All/Kept/Starred/
    Rejected w/ counts) + a per-model filter; a big object-contain stage (video
    autoplays w/ controls); a provenance sidebar (prompt + platform/model/seed/
    etc + open-original); a bottom filmstrip (status/star/role badges, click to
    focus, auto-scroll). COMPARE mode: pick up to 4 (c or the Compare toggle) and
    view them side-by-side, each with its own pick/star buttons — for choosing
    between near-identical takes. Reuses the existing role/status actions; only
    setGenerationStarred is new. Auto-advance on reject only in the All filter
    (in Kept the item leaves the list, so the index already lands on the next).
  - PROMPT / STYLE LIBRARY (BUILT, migration 0065 = ai_prompt_library): reusable
    prompts + STYLE TOKENS (a look fragment carried across shots for consistency),
    so you're not retyping a 200-word prompt every batch and a whole job shares
    one look. ai_prompt_library (studio_id/project_id nullable/kind prompt|style/
    name/body/stage nullable/target_model; is_studio_member RLS). project_id null =
    studio-wide (follows you across projects); set = this project's look. The page
    loads library rows (studio-wide + this project) and passes them down.
    components/production/prompt-library.tsx: LibraryButton (top control, opens a
    ManagerModal = full CRUD, grouped Style looks / Prompts, scope + stage badges,
    EntryEditor add/edit w/ kind + name + body + stage + model + scope) and
    LibraryBar (in each StagePanel's working-prompt block: style looks as
    click-to-append chips that show ✓ when already applied, a "Use a saved prompt"
    dropdown that REPLACES the working prompt, and a "Save current →" that opens
    the inline EntryEditor prefilled with the current prompt). Applying a style
    appends its body (dedup: skipped if already present) and persists via the
    existing savePrompt; entries filter to the stage (stage null = either).
    Actions saveLibraryEntry/deleteLibraryEntry in pipeline-actions.ts. NOTE: no
    version-history tree yet (editing updates in place; updated_at tracks);
    deferred.
  - MASTER CUT (BUILT): the assembled deliverable + its revision rounds, living in
    the SAME Assets -> Versions spine as everything else (the project's asset of
    type 'cut'; no migration -- asset_type already had 'cut'). A "Master cut"
    toggle button in the pipeline controls (next to Script/Library) reveals a
    full-width band below the Sequence strip (manual open, NOT gated on shot
    approvals; defaults open once a version exists, shows a vN count). Editing/
    assembly stays OFF-app (organize-don't-edit): export the cut, upload it here
    as a Version (device file OR a link we fetch+store), collect timecoded feedback
    via the existing ReviewModal (video -> VideoReview scrubber), share with the
    client via the existing ShareReviewButton (/r/<token>), edit externally, upload
    the next version. Each version shows its review summary (Pending/Changes/
    Approved from approvals) + open-note count. First version flips the cut asset
    draft->in_review so it ALSO appears on the project Review page. components/
    production/master-cut-band.tsx (UploadVersionModal + VersionRowView + reuse of
    ReviewModal/ShareReviewButton); addMasterCutVersion + ensureMasterCut in
    actions.ts (reuse insertVersion); the pipeline page loads it via
    loadProjectAssets (find type==='cut') + its review link, passes masterCut/token/
    linkId/currentUserId to PipelineWorkspace. Each version's "Review" opens a
    FULL PAGE (app/(app)/projects/[id]/review/cut/[versionId] ->
    components/review/cut-review-view.tsx), NOT the cramped modal, matching the
    AI-shot review treatment: big VideoReview timecode scrubber (or PinReview for a
    still) + comment rail + version switcher chips + internal sign-off + client
    ShareReviewButton; reuses the asset review-actions (addReviewCommentAt/
    resolveReviewComment/setVersionApproval). NOT built: video version-compare
    (image-only today), whole-sequence auto-assemble (deliberate -- we don't edit),
    asset-level status menu in the band.
  - SHAREABLE BATCH REVIEW ("send options for a pick", migration 0066): curate a
    SUBSET of a shot's candidates and share a no-login /rb/<token> link so a
    reviewer (creative director, client) plays each, COMMENTS (timecoded on
    video), STARS (shortlist), and marks ONE as their PICK. NON-DESTRUCTIVE: the
    reviewer's input lives in its own tables and never touches ai_generations
    status/role -- the producer stays the decider and sees the feedback back on
    the shot. It's "triage, but shareable." Tables (all is_studio_member RLS,
    studio_id denormalized so the public /rb route reads/writes via the SERVICE
    role, token-gated): ai_batch_reviews (the link + set), ai_batch_review_items
    (which generations), ai_batch_review_comments (per-candidate, timecode),
    ai_batch_review_marks (per reviewer_name per candidate: starred + is_pick,
    one pick per reviewer enforced in the action). lib/batch-review.ts:
    loadBatchByToken (service, signs media for the public page) +
    loadBatchReviewsForProject/ForShot (RLS, for the internal results). Internal:
    batch-review-actions.ts createBatchReview/revokeBatchReview; components/
    production/batch-review-button.tsx ("Send for a pick" in each StagePanel pool
    header -> modal to checkbox-curate candidates + title -> copy /rb link, plus a
    per-reviewer results roll-up: who picked which Option # + stars + notes, with
    turn-off). Public: app/rb/[token]/{page,actions} + components/review/
    batch-review.tsx (name gate + big player + filmstrip with your ★/✓/comment-
    count badges + star/pick/timecoded-comment, optimistic). Middleware
    PUBLIC_PATHS gained /rb; feedback fires a notification. Star+pick only (no
    full 1-2-3-4 ranking yet). NOTE reviewer_name keys a reviewer like the client
    portal (no login); multiple reviewers can use one link. EDIT + DELETE (BUILT):
    a sent review's option set is editable in place ("Edit options" opens the same
    candidate grid over the existing selection -> updateBatchReviewItems adds the
    newly-checked + removes the unchecked while PRESERVING existing options'
    positions, so a reviewer's "Option 2" stays the same clip and the SAME /rb link
    keeps working, no resend); "Delete" hard-deletes the review + its items/comments/
    marks (FK cascade, confirm-gated) vs "Turn off" (revoke, keeps the row).
    Actions updateBatchReviewItems/deleteBatchReview in batch-review-actions.ts; the
    create + edit panels share one CandidateGrid in batch-review-button.tsx.
  - REFERENCES (was "the cast layer"; migrations 0080, 0081, 0082). ONE object:
    a reference is an image, a name, and the HANDLE the platform gave it. That
    is what Higgsfield actually stores, so there is nothing to translate.
    HOW IT GOT HERE, because the lesson is worth more than the feature. 0080
    shipped a three-level model (entities -> looks as COMPOSITIONS of element
    entities -> per-platform handles) plus a continuity grid and a four-check
    prompt linter. It was correct about the domain and wrong about the job: to
    generate ONE shot the operator had to maintain a hand-typed mirror of their
    Higgsfield element library, in a vocabulary this app invented, on a page
    away from the work, and then satisfy warnings about it. The tell was a dozen
    consecutive commits each fixing a rule that fired on a CORRECT setup (a look
    handle not counting for its entity, "no look" flagged on a base state, a
    charset rule that made "LOC-01/B" unrecordable). When the corrections
    outnumber the work, the model is wrong, not the edge cases. 0082 flattened
    every look into a reference, carrying handles, images and shot assignments
    across, and re-added the parent to any shot whose assignment moved (Maya
    wearing LK-01 is two references, not one). ai_looks / ai_look_items survive
    UNREAD for rollback; ai_shot_cast.look_id is always null.
    WHAT EXISTS NOW. `ai_entities` holds references (name kept from 0080; a
    rename would churn 32 RLS policies and the agent schema map for no
    behaviour). `ai_entity_handles` are entity-owned only. A reference's images
    are `ai_generations` rows with status='reference' and entity_id set.
    `ai_shot_cast` is (shot, reference), nothing else. lib/cast.ts is the pure
    module: REF_KINDS mirrors Higgsfield's own categories (Auto / Character /
    Location / Prop; `crowd` is legacy, kept out of the picker via
    PICKABLE_KINDS), normalizeHandle keeps a handle VERBATIM (no charset of ours
    -- both an early lowercase-and-underscore rule and a later allowed-character
    rule silently broke real handles), suggestedHandle derives it from the name
    since Higgsfield does the same, and lintPrompt makes exactly ONE check: a
    handle in the prompt that none of this shot's references owns. That is the
    only failure invisible without us; the platform ignores it silently and the
    model improvises. A reference LEFT OUT of a prompt is reported by its chip
    not showing a tick, which is feedback rather than a scolding.
    WHERE THE WORK HAPPENS. Which references a shot uses is set ON THE SHOT, in
    the pipeline, above the prompt being written (components/production/
    prompt-cast-bar.tsx: chips insert the handle at the caret, "+ References"
    opens a checkbox picker, a platform selector persists in localStorage). That
    ordering is the single biggest thing the rework fixed: data entry used to
    live on a page you had to know to visit first. /projects/[id]/elements is a
    flat grid of element cards plus a READ-ONLY usage map (dots, not dropdowns),
    and its modal mirrors Higgsfield's New Element dialog field for field.
    VOCABULARY, settled 2026-08-04 and matching the platform exactly: an
    ELEMENT is saved, named and carries an @handle (the library page, and the
    top row of a shot's "Built from" panel); a REFERENCE is a one-off image fed
    into one shot with no handle (the bottom row). A reference is promoted with
    "Save as element" (promoteToReference), which is the move Higgsfield itself
    supports and the reason they were never really two systems. Do not
    reintroduce a third word: the page was briefly called References while the
    shot panel called the same objects Elements, and the route was /cast. Actions in cast-actions.ts: saveReference / archiveReference /
    saveHandle / deleteHandle / setShotReference / addSheet / addSheetFromLink
    (link import reuses lib/media-import fetchMediaFromUrl, SSRF-guarded) /
    deleteSheet.
    LOST DELIBERATELY: asking which shots a single garment appears in
    independently of the outfit. Real, but it can return as optional GROUPING on
    top of references rather than as a concept nobody can avoid on day one.
    GATING: the hub card is ai_video ONLY (2026-08-04), matching the AI
    Pipeline card. It briefly also showed for cgi_vfx on the theory that a CG
    job has the same continuity problem, which is true but beside the point:
    elements are spent in the pipeline's prompt bar, and a cgi_vfx project has
    no pipeline, so it was a library with nothing to use it on. The route is not
    hard-blocked, per the standing project_type convention.
    WANTED: this on a LIVE-ACTION shoot (operator, 2026-08-03). Wardrobe and set
    continuity is a real discipline with no AI in it, and references + the usage
    map already fit. What must not come along is the handle machinery, so the
    change is showing the hub card for live_action/commercial AND hiding the
    handle field + the prompt linter when the project type is not generated.
    Small, and only worth doing when a real live job asks.
    NEXT: agent-mediated handle reconciliation. Higgsfield's MCP exposes
    show_reference_elements (verified live: it returns id, name, category and
    media per element), so the app could READ the element library and match or
    fill handles rather than have anyone type them. Their public REST API is
    generation-only, so this needs the agent path, not a server-side sync.
  - NEXT (this refinement): record refs on created takes (references live at shot
    level today). Higgsfield generate-in-app = agent-mediated (MCP) or their HTTP
    API, BYO-account; deferred (organize-first stays intact). The organize-the-
    fan-out trio (flexible refs + import + triage + library) is now complete.
