# Marketing site design brief: Monday.com as the hard reference

Written 2026-07-31 for the studio-flows.com marketing site build. Audience: the
operator and the Claude Code session (Opus 5) that will implement it. This is
the complete reference: Part 1 is the Monday.com teardown, Part 2 extracts the
transferable principles, Part 3 translates them into the Studio Flows brand,
Part 4 is the section-by-section homepage blueprint with draft copy, Part 5 is
the implementation plan (architecture, steps, assets, SEO), Part 6 is what NOT
to copy.

Research note: this environment's network policy blocks direct fetches of
monday.com (and its mirrors), so the teardown is built from verified web
research plus detailed model knowledge of the site and Monday's public Vibe
design system, current through early 2026. Every structural claim below is the
stable pattern Monday has run for years; exact headline copy rotates with
their campaigns (2025-26 messaging is AI-work-platform positioning), so treat
quoted copy as representative of the pattern, not a live transcription. Before
locking final copy, the operator should skim monday.com once on a normal
browser to confirm nothing structural changed.

---

## Part 1: Monday.com teardown

### 1.1 What the site is doing strategically

Monday does not sell features. It sells a CATEGORY (a "work platform", now an
"AI work platform") and lets the product's own colorful UI do the emotional
work. Three moves define the whole site:

1. The product is the hero image. Nearly every section shows the real UI with
   idealized demo data, lightly animated. No abstract illustration carries a
   section; illustration only decorates around real screenshots.
2. One CTA, repeated relentlessly. "Get Started" appears in the nav, the hero,
   after every major section, and in the footer, always the same wording,
   always with friction-killing microcopy underneath ("No credit card needed.
   Unlimited time on free plan.").
3. Color is systematic, not decorative. The base is white + dark navy text.
   Each product in the suite owns a hue (work management crimson, CRM green,
   dev a teal/blue, service purple) applied to its icon, chips, and CTAs, so
   color = wayfinding. The rainbow lives only in the logo.

### 1.2 Page structure, top to bottom (homepage)

1. NAV (sticky, white, thin, ~64px): lowercase wordmark with the rainbow mark,
   then Products / Solutions (mega menus), Resources, Enterprise, Pricing.
   Right side: Log in (quiet text link) + "Get Started" (filled pill button
   with arrow). Mega menus are card grids: each product/solution gets an icon
   tile in its hue + one-line description. On scroll the nav stays, gains a
   hairline shadow.
2. HERO (white, centered, lots of air): eyebrow or none, then a 2-line
   headline in Poppins semi-bold at ~56-64px with tight leading. One-sentence
   subhead in a lighter weight. Single CTA button + the no-credit-card
   microcopy. Historically an interactive element sits here: a "What would you
   like to manage?" grid of checkbox chips (Projects, Marketing, CRM, Design,
   Software, HR...) that personalizes onboarding; picking chips and hitting
   Get Started carries the selection into signup.
3. HERO VISUAL: a large product screenshot (board view with colored status
   pills), elevated on a soft shadow, often subtly animated: statuses flip,
   a cursor drags a row, avatars pop in. Floating UI fragments (a chart card,
   a notification, an integration logo) orbit the main shot.
4. LOGO BAR: "Trusted by 225,000+ customers worldwide" over a single quiet row
   of recognizable logos (Coca-Cola, Canva, Universal, Lionsgate, Glossier,
   BD, Holt Cat, Carrefour). Desaturated so they read as texture, not noise.
5. PRODUCT SUITE CARDS: a grid of white cards, one per product, each carrying
   its own hue on the icon and CTA ("monday work management", "monday CRM",
   "monday dev", "monday service"). This is the clearest expression of the
   color-as-wayfinding system.
6. ALTERNATING FEATURE SECTIONS (the body of the page): each section is one
   idea, benefit-led header, 2-3 lines of copy, one product screenshot or
   micro-demo. Sections alternate alignment (text left / visual right, then
   flipped) and alternate background (white, then a very light tinted band).
   Typical run: boards and views, automations ("Save time, we'll do the busy
   work"), dashboards and reporting, integrations (a grid of 200+ tool logos),
   AI capabilities (the 2025-26 addition: agents, AI blocks).
7. STATS BAND: 3-4 big count-up numbers on a dark navy or tinted band
   ("225,000+ customers", "186% ROI", "200+ workflows", review scores).
8. TESTIMONIAL / CUSTOMER STORY: one big quote at a time, customer photo or
   logo, name + title, and crucially a METRIC in the quote ("Pepsi cut
   low-impact work by 30%"). Carousel, not a wall.
9. REVIEW BADGES: G2 / Capterra / TrustRadius ratings and leader badges in a
   quiet row. Borrowed credibility for anyone still unsure.
10. TEMPLATE GALLERY TEASE: "200+ templates" with a few colorful template
    cards linking into the template library (their SEO long-tail engine).
11. FINAL CTA BAND: dark navy or gradient band, one line restating the promise,
    the same Get Started button + microcopy. No new information, just the exit
    ramp.
12. MEGA FOOTER: 5-6 columns (Products, Features, Solutions, Resources,
    Company), app-store badges, social icons, language switcher, security
    badges (SOC 2, ISO 27001, GDPR), legal row.

### 1.3 Visual system (Vibe design system + brand site)

- TYPE: Poppins for marketing headlines (semi-bold, large, tight), Figtree for
  product UI and body-ish text. Headlines are sentence case, often lowercase
  brand-style. Body is ~16-18px, muted navy.
- COLOR: white background dominant; text a near-black navy (#181B34 family);
  primary action blue-violet (#6161FF family); per-product hues (crimson,
  green, teal, purple, yellow); the multicolor rainbow reserved for the logo
  mark. Tinted section bands are extremely light (2-4% tints).
- SHAPE: pill buttons (full radius), 8-16px card radii, soft layered shadows,
  hairline borders. Screenshots always sit on an elevated card, never flat on
  the background.
- MOTION: scroll-triggered fade/slide-ups per section, hover lift on cards,
  auto-playing micro-demos inside screenshot frames, count-up stats. Motion is
  constant but small; nothing blocks reading.
- DENSITY: one idea per viewport. Generous vertical padding (~120-160px per
  section). The page is long but never crowded.

### 1.4 Beyond the homepage

- PRICING: seat-count selector + monthly/yearly toggle, 5 tiers (Free, Basic,
  Standard highlighted as "Most popular", Pro, Enterprise), per-seat pricing,
  expandable full comparison table, FAQ accordions, the same CTA microcopy.
- SOLUTIONS PAGES: per-persona landing pages (marketing teams, PMO, ops, dev)
  that re-run the homepage formula with persona-specific screenshots and copy.
  This is how one product serves many searches.
- TEMPLATES: hundreds of indexable template pages, each a mini landing page.
  This is a huge organic acquisition channel for them.
- CUSTOMER STORIES: case studies with a metric in every title.

---

## Part 2: The transferable principles (what actually makes it work)

P1. REAL PRODUCT AS HERO. Screenshots with beautiful, believable demo data
    beat illustration. The product UI is the proof of the usability claim.
P2. ONE CTA, ZERO FRICTION MICROCOPY. Same button text everywhere, always with
    the objection-killer line under it.
P3. NEUTRAL BASE + SYSTEMATIC COLOR. White/near-black canvas; hues carry
    meaning (product, module, or phase identity), never wash a whole section.
P4. SOCIAL PROOF AS A LADDER. Logos -> numbers -> a story with a metric ->
    third-party badges. Each rung catches a different level of skepticism.
P5. PERSONA ROUTING. Let the visitor self-select ("what do you manage?") and
    route them to a page that mirrors their vocabulary.
P6. SECTION RHYTHM. One idea per section, alternating alignment and
    alternating white/tinted bands, big vertical air. The scroll itself feels
    organized, which quietly argues "this company will organize you".
P7. METRIC-LED TESTIMONIALS. A quote without a number is decoration.
P8. LONG-TAIL SURFACE AREA. Templates/solutions pages compound SEO. (Later
    phase for us, but design the URL structure for it now.)
P9. MOTION AS POLISH, NOT SPECTACLE. Small, constant, scroll-triggered.
P10. THE EXIT RAMP. Every page ends with the same final CTA band.

---

## Part 3: Translating to Studio Flows (adopt the system, not the volume)

Monday is loud, horizontal, and rainbow because it sells to everyone. Studio
Flows is refined, vertical, and quiet because it sells to boutique commercial
production studios. So we take Monday's STRUCTURE and DISCIPLINE and render it
in the Studio Flows visual language that already exists in the product:

- BASE: keep the product's token system verbatim. The marketing site uses the
  same OKLCH tokens (app/globals.css), light theme values, indigo accent.
  Monday's #6161FF primary maps naturally to our --h-indigo accent. Never
  hardcode colors; the site and product must read as one system.
- TYPE: Plus Jakarta Sans plays the Poppins role (headlines, semi-bold, tight
  leading, big sizes), Hanken Grotesk plays the Figtree role (body, UI). No
  new fonts.
- COLOR AS WAYFINDING: Monday's per-product hues become our per-PHASE hues,
  exactly as the project hub already does it: Plan / Visualize / Review /
  Produce each own a hue via IconTile-style colored chips. The marketing site
  literally reuses the hub's band identity, which makes the site a preview of
  the product.
- STATUS AS SIGNAL: where Monday shows rainbow boards, we show OUR board: the
  refined color-as-signal design (tinted chips with dots, white rows). That
  contrast IS the brand argument: "production tracking that looks like a
  design studio built it, not a database".
- VOICE: production language, never generic software language. "Jobs",
  "boards", "call sheets", "client approvals", "cuts", "shoot days". A busy
  producer should feel the site was written by someone who has run a job.
- SOCIAL PROOF, honestly staged: we have no Coca-Cola logo bar yet. Our
  equivalent rung-one proof is the origin story: built by a working commercial
  studio and run on its real jobs before being offered to peers. Use that as a
  named narrative band ("Built on real jobs, not in a vacuum"). Add a logo bar
  only when real studios/brands can be shown; never fake it.
- PERSONA ROUTING: Monday's "What would you like to manage?" chips become
  "What are you producing?" chips: Live action / Commercial / AI video /
  CGI & VFX (our real project types). Selecting one swaps the hero screenshot
  and can pre-seed signup's first project type later.
- CTA: "Start free" (primary, indigo pill) everywhere, with microcopy "No
  credit card needed. Set up in minutes." Secondary: "See it on a real job"
  linking to a 2-minute product tour section or video. CTA targets
  app.studio-flows.com/signup.
- MOTION: adopt Monday's scroll-triggered fades and micro-demos but calmer:
  150-250ms fades, small rises, one animated screenshot per page maximum
  (the review pin drop is the best candidate: a client clicks a frame, a
  numbered pin lands, a comment appears).
- THEME: the marketing site ships LIGHT ONLY at first (controlled screenshot
  presentation, faster build). Because it uses the same tokens, dark can be
  added later by removing the forced data-theme="light". Note this diverges
  deliberately from the product's dual-theme rule; it is a marketing surface,
  same reasoning as the print/export views.

What Studio Flows has that Monday cannot claim, and the site must lead with:
1. Vertical truth: briefs, boards, shot lists, call sheets, client review, and
   the budget live in ONE place shaped like a production, not a generic board
   you must configure into one.
2. Frame.io-grade review built in: pinned comments on frames, timecode
   comments on cuts, drawn annotations, no-login client links.
3. The AI-video pipeline: organize the generation fan-out (candidates, takes,
   provenance, batch review links). No competitor in the boutique space has
   this; it is the "we are from the future" section.
4. The whole lifecycle: pipeline (deals) -> job -> review -> call sheet ->
   budget -> delivery in one spine.

---

## Part 4: Homepage blueprint (section by section, with draft copy)

Copy below is draft direction for Opus 5 to refine, not final. Standing rule:
no em dashes anywhere. Production vocabulary throughout.

1. NAV (sticky, bg surface, hairline border-bottom on scroll)
   - Left: SF mark + "Studio Flows" wordmark.
   - Center-left links: Product (dropdown: Project hub, Client review, Shot
     lists & storyboards, Call sheets, Budget, AI pipeline), How it works,
     Pricing. Keep it to 3 top-level items; we are not a suite yet.
   - Right: "Log in" (text, -> app.studio-flows.com/login), "Start free"
     (indigo pill, -> app.studio-flows.com/signup).

2. HERO (bg, centered, ~70vh)
   - Eyebrow (small, muted, letterspaced): "For boutique commercial studios"
   - H1 (Plus Jakarta Sans 700, ~56-64px desktop, 2 lines max):
     "Every job, in one place."
     Alternates to test: "Pre-production, without the pileup." /
     "The connected home for every job you shoot."
   - Subhead (~20px, muted): "Studio Flows pulls your briefs, boards, client
     approvals, call sheets, and budgets into one organized home, built around
     how commercial production actually works."
   - Persona chips (optional slice 2): "What are you producing?" Live action /
     Commercial / AI video / CGI & VFX. Selecting swaps the hero shot.
   - CTA row: [Start free] + quiet link "See it on a real job". Microcopy
     under: "No credit card needed. Set up in minutes."
   - HERO VISUAL: large app screenshot on an elevated card (--shadow-lg):
     the project hub of a believable food-commercial job ("Hint - Summer
     Campaign"), with 2-3 floating fragments: a status chip flipping to
     Approved, a review pin with a client comment, a call sheet card. Framed
     in a browser chrome, light theme.

3. LOGO/PROOF BAR (quiet)
   - Until real logos exist: one line of set-the-scene proof instead:
     "Built inside a working studio and run on real client jobs before it was
     offered to anyone else." Style like Monday's logo bar (small, muted,
     centered) so a real logo row can drop in later without redesign.

4. THE PHASE BANDS (our version of Monday's product suite cards)
   - Section header: "Shaped like a production, because it is one."
   - Four cards in the hub's own hues and order: Plan (brief, assets),
     Visualize (storyboards, shot lists, moodboards), Review (client
     approvals, versions), Produce (call sheets, budget, contacts, delivery).
   - Each card: IconTile-style colored icon chip, 1-line description, "See
     how" link. These mirror the actual hub bands, so the site previews the
     product's mental model.

5. FEATURE SECTION A: CLIENT REVIEW (text left, visual right, white bg)
   - H2: "Approvals your clients will actually use."
   - Copy: no-login share links, pinned comments on frames, timecode comments
     on cuts, drawn annotations, versions that never get lost, approve or
     request changes in one click.
   - Visual: the review portal on a hero frame with 2 numbered pins and a
     comment rail. This is the animated one (pin drops, comment appears).

6. FEATURE SECTION B: FROM BOARDS TO SHOOT DAY (visual left, text right,
   tinted band using surface-2)
   - H2: "Shot lists, storyboards, and call sheets that stay in sync."
   - Copy: build the boards, pull them into shot lists, send a call sheet with
     per-recipient confirm tracking. One job, one spine, nothing retyped.
   - Visual: split shot: storyboard grid + a call sheet with Confirmed chips.

7. FEATURE SECTION C: THE MONEY (text left, visual right, white bg)
   - H2: "Know where the job stands, and what it made."
   - Copy: bid vs actual, a cost ledger with invoices attached, payment
     schedules, margin on the job. Quiet flex: "your crew sees the work,
     never the numbers" (the collaborator boundary).
   - Visual: budget page with the margin band.

8. FEATURE SECTION D: AI PIPELINE (dark or deep-tinted band; this is the
   flagship differentiator and earns the one dramatic band on the page)
   - H2: "Made for the AI era of production."
   - Copy: organize the generation fan-out: candidates, takes, references,
     provenance on every clip, triage keyboard-first, send a batch review
     link and let the client pick. We organize; your tools generate.
   - Visual: triage view filmstrip or the sequence strip.

9. STATS BAND (only real numbers; skip entirely until we have 3)
   - Candidates once true: jobs run through it, approvals collected, call
     sheets confirmed. Never invent figures.

10. TESTIMONIAL (one, metric-led, once a beta user says something real)
    - Layout ready from day one; hidden until a real quote exists.

11. FINAL CTA BAND (indigo-tinted, generous padding)
    - H2: "Run your next job in Studio Flows."
    - [Start free] + microcopy. Nothing else.

12. FOOTER (compact, not mega; we are one product)
    - Columns: Product (the module list), Company (About, Contact), Legal
      (Terms, Privacy), plus the wordmark and a "Made by a working studio"
      line. Security/badge row added when certifications exist.

Secondary pages, in build order:
- /pricing: single-product tiers (see Part 5 open questions), comparison
  table, FAQ accordions, same final CTA band.
- /product/review, /product/production, /product/ai-pipeline: three deep
  pages re-running the homepage formula per area (P5 persona routing).
- /about: the origin story (the studio, why it was built). This is our
  strongest trust page at this stage and costs one evening.
- Later (SEO long tail, Monday's P8): /for/food-beverage, /for/agencies,
  /templates/call-sheet etc. Design the URL structure now, build later.

---

## Part 5: Implementation plan for Opus 5

### 5.1 Architecture decision

Recommended: SAME repo, new route group, host-based routing.
- Create app/(marketing)/ with its own root layout: no app shell, no auth,
  forced data-theme="light", same globals.css tokens, same fonts.
- Routes: app/(marketing)/site/page.tsx etc, exposed at the APEX domain via
  host detection: middleware checks the request host; on studio-flows.com
  (no app. prefix) rewrite / -> the marketing pages; app.studio-flows.com
  keeps serving the app exactly as today. Add studio-flows.com as a domain on
  the same Vercel project.
- Why not a separate repo/project: the whole design premise is shared tokens
  and shared components (StatusTag, IconTile, hub-card styling reused as
  marketing props). A second repo forks the design system on day one.
- Middleware notes: marketing paths must join PUBLIC_PATHS (no auth); keep
  the app's auth flow untouched for the app. host. Watch the existing
  redirects (login lives on app.).
- SEO consequence: marketing pages get real static rendering (they are pure
  server components with no auth), so export metadata per page, generate
  sitemap.xml and robots.txt scoped to the marketing host.

### 5.2 Build steps, in order

1. Skeleton: (marketing) route group, marketing layout (nav + footer),
   host-based middleware rewrite, studio-flows.com domain on Vercel,
   deploy a placeholder to verify routing end to end BEFORE designing.
2. Design primitives: MarketingSection (band component with tint/alignment
   props), SectionHeader, CtaButton (one component so CTA text/microcopy stays
   identical everywhere), BrowserFrame (the elevated screenshot card),
   PhaseCard. All token-first.
3. Screenshot pipeline: create a dedicated DEMO STUDIO in the real product
   with one beautifully staged job (believable brand, real-looking frames,
   plausible names, no client-confidential content). Capture at 2x in light
   theme, consistent viewport, save originals under docs/marketing/shots/ and
   optimized webp under public/marketing/. Screenshots are the single biggest
   quality lever on the whole site; budget real time here.
4. Homepage sections 1-4 (nav, hero, proof bar, phase bands). Ship.
5. Feature sections A-D + final CTA + footer. Ship.
6. Scroll motion pass: one IntersectionObserver fade-up utility, the single
   animated review-pin demo, hover lifts. Respect prefers-reduced-motion.
7. /pricing + /about.
8. SEO/analytics pass: per-page metadata, OG image (design one static OG card
   with the wordmark + a screenshot), sitemap, robots, Vercel Analytics
   (already installed) events on CTA clicks.
9. Product deep pages (review / production / AI pipeline).
10. Lighthouse pass: marketing pages should not pay the app's costs; keep
    Sentry server-only on marketing routes if the ~76kB client bundle shows up
    (flagged in the beta checklist).

### 5.3 Asset and copy checklist (operator input needed)

- Demo job content for screenshots (brand name, frames, board images). Frames
  from a real past job are ideal if usable; otherwise stage with generated
  imagery (the Higgsfield tooling can produce believable commercial frames).
- Confirmed pricing tiers and prices (site blocks on this only at step 7).
- The origin story paragraph for /about, in the operator's own words.
- Any real early users willing to be named or quoted (unlocks sections 9-10).
- Domain: confirm studio-flows.com DNS is pointable at Vercel and that
  app.studio-flows.com stays untouched.

### 5.4 Open questions for the operator (do not block on these to start)

- Pricing model: per-seat like Monday, or per-studio flat tiers? Runner is
  meant to sit in a top tier (per CLAUDE.md); the pricing page structure
  should leave room for a "Studio" and a "Studio + Runner/AI" tier.
- Signup flow: straight to free signup, or waitlist-gated during beta? The
  hero CTA wording depends on it ("Start free" vs "Request access").
- Whether the AI pipeline should lead (differentiation) or follow (most
  visitors are conventional studios). Current call in Part 4: it gets the
  dramatic band mid-page, not the hero.

---

## Part 6: What NOT to copy from Monday

- The rainbow. Our color discipline (neutral base, hue as signal) is the
  brand. One accent, phase hues in chips only.
- The mega-nav and product-suite sprawl. We are one product; three nav items.
- Fake-able proof: no invented logos, stats, or testimonials. Empty rungs of
  the proof ladder stay hidden, not faked. Monday earns "225,000+ customers";
  we earn "built on real jobs" and say that instead.
- The seat-slider pricing complexity (until the model demands it).
- Aggressive popups, chat widgets, exit intents. Monday itself is restrained
  here; the knockoffs are not. None of it.
- Marketing-only illustration style. Every visual is the product or supports
  a product shot.

---

## Part 7: Verified against the codebase (2026-07-31, Opus 5)

Part 5.1 was written from design reasoning. Reading middleware.ts,
lib/supabase/middleware.ts, app/layout.tsx, lib/theme.ts and tailwind.config.ts
confirmed the shape but corrected three things. Skeleton now BUILT and pushed.

1. MARKETING MUST SKIP updateSession ENTIRELY, not just join PUBLIC_PATHS. The
   middleware calls `supabase.auth.getUser()` on every matched request BEFORE
   the public-path check, so adding marketing to PUBLIC_PATHS would still pay an
   auth round trip on the most-visited pages of the site and buy nothing.
   middleware.ts now branches on host first and returns a rewrite without
   touching Supabase.
2. THE REWRITE IS AN ALLOWLIST, NOT A CATCH-ALL. The app owns public routes on
   shared paths (/r, /rb, /b, /c, /p, /invite, /project-invite, /auth,
   /api/cron). Rewriting everything on the apex would 404 any of those that
   reached the wrong host, and would silently break Vercel cron if it ever hit
   the apex. lib/marketing/hosts.ts keeps an explicit MARKETING_PATHS set plus
   prefixes; adding a marketing page means adding it there. 22 assertions cover
   the host and path rules (apex, www, port, case, lookalike domain, app
   subdomain, localhost, vercel preview, and every shared app route).
3. "LIGHT ONLY" IS NOT FREE, AND THE FIX IS A WRAPPER NOT A SCRIPT. The root
   layout injects themeInitScript into <head>, which flips
   `<html data-theme>` to the visitor's stored or system theme before paint, so
   a visitor on a dark OS would get dark marketing pages behind light-theme
   screenshots. Every token in globals.css is declared on an ATTRIBUTE selector
   (`[data-theme="light"]`, `[data-accent="indigo"]`), which matches any
   element, so the marketing layout re-declares both on a wrapper div and scopes
   the subtree to light with no script, no flash, and no loss of static
   rendering. Branching on headers() would have made the page dynamic; a second
   script would have flashed. Confirmed static: the build reports `○ /site`.

Also worth knowing for the next session: there is no icon dependency in
package.json, so marketing icons are inline SVG like the rest of the app; and
the marketing first-load JS is ~171 kB, most of it the shared app chunk plus the
Sentry browser SDK. Scoping Sentry to server-only on marketing routes is the
lever if Lighthouse matters, which the beta checklist already flagged.

WHAT IS BUILT: lib/marketing/hosts.ts, host routing in middleware.ts,
app/(marketing)/site/{layout,page}.tsx, and components/marketing/{section,cta,
browser-frame,site-nav,site-footer}.tsx. The homepage runs hero, proof bar,
phase bands, how-it-works, four feature rows, and the final CTA. Screenshots are
BrowserFrame placeholders that name the shot that belongs in each slot, so
dropping in real captures is a one-prop change.

WHAT IS NOT: the Vercel domain attachment (studio-flows.com pointed at this
project, an operator dashboard step), the staged demo-job screenshots, /pricing,
/about, scroll motion, OG image, sitemap and robots.

## Sources

- [Exposure Ninja: Monday.com marketing strategy deep-dive](https://exposureninja.com/podcast/209/)
- [Lilach Bullock: Monday.com marketing strategy](https://www.lilachbullock.com/monday-com-marketing-strategy/)
- [monday.com press release: AI agents, CRM suite, enterprise capabilities](https://monday.com/p/press-release/monday-com-expands-ai-powered-agents-crm-suite-and-enterprise-grade-capabilities/)
- [Till Freitag: monday AI 2026 (Sidekick, Vibe, Agents)](https://till-freitag.com/en/blog/monday-ai-features-en)
- [monday.com brand site: typography](https://www.brand-monday.com/typography)
- [monday.com brand site: colors](https://www.brand-monday.com/colors)
- [Vibe design system](https://vibe.monday.com/)
- [Design Your Way: monday.com logo, colors, font](https://www.designyourway.net/blog/monday-com-logo/)
- [Mobbin: monday.com brand color palette](https://mobbin.com/colors/brand/monday-com)
- [Similarweb: monday.com traffic analytics](https://www.similarweb.com/website/monday.com/)
