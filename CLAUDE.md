# CLAUDE.md

This file is the operating context for building this product in Claude Code. Read it at the start of every session. It is the lean, build-facing reference. Deeper strategic context (the why, the market, the endgame) lives in PROJECT_BRIEF.md.

Note on naming: the product name is not yet decided. This document refers to it as "the Hub" as a working placeholder. Replace once a name is chosen.

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
    the useful timeline is a future STUDIO-wide slate view, one lane per
    project). Shows the project's shoot_date/due_date as read-only milestones
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
  "here's how it works" 3-step row + hue; used on Projects/Leads/project Assets.
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
  as a hidden input). createProject validates + stores it.
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
- STILL a gap: the asset-version upload (Assets page) is CLIENT-side (browser
  uploads directly to storage, then posts the storage_path), so a collaborator
  can't add a new asset/version yet (client storage RLS is is_studio_member). Fix
  = a server upload endpoint that takes bytes + service-uploads; deferred (their
  main tasks -- storyboard/moodboard edits, call sheets -- work). Minor edge:
  internal doc-review image signing (loadDocSurface RLS path) not yet service-
  backed for collaborators.
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
- NOT yet: a locked read-only "viewer" role (would need an RLS write/read split
  across all tables via an is_studio_editor() helper; deferred). A multi-studio
  switcher (a user can now belong to 2+ studios but getStudioContext still picks
  the earliest; switcher deferred). Email delivery of invites (we hand back a
  link to copy; no transactional email yet). Internal ungated feedback in the
  working/overview view is the next pipeline step (step 2 of the plan).

### Billing / invoicing — BUILT BUT ON HOLD (do not extend until platform is decided)
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
