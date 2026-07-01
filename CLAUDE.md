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

Strategy, scope, data model, and design direction are decided.

Phase 1 (foundation) is built:
- Next.js (App Router, TypeScript) scaffolded, Tailwind wired token-first to the OKLCH tokens as CSS variables, dual-theme (data-theme: system default + manual toggle + localStorage) and data-accent (indigo default), fonts Plus Jakarta Sans + Hanken Grotesk. Token/theme reference page at /dev/tokens.
- Supabase project provisioned (org GuthubAi, project "production-hub", ref wvcodunxakdiojgelbgc). Client/server helpers + auth middleware in place.
- Schema applied (see supabase/migrations): full data-model spine, multi-tenancy (studios, memberships, roles), RLS scoped by studio membership, private assets storage bucket, signup studio-bootstrap trigger. TypeScript types in lib/database.types.ts.
- Auth (email/password) with studio bootstrap on signup. App shell (sidebar Projects/Clients/Leads/Settings + topbar theme toggle). Projects (list + color-as-signal board Pre-pro/Shoot/Post/Delivered + detail with brief, assets, manual version history, internal activity). Clients + contacts. Leads with pipeline stage and convert-to-client then start-a-project. Settings (studio, team, appearance).

Verified: build/typecheck pass; signup trigger, RLS studio-isolation, and authenticated insert checks verified directly against the live database. Full in-app runtime click-through was not exercised here because this sandbox's network egress allowlist blocks the app's server-side calls to *.supabase.co (environment config, not a code issue; Vercel is unaffected).

Next step: deploy to Vercel (set the two NEXT_PUBLIC_SUPABASE_* env vars), run a real job through it, and let friction drive the Phase 2 backlog. Naming still a placeholder ("The Hub"). See docs/DEVELOPMENT.md for setup.
