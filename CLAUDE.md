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
  lib/review-links.ts) + token-guarded file proxy.
- AI layer (Phase 4): provider-agnostic (lib/ai.ts, Anthropic or OpenAI).
  Project summary, AI-drafted client update, AI-drafted lead outreach. Rules-
  based (no-LLM) stalled-work flags (lib/outstanding.ts) and lead follow-up
  flags (lib/leads-followup.ts).
- CRM depth (Phase 5): leads pipeline board, follow-up flags, AI outreach,
  editable lead notes.
- Boards: freeform moodboard/storyboard canvas (studio-wide, project-linkable),
  tabs, drag/resize/z-order, notes, zoom, desktop drag-drop, dots/grid/plain
  background; import via upload/project assets/Drive/Figma.
- Production-ops (Phase 8): per-project Production workspace
  (/projects/[id]/production) with tabs: Shot board (cover + Shots/groups +
  cards, present/export view at /production/board), Call sheet (industry layout,
  PDF export at /production/callsheet), Budget (bid vs actual), Gear & crew,
  Delivery + billing. PDF export = print view with app chrome hidden and forced
  light/exact colors.
- Studio logo upload (Settings → Branding); shows on sidebar, call sheet, shot
  board cover.
- Modals render via portal to document.body (avoids fixed-in-transform bugs).
- Notifications layer: studio-scoped `notifications` table (0024), bell dropdown
  in the topbar (unread badge, poll, mark read/all, needs-you row); client
  review actions generate notifications (lib/notifications.ts).
- Project workspace is phase-organized (StudioBinder-inspired, our quiet visual
  language): components/projects/project-workspace.tsx renders a phase nav
  (Overview / Brief / Assets / Communication in-page tabs + Production as a link
  to /production) with an always-present Activity rail. Per-phase color is quiet
  wayfinding (a small hue dot), kept distinct from status color. See
  docs/competitor-research/assessment.md for the rationale + backlog.
- EmptyState (components/ui/card.tsx) supports rich empty states with an optional
  "here's how it works" 3-step row + hue; used on Projects/Leads/project Assets.

### Environment variables (set in Vercel; needed to reproduce in a new env)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required for the client review portal `/r/...`)
- `NEXT_PUBLIC_SITE_URL` (optional; canonical origin)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Gmail/Chat/Drive/Calendar). Enable
  those APIs + add scopes in Google Cloud; users reconnect to grant new scopes.
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET` (Figma app scope: `file_content:read`;
  redirect `<domain>/auth/figma/callback`)
- AI (optional): `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default gpt-5-mini) or
  `ANTHROPIC_API_KEY`; `AI_PROVIDER` to force one.

### Schema / migrations
DB changes are applied via the Supabase MCP `apply_migration` and mirrored as
files in supabase/migrations (through 0023: production-ops). When adding a
table/column, also hand-update lib/database.types.ts.

### Working notes for a fresh session
- Dev branch: `claude/production-hub-phase-1-km1k0k`. Deploy = push to `main`
  (Vercel auto-deploys). Pushes go to github.com directly (the in-env git relay
  + GitHub MCP are read-only).
- Commits show as "Unverified" (no GPG/SSH signing key in this environment);
  committer email is already noreply@anthropic.com. This is expected; do not try
  to fix it by rebasing deployed history.
- Standing style rule: no em dashes in any generated content.

### Next step
Run a real job through Production and the connectors; let friction drive the
backlog. Remaining roadmap: Phase 7 (AI-video pipeline), a notifications/inbox
layer, and deepening (e.g. PDF export for budget/gear/delivery, per-card Drive/
Figma import on the shot board, public share link for the shot board/call sheet).
See docs/DEVELOPMENT.md for setup.
