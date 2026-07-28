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
- NEXT: (5) end-to-end verification with a real second (collaborator) account
  (invite -> accept -> confirm they see only their project + can edit storyboard/
  moodboard + cannot reach studio-wide pages). Collaborator asset viewing +
  storyboard/moodboard editing now work, so a real collaborator can be tested.

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
files in supabase/migrations (through 0049: project_type; 0048 =
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
- Dev branch: `claude/production-hub-phase-1-km1k0k`. Deploy = push to `main`
  (Vercel auto-deploys). `main` and the dev branch are kept converged (same
  history); push commits to both.
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
  major upgrade, deferred. Supabase leaked-password protection = a dashboard
  toggle (still to flip). Migrations now through 0065 (0059 project_tasks, 0060
  billing_document_signatures, 0061 billing_proposals_style_attachments, 0062
  review_due_dates, 0063 ai_flexible_references, 0064 ai_generation_starred, 0065
  ai_prompt_library, 0066 ai_batch_review).

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

### Next step
BILLING/INVOICING IS ON HOLD (see the "Billing / invoicing" section above)
pending the FreshBooks-vs-Melio decision; do not extend it until confirmed.
Otherwise: run a real job through Production and the connectors; let friction
drive the backlog. Remaining roadmap: Phase 7 (AI-video pipeline), a
notifications/inbox layer, and deepening (e.g. PDF export for budget/gear/
delivery, per-card Drive/Figma import on the shot board, public share link for
the shot board/call sheet). See docs/DEVELOPMENT.md for setup.

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
  - NEXT (this refinement): record refs on created takes (references live at shot
    level today). Higgsfield generate-in-app = agent-mediated (MCP) or their HTTP
    API, BYO-account; deferred (organize-first stays intact). The organize-the-
    fan-out trio (flexible refs + import + triage + library) is now complete.
