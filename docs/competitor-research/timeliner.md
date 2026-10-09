# Timeliner (timeliner.io): product and site notes (2026-10-09)

Read first-hand: 21 pages loaded in headless Chromium at 1440px and 390px,
screenshotted top to bottom, with each page's full text extracted. (The first
pass that day was search results only, because the domain was blocked; the
operator then allowed it in the environment's network settings.) The embedded
demo videos showed "Player error" in the headless browser, which is the
browser's missing codecs and not their site.

## What it is
"The Video Agency OS". Founded 2025 by an editor who ran a 10-editor agency
(Noam Tryber, plus a CTO). Built for EDITING AND CONTENT AGENCIES: short-form,
YouTube, podcasts, social. The pitch is that it replaces ClickUp + Frame.io +
Google Sheets + Metricool. Review, a kanban pipeline, a client portal,
editor workload, payment tracking, and social publishing with AI captions.

WHERE IT OVERLAPS US, AND WHERE IT DOES NOT. Its world is POST-PRODUCTION and
CONTENT. It has nothing for pre-production or the shoot: no call sheets,
schedule, shot list, storyboards, crew roster, budget against a bid,
agreements or previz. Even invoicing and in-app payments sit on its ROADMAP,
not in the product. The overlap is review, the client portal, approvals and
money tracking, and on that overlap it is polished and moving fast (the
changelog shows a release every few weeks).

## Pricing
Studio $89/mo (5 seats, 3TB, 1080p streaming), Agency $199/mo (10 seats, 8TB,
4K, "most popular"), Scale $499/mo (20 seats, 20TB, white label), Enterprise
custom (SSO, SLA, audit log). Extra seat $10/mo with 250GB. FREE UNLIMITED
CLIENT SEATS on every plan. 14-day trial, no card, "no charge until day 15".
Annual saves 15%. Badged "early access pricing".
Against ours (Free / Solo $19 / Studio $59 / Production $119) we are cheaper
at every step and we have a free plan; they do not.

## Product features, and what each means for us
Rated for fit with a commercial production studio, not an editing agency.

### Worth having (strongest first)
1. CLIENT APPROVAL BY WHATSAPP OR TEXT, ONE TAP, NO LOGIN. The request
   arrives as a message with a thumbnail and a review link; the team hears in
   Slack. It is the most repeated claim in their testimonials ("collaborators
   don't have to log in"). We send review links by EMAIL only. Text messaging
   is already this repo's recorded likeliest gap (the meal round). Costs:
   Twilio, a number, per-message fees, opt-out handling; WhatsApp needs Meta's
   business API on top. SMS first.
2. A CLIENT PORTAL, NOT JUST A REVIEW LINK. One magic link opens a branded
   workspace for that client: every deliverable and its status, what is
   waiting on them, the latest cut, a board view, works on a phone, plus a
   form to REQUEST NEW WORK. Ours is one link per asset or per document, so a
   client with ten things in review holds ten links. A per-client (or
   per-project) home that lists everything shared with them, built on the
   review links we already mint, is the single biggest lesson here.
3. COMMENTS OUT AS TIMELINE MARKERS for Premiere (and Resolve / FCP by file).
   We already store timecodes and ranges on every comment, so this is writing
   a file format. Cheap, and exactly "orchestrate, do not replace".
4. DOWNLOADS LOCKED UNTIL APPROVAL, and their FAQ asks "can I stop a client
   downloading the file until they pay?". For a studio, locked until the
   invoice is paid is the version that matters. A flag on the review link and
   the token-guarded file proxy we already have.
5. AUTOMATIC TRANSCRIPTS, unlimited: comment on a word, search what was said,
   export SRT or VTT. Valuable for interviews, testimonials and VO reads, and
   it gives captions for free. Real cost per minute (a speech-to-text API).
6. VOICE MEMO COMMENTS beside text and drawings, on the portal too.
7. INTERNAL vs PUBLIC PER COMMENT. A toggle in the composer; internal
   revision rounds are hidden from the client entirely, so they see v1 then
   v2 rather than v1 to v7. We separate internal and client review by STAGE;
   a per-comment switch on the same canvas is finer and worth stealing.
8. REVISION CAPS: auto-limit the rounds per project, matching what the
   contract says. Commercial SOWs routinely specify two rounds.
9. A PRICED INTAKE FORM. The client picks from a menu with prices
   ("short-form reel $160 / clip x 3"), adds a deadline, a brief and files,
   and it becomes tasks with a running total. For us: a "start a job" link
   that creates a deal with the brief attached. Useful for repeat brand work.
10. STUDIO REPORTS: approval turnaround, revisions per client, on-time rate,
    per-project profitability with a "why this amount" breakdown, and a
    branded PDF export for the client. We hold all the data and show none of
    it studio-wide.
11. AN MCP SERVER ("connect Claude, ChatGPT or Cursor with one API key") and
    a built-in assistant called Janet. Directly relevant to our parked
    connector decision: a direct competitor already markets it as a headline
    feature, which raises its priority.
12. Small ones: PERMANENT TASK IDs (TL-1042) that survive renames; a
    READ-ONLY CALENDAR FEED of booked work into Google / Apple / Outlook; 11
    interface languages; video version compare (ours is images only).

### Have already, or deliberately out of scope
- Internal review before the client, frame-accurate comments, drawings,
  ranges, no-login review: have them, ours goes further in places (threads,
  reactions, crop guides, PDF pins, docs and boards as review surfaces).
- Payment tracking: ours is deeper (ledger, schedules, BILL payments, margin).
  Theirs is on the roadmap as "Invoicing System" and "In-App Payments".
- Workload planning in hours per editor per day, and time tracking with
  hourly rates: built for a salaried edit bay, not a freelance crew booked by
  the day. Revisit only if a studio with in-house editors asks.
- No-code automations (stage rules, deadlines counted back from a publish
  date): nobody has asked; the schedule cascade covers the deadline half.
- Built-in team and client chat channels: against connect-don't-replace.
- Social publishing, captions and post analytics: outside our vertical.

## Their website: design
- DARK BY DEFAULT with a sun/moon toggle, near-black ground, ONE PURPLE
  accent for buttons, eyebrows and glows. The /for/clients page flips to a
  warm light theme, since it is written for the client rather than the buyer.
- TYPE: a tight geometric sans for headlines, and the payoff words set in a
  thin SERIF ITALIC in the accent colour ("entire *video workflow.*",
  "use and love.", "Do the math."). It is the most recognisable thing on the
  site and costs nothing.
- HERO: centred. A social-proof pill above the headline (team avatars, team
  count, G2 rating, "free 14-day trial"), headline, one sentence, a primary
  button and "Watch demo", then a line under the buttons removing the risk
  ("Cancel anytime, no charge until day 15"). Below it a big, real-looking
  app mock in a browser frame, showing review and the board side by side.
- Rhythm down the home page: logo marquee, a PAIN section ("Still
  copy-pasting between seven tools?") with the tools' icons, a row of cards
  each ending "REPLACES" plus competitor icons, then one long section per
  area (review, project management, publishing) each closed by a slim band
  "Timeliner replaces your review stack" with a trial link.
- INTERACTIVE PIECES: a STACK COST CALCULATOR (slider for team size, a table
  of the tools you would otherwise pay for with their prices, the total
  against theirs), a phone mock of the client portal you can tap through, a
  permissions MATRIX (role by what each can see), a storage spec card (file
  formats, upload and download speed, AES-256), an integrations tile grid.
- Proof: three stat tiles, a video testimonial, a masonry WALL OF LOVE with
  photos, G2 badges and short videos, "show more".
- Pricing and a FAQ sit on the home page too, then a closing CTA.
- Footer: four columns (Solutions / Resources / Company / Legal), an "All
  systems operational" status line, a G2 link, the support address. A purple
  help bubble sits fixed bottom-right on every page.
- An invisible "What is Timeliner?" block at the top of the page, a plain
  summary of the product, features, pricing and audience, readable by search
  engines and AI answer engines but not shown on screen.
- Mobile: the same hero stacked, full-width buttons, the mock switches to
  Review / Board tabs. Clean.

## Their website: pages
- /features, /features/workflows, keyword landing pages.
- /pricing, also repeated on the home page.
- /for/clients: a page WRITTEN FOR THE CLIENT, so the agency can send it to
  a brand ("the easiest way to work with your agency"). Review, the portal,
  discussion, requesting work, live status, "three steps".
- /alternatives: a hub of fifteen rivals grouped by kind (review tools,
  review plus light PM, social, DAM, generic PM, client portals), each with a
  one-line verdict and its real 5-seat monthly cost. "Pricing pulled from
  each tool's public pricing page. Last reviewed July 2026."
- /vs/<rival>: "short answer" up top, "Pick them if... / Pick us if...", a
  real cost table, a plan-by-plan switcher. Honest about where the rival wins.
- /customers: stories and every review "unedited", saying which are on G2.
- /faq: 127 questions in twelve categories, "including the limits and the
  things we do not do yet". The most useful page on the site for a careful
  buyer.
- /whats-new: a changelog written as release notes with the plan tier on
  each feature.
- /roadmap: shipped / up next, plus a feature-request form.
- /learning: a video course, 25+ lessons of one to thirteen minutes.
- /onboarding: a free setup call with a named person, 10 to 60 minutes,
  "bring your leads", on every plan.
- /demo: 30 minutes with the founder, with "book the call if / skip it and
  just start if" so the wrong people self-select out.
- /help-center: support channels BY PLAN (email on Studio, WhatsApp on
  Agency), Discord, courses.
- /community (Discord), /about (founder story), /integrations (live and
  "coming soon" with a request form), /docs/api, /earn (partner programme:
  20% recurring for life, 10% off for the referred customer, plus up to $1,500
  per piece for creator content), privacy, terms, cookies, partner terms.

## What we have against that, and what is missing
HAVE: home, 16 keyword feature pages with their own share cards, a /features
index, /pricing with a comparison table and ten FAQs, /contact, terms and
privacy, structured data, a sitemap, real screenshots and demo clips.

MISSING, in the order I would build them:
1. A CLIENT-FACING PAGE (our /for/clients). The studio's client is the
   person who decides whether the tool feels professional, and nothing on our
   site speaks to them. It is also the page a studio sends a brand.
2. COMPARISON PAGES: an /alternatives hub plus StudioBinder, Frame.io,
   Saturation and Monday. Copy the honest shape (short answer, pick them if,
   a cost table with a reviewed-on date). Cite every rival's price.
3. A STACK COST CALCULATOR. We replace more tools than they do (StudioBinder,
   Frame.io, a PM tool, a budget spreadsheet, a CRM, call-sheet software), so
   the maths favours us more. It can live on pricing.
4. A REAL FAQ, far longer than ten, including what we do not do yet.
5. AN INTEGRATIONS PAGE. We connect more than they do and say so nowhere.
6. CHANGELOG (what's new) and a public roadmap with a request form. We ship
   most days and nothing shows it.
7. HELP: a getting-started guide or short video lessons, plus an onboarding
   call offer. Cheap and it removes the "will I be stranded" doubt.
8. A plain-text "what is Studio Flows" summary for search and AI answer
   engines, same idea as their hidden block (we can render it visibly in the
   footer area instead of hiding it).
9. The serif-italic accent on headline payoff words. A style question for the
   operator, not a build.
10. Later: a demo booking page, a partner programme, a security page (still
    parked on two-factor sign-in).

WHAT NOT TO COPY:
- THE NUMBERS DISAGREE EVERYWHERE. The team count read 359+, 365+, 280+ and
  370+ across loads of the same page, the community page says 270+, and
  "fewer revision rounds" is 18% on the home page and 60% on the customers
  page. A careful buyer notices and stops trusting the rest. Our rule stays:
  one source for every number, and no customer counts until there are
  customers.
- Invented social proof. Theirs looks real (named, G2-linked); ours must stay
  absent until it exists.
- The seven-tool stack framing for social posting and chat, which is their
  vertical, not ours.
