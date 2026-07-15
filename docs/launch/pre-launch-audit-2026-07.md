# Pre-launch audit and competitive assessment

Date: 2026-07-15. Written ahead of the first beta-user wave. Two parts:
Part 1 is a readiness audit of the build (what to fix before inviting
strangers in). Part 2 is a fresh scan of the competitive field (where we
win, where we are behind, and what to build to be the clear better choice).
Part 3 turns both into a prioritized action list.

Method: full codebase audit (every dimension below is evidence-backed with
file paths), a clean-build verification (tsc + production build both pass),
Supabase security/performance advisors on the live database, and seven
parallel web-research tracks covering roughly 35 competitors across every
adjacent category. Competitor pricing was frequently triangulated from
third-party sources because vendor pages block fetches; numbers marked
where unverified.

Standing style rule applies: no em dashes.

---

# Part 1: Readiness audit

## 1.0 The headline

The product is functionally in strong shape for a beta: the feature surface
is unusually complete, multi-tenancy/RLS discipline is real, share-link
token entropy is solid (192-bit), empty states are good, and the app builds
clean (tsc and `next build` both exit 0). The gaps are almost entirely
operational hardening: recovery paths, observability, and honest failure
surfacing. None are deep architectural problems. A focused hardening pass
of roughly the ten items below is what stands between the current build and
a beta you can leave alone while strangers use it.

## 1.1 Fix before beta (top 10, ordered)

1. **Password reset flow (blocker).** There is no reset code anywhere and
   no "Forgot password?" link (`components/auth/auth-forms.tsx`). A beta
   user who forgets their password is permanently locked out. Add a
   forgot-password page calling `supabase.auth.resetPasswordForEmail` plus
   a reset-confirm route.
2. **Error boundaries (blocker).** Zero `error.tsx` / `global-error.tsx`
   files exist in the app. Any thrown server error (failed Supabase call,
   expired token, null deref) renders Next's raw crash screen. Add
   `app/global-error.tsx` + `app/(app)/error.tsx` with a retry button.
3. **Email-confirmation dead end (high).** Signup can return "Check your
   email to confirm" with no resend action (`app/auth/actions.ts`).
   Combined with #1, a mistyped email is a dead account. Either disable
   confirmation for beta or add a resend.
4. **Error monitoring (high).** No Sentry or equivalent in the app. You are
   blind to what beta users hit in production. Add Sentry (or at minimum
   Vercel error tracking) before invites go out.
5. **Stop swallowing write errors (high).** Several mutating server actions
   ignore the Supabase `{ error }` and return void, so a failed write looks
   like success: `updateProjectStatus`, `updateProjectColor`,
   `archiveProject`, `unarchiveProject`, `updateProject`
   (`app/(app)/projects/actions.ts`), plus the notification mark-read
   actions. Surface errors (toast) or at least log them.
6. **Unfurl SSRF (high).** `lib/unfurl.ts` screens the initial hostname but
   fetches with `redirect: "follow"` (line 93), so a public URL that 302s
   to a private address (cloud metadata, internal hosts) is followed and
   stored. Switch to `redirect: "manual"`, re-validate every hop, resolve
   DNS against private ranges, cap redirects.
7. **`not-found.tsx` + `loading.tsx` (high).** Neither exists anywhere.
   Pages call `notFound()` into an unstyled 404, and every navigation
   blocks with no skeleton. Add both at the app-group level and for
   `projects/[id]`.
8. **Hide the paused billing entry points (medium).** The Delivery page
   still renders the FreshBooks InvoicingPanel and the "Open invoice
   generator" link while the whole area is on hold. Beta users can wander
   into a flow the operator considers unfinished. CLAUDE.md documents
   exactly what to hide.
9. **Terms + privacy pages (medium).** None exist, there is no landing
   page (`/` goes straight to dashboard/login), and beta means holding
   real client data. Add minimal `/terms` + `/privacy` and link from the
   auth pages.
10. **CI (medium).** No `.github` workflows and zero tests. Cheapest
    regression net: a GitHub Action running `tsc --noEmit` + `next lint`
    on push. A couple of smoke tests on the auth and review-portal token
    paths (the security-critical surfaces) are the next increment.

Runner-ups, in rough order: an in-app "Send feedback" channel for beta
users (there is none, and beta feedback is the whole point); enable leaked
password protection in Supabase Auth (one toggle, currently off per the
security advisors); rate-limit the public token routes (`/r/[token]`,
`/c/[token]`) against comment spam; collaborator asset upload + doc-review
image signing (the two known collaborator gaps); add
`SUPABASE_SERVICE_ROLE_KEY` to `.env.example` (a misconfigured deploy
silently kills the review portal); product analytics (PostHog or Vercel
Analytics) so you can see what beta users actually use.

## 1.2 What the audit found healthy

Worth stating so the fixes above land in context:

- **Security and multi-tenancy are the strongest dimension.** All
  authenticated mutations run through the RLS client behind
  `requireStudioContext()`; RLS (`is_studio_member` /
  `can_access_project`) is the real boundary. Service-role usage is
  disciplined: `server-only`, non-public key, every site token-gated or
  gated on already-authorized rows. OAuth callbacks validate a CSRF state
  cookie. Token entropy: review/call-sheet links 192-bit, invites 144-bit.
  Enumeration is impractical.
- **Supabase advisors are mostly clean.** The security warnings are the
  by-design anon-callable invite-preview RPCs. Actionable: the leaked
  password protection toggle. Performance lints are low-stakes (unindexed
  FKs and a few RLS initplan warnings on `studios` / `project_members` /
  `email_accounts`; batch-fix them in a housekeeping migration when
  convenient).
- **No classic N+1 in the hot loaders** (Promise.all + batched `.in()`
  lookups). Lists are unbounded but fine at boutique-studio data volume.
- **Empty states are a genuine strength** (rich EmptyState with how-it-works
  steps), which was a top gap in the July 6 StudioBinder assessment and got
  closed.
- Known limitations to accept for beta, stated openly to users: the board
  canvas / shot list / call-sheet builder are desktop-first (touch editing
  not supported; viewing works), invites and share links are copy-link
  (no email delivery yet), and client review approvals are name-asserted,
  not identity-verified.

---

# Part 2: Competitive landscape (July 2026)

## 2.0 The one-line verdict

Nobody, across roughly 35 products in seven categories, combines what the
Hub already has: CRM/deal pipeline + brief + boards/storyboards/shot lists +
client review portal + call sheets with tracking + budget + comms
connectors + AI-generation organization, in commercial-production language.
The whole-spine position is open. The competitive job is therefore not
"add missing features to reach parity"; it is (a) harden what exists,
(b) close a small number of genuine gaps that adjacent categories have
trained customers to expect, and (c) ship the AI pipeline while that
category is still unoccupied.

## 2.1 Category map, and what each means for us

### Production-management incumbents (StudioBinder, Yamdu, Assemble, Celtx, SetHero)

- **StudioBinder** ($42 to $340/mo tiers): still the UX reference for
  call sheets and phase-organized workspaces, but its 2025 pricing
  restructure is actively burning goodwill: call-sheet RSVP/view tracking
  got paywalled into higher tiers, support complaints dominate reviews
  (G2 3.7, Capterra support score 2.5/5), no undo/redo, no budgeting, no
  CRM, no real client review, and no shipped in-product AI (marketing
  only). A Tracxn "M&A offer" event in April 2025 suggests ownership flux.
  This is a displacement window: their unhappy users are exactly our ICP.
- **Yamdu** (Flex $45/mo; Core $265/mo up to 20 users): strongest
  data-model discipline in the category (change a scene, every document
  updates), shipped real AI (script-breakdown beta, Oct 2025), has a
  commercial-production landing page and an AV-script tool. Weaknesses:
  desktop-browser-only (their loudest complaint), film/TV logistics DNA,
  no CRM, no native budget (exports to Showbiz), no annotated client
  review. Two pricing patterns worth copying: unlimited free external
  contacts (crew/clients who only receive documents never consume seats)
  and flat team tiers.
- **Assemble** (onassemble.com, $20 to $30/seat/mo): the nearest incumbent
  in DNA. Founded by an ex-branded-content EP, it combines a production
  calendar (its hero feature), frame-accurate review with versioning,
  call sheets with confirm tracking, and unlimited free client guests.
  Actively developed but small (~$2.7M revenue, ~1,000 customers, thin
  review base). Still no CRM/pipeline, no bid-vs-actual budget, no
  connectors, no AI. Assemble is the product to watch and the sharpest
  test of our differentiation: what separates us is the CRM front, the
  budget, the comms connectors, and the AI layers.
- **Celtx** ($15 to $60/mo, Backlight-owned): script-first pre-production;
  gates production planning to its top tier; users complain about cost,
  navigation, and a fragmented multi-app redesign. Stops where the
  asset/feedback lifecycle begins. Not our fight.
- **SetHero** (from $19/mo, per-project options): the dedicated call-sheet
  tool (email AND SMS delivery, view/confirm tracking, weather, overtime
  checks), loved (G2 4.8) but single-module. It validates our call-sheet
  pattern and sets the delivery bar: SMS is the one channel we lack.

### AI-native pre-production newcomers (FinalBit, Storyflow, Boords, Filmustage, Studiovity, CallSheetX)

A wave of $8 to $25/mo AI tools is commoditizing the middle of the spine
(boards, shot lists, call sheets), mostly film/indie-skewed, none with CRM,
client portals, or budgets. The two that matter: **Boords** (storyboard
sign-off for video agencies and brand teams, now with an AI "preproduction
agent") owns the brief-to-approved-storyboard loop for our exact customer;
**FinalBit** (ex-NolanAI) is the broadest AI suite and SEO-aggressive.
Implication: the generic call-sheet/shot-list layer is our least defensible
module. The defensible part is that ours is wired into a client, a deal, a
budget, and a review loop. Never sell those modules standalone; sell the
spine.

### Creative review and approval (Frame.io V4, Ziflow, Filestage, Krock.io, ReviewStudio)

- **Frame.io V4** ($15 to $25/user/mo): expanded from review into
  metadata-driven "creative workflow management" (custom fields,
  Collections, Camera to Cloud, and Oct/Nov 2025 natural-language +
  semantic media search). Still asset-centric: no CRM, no call sheets, no
  budgets, no pre-production. Its forced V3-to-V4 migration (Oct 2025)
  broke integrations and generated real resentment.
- **Ziflow / Filestage** (flat $199 to $399/mo, marketing-team oriented):
  both shipped AI compliance-checking review agents in 2025. Their
  routing/automation depth (multi-stage approval workflows, auto
  reminders, version compare) is the category bar our portal will be
  measured against.
- **Krock.io** (~$10 to $15/user/mo): the only review tool that also does
  storyboards/animatics (plus AI storyboard generation). Small, cheap,
  animation-focused; watch it.
- Feature bar we should meet over time: side-by-side version compare,
  due dates + auto reminders on pending reviews, and a per-project (not
  just per-asset) review overview for the client.

### Agency OS / close-the-deal tools (HoneyBook, Bonsai, Moxie)

They own proposals, contracts, e-sign, deposits, payments; none touch
review, versioning, call sheets, or production language. HoneyBook's
Feb 2025 price hike (+89% on Starter, to $36/mo plus transaction fees) and
payment-hold complaints created churn energy among creatives; Bonsai was
acquired by Zoom (Dec 2025), adding roadmap uncertainty. The research on
what boutique COMMERCIAL studios actually need concluded that in-app card
payments are close to irrelevant for our ICP (agency work runs AICP bid,
agency PO, net-30 ACH; this validates the Melio-over-FreshBooks lean and
the decision to pause billing), but a lightweight proposal/estimate doc
with a tracked share link covers most of the deal-closing job. For agency
bids specifically, the winning move is AICP-format awareness (attach a
Hot Budget/Showbiz bid to a Deal, track versions and award), which is
orchestrate-don't-replace, exactly our thesis.

### Generic PM used by studios (Monday, ClickUp, Notion, Airtable)

All four pivoted hard to paid AI-agent tiers in 2025/26 (Monday "AI Work
Platform", ClickUp Brain2 at up to $28/user/mo extra, Notion 3.0 Agents,
Airtable Omni). Verticalization is template-deep only: none models the
production spine, only ClickUp has native proofing, none has first-class
asset versioning, and per-seat economics punish production reality
(freelancers, day-players, clients). Monday even has an official proofing
partner ecosystem because it lacks the capability. These are the tools our
prospects are duct-taping today; the pitch against them writes itself.

### The real competitor: the DIY stack

The most common alternative is not any single product; it is Notion (or
Monday/ClickUp/Airtable) for PM + Frame.io for review + Drive/Dropbox for
files + email/Slack for comms, glued together by hand. The evidence that
this hurts is concrete: 2026 how-to guides exist solely to wire Notion and
Frame.io together with Make.com webhook chains (naming the "Admin Gap":
manually creating folders, copying links between tools, refreshing email
for client feedback), and there is a paid template economy (Notion
Marketplace, Etsy, Gumroad; a $44 bundle selling "automated call sheets
and shot lists" inside Notion) proving operators pay one-time money just
to make generic tools speak production language. That is the Hub's core
bet, validated by what people already spend. Two supporting Frame.io
details: Adobe routes real project management to Workfront (enterprise
marketing-ops pricing, irrelevant to a boutique), and V4 dropped the
DaVinci Resolve integration, actively generating switcher intent among
Resolve-based boutiques. Frame.io also shipped C2PA Content Credentials
(file-level AI provenance), worth tracking as adjacent to our
provenance-as-production-record thesis, which remains deeper than
file-level marks.

### AI video workflow organizers (LTX Studio, Flora, Freepik Spaces, Krea, Figma Weave, Promise MUSE)

The most strategically important finding: **no shipped product treats
per-generation provenance (model, seed, prompt, lineage across takes) as a
first-class production record, and none has a client review/sign-off loop
over AI generations.** The category split into generation suites adding
light structure (LTX Studio, whose Trustpilot is rough), node-canvas
orchestrators consolidating fast (Weavy acquired by Figma, Flora's $42M
Series A, Freepik Spaces, Krea Nodes), and internal studio pipelines not
for sale (Promise MUSE). Nobody serves boutique commercial studios running
hybrid live+AI jobs. Our Phase 7 slices (provenance capture, per-shot
takes, ai_shot review) sit precisely in this empty space. Nearest future
threats: Promise MUSE going SaaS, LTX Canvas deepening, Figma Weave adding
review.

### Production finance (Saturation.io, Wrapbook)

**Saturation.io** owns commercial-production budgeting/finance (AICP
templates, 8,000+ producers, now expense cards and banking) far deeper
than we should chase. The finance side is consolidating upward into
workflow: **Wrapbook** bought the Cinapse scheduling platform (Dec 2025),
GreenSlate bought Circus (Sept 2025), and Entertainment Partners bought
CASHet (2025). None of them touch the creative/client-review/asset side.
Notably, Wrapbook's per-transaction fee escalation is documented (in G2
reviews) as pricing out small producers, the exact boutique segment we
serve. Our budget module should stay "good enough for bid vs actual on a
boutique job" and interoperate (CSV/AICP awareness) rather than compete
with any of these.

## 2.2 Where the Hub wins today (protect these)

1. The full spine in one product, in commercial language (deal to
   delivery). Nobody else has it.
2. Comms connectors (Gmail/Slack/Chat/Drive/Calendar/Figma) with real
   thread-to-project linking and CRM auto-logging. Every incumbent is a
   closed island.
3. Client review portal wired INTO the spine (pins, timecodes, internal +
   client layers, doc review, notifications) rather than a separate
   review SaaS.
4. Call sheets with per-recipient view/confirm tracking on every plan,
   while StudioBinder paywalls exactly that.
5. Native bid-vs-actual budget (StudioBinder and Yamdu both lack one).
6. The AI pipeline organizer with provenance (unoccupied category).
7. Dual theme, token-first, stable review environment; free external
   recipients by architecture (share links never consume seats).

## 2.3 Where we are behind (honest list)

- **Deal-closing documents.** No proposal/estimate object, no e-sign-like
  accept, while HoneyBook/Bonsai own that muscle memory. (Payments are
  correctly out of scope for our ICP.)
- **Review workflow depth.** No side-by-side version compare, no due
  dates/auto reminders on pending reviews, no per-project client review
  hub page. Ziflow/Filestage/Frame.io set this bar.
- **Email delivery.** Invites, call sheets, and review links are
  copy-link-only. Every competitor that sends anything sends email with
  tracking. This is also the biggest amplifier for features we already
  have (call-sheet confirms, review requests, stalled-approval nudges).
- **Tasks.** CRM tasks exist; per-project production tasks do not.
  StudioBinder, Monday, ClickUp and every PM tool train users to expect a
  simple per-project checklist (assignee, due date, My Day rollup).
- **Mobile/on-set.** Yamdu's loudest complaint is ours too: the builder
  surfaces are desktop-first. The consumption surfaces (call sheet link,
  review link, dashboard) should be verified excellent on a phone before
  beta; that covers the on-set reality without rebuilding canvases.
- **Undo/redo on canvases.** StudioBinder's absence of undo is a top-three
  complaint. Our boards/shot-list editors have the same gap.
- **Media search.** Frame.io's 2025 natural-language/semantic search is
  where asset-heavy tools are heading. Not urgent at boutique asset
  volumes; on the horizon list.

## 2.4 Pricing landscape and implication

Reference points: StudioBinder $42 to $340/mo (resented), Yamdu $45 to
$265/mo, Frame.io $15 to $25/user, Boords ~$25/mo, HoneyBook $36 to
$129/mo plus transaction fees, AI newcomers $8 to $25/mo, flat-rate
proofing $199+/mo. Patterns that earn goodwill: flat honest tiers, free
unlimited external recipients (clients, crew, reviewers), no paywalling of
the operator-critical loop (send + track call sheets, review, budget).
Patterns that burn goodwill (documented churn): HoneyBook's +89% hike,
StudioBinder gating RSVP tracking, per-seat charges for day-players. Our
architecture already gives externals away free via share links; make that
a stated pricing principle. A plausible opening shape: a single flat studio
tier in the $40 to $80/mo band (undercutting StudioBinder's ladder while
covering far more), seats for studio members only, collaborators and all
share-link recipients free, AI features included rather than metered (every
generic PM tool now nickel-and-dimes AI credits; including it is a
differentiator).

## 2.5 Key sources

Competitor sites frequently block automated fetches, so pricing was often
triangulated from G2/Capterra/GetApp and dated third-party reviews;
re-verify any number before using it in customer-facing material.
Primary references: studiobinder.com (+ Trustpilot Oct 2025 pricing
backlash review), yamdu.com/en/for-productions/commercial, onassemble.com,
sethero.com/industry/commercials, celtx.com, frame.io V4 release blog
(blog.frame.io), ziflow.com/reviewai, filestage.io/ai-reviewer, krock.io,
honeybook.com pricing coverage (taskip.net, assembly.com), Zoom-Bonsai
acquisition (zoom.com blog, Dec 2025), monday.com/use-cases/media-production,
clickup.com proofing help docs, airtable.com/solutions/media-entertainment,
notion.com 3.0 release notes, ltx.io/studio/pricing, florafauna.ai +
TechCrunch Flora Series A (Jan 2026), Figma-Weavy acquisition coverage,
promise.ai + Deadline/Variety coverage, saturation.io, Wrapbook-Cinapse
acquisition (Variety, Dec 2025), boords.com, finalbitai.com, storyflow.so,
filmustage.com, AICP payment guidelines (aicp.com), Hot Budget/Showbiz
commercial-bidding coverage (cmsproductions.com).

---

# Part 3: Prioritized actions

## Tier 0: before inviting beta users (1 to 2 focused days)

The top-10 hardening list in Part 1.1, plus the feedback channel and the
leaked-password toggle. Nothing else should jump this queue; every
competitive insight below is worthless if the first beta user hits a raw
crash screen or locks themselves out.

## Tier 1: during beta (highest leverage per effort, roughly in order)

1. **Transactional email (Resend or similar), one foundation, three
   payoffs:** send call sheets by email (with the existing view/confirm
   tracking), send review-request and invite emails, and nudge stalled
   approvals. Directly weaponizes StudioBinder's most-resented paywall.
2. **Per-project tasks** (title, assignee, due date, done), surfaced in
   My Day and the project hub. Reuse the crm_tasks pattern. Closes the
   most-expected missing table-stakes feature.
3. **Review round polish:** due date on a review link + auto reminder
   (needs #1), and a simple side-by-side version compare in the review
   canvas. Meets the proofing-category bar.
4. **Proposal/estimate doc + tracked accept link.** Reuse the native
   invoice-generator document model and the call-sheet share-link pattern:
   a branded estimate the client opens, views (tracked), and accepts with
   a typed-name confirmation. Attach externally-made AICP bids (Hot
   Budget PDF/XLSX) to a Deal with version history. This closes the
   HoneyBook gap without building payments and fits the billing pause.
5. **Mobile verification pass on consumption surfaces** (call sheet public
   page, review portal, dashboard, project hub): fix what a producer on a
   phone actually touches; leave builder canvases desktop-first.

## Tier 2: after beta feedback (bets, pick by observed friction)

- **Ship Phase 7 (AI pipeline) to full usability and market it loudly.**
  The category scan says provenance-tracked, review-connected AI
  production organization does not exist anywhere; first-mover naming
  rights are available and the architecture is already built. This is the
  headline differentiator, not a side module.
- **Undo/redo on boards and shot list** (command pattern over existing
  actions).
- **Weekly studio digest + AI feedback summarizer** (the two cheapest
  high-trust AI adds per the earlier assessment; both build on existing
  lib/outstanding.ts and review comments).
- **CSV/PDF exports** for budget and contacts (producers hand these to
  accountants constantly).
- **Multi-studio switcher + per-user notification read-state** before any
  multi-seat sales push.

## Deliberately not building (say no out loud)

- In-app card payments and full e-sign audit trails (wrong rails for
  agency/brand AP; DocuSign-grade stays in DocuSign).
- Film-native modules: script breakdown, stripboards, DOOD (Yamdu and
  FinalBit's fight, not ours).
- Deep finance (Saturation's territory), payroll (Wrapbook's), MAM-scale
  media search (Shade's), and generation itself (LTX/Runway/Veo's).
  Orchestrate, do not replace.

## Positioning sentence to test with beta users

"The tools you compare us to organize one slice: StudioBinder your shoot,
Frame.io your review, HoneyBook your invoices, Monday your tasks. The Hub
runs the whole job, from the first agency email to the approved final, in
one place that speaks commercial production, and it is the only tool built
for jobs where AI shots and live shots live on the same board."
