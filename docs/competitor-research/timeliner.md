# Timeliner (timeliner.io): product and site notes (2026-10-09)

HOW THIS WAS GATHERED, so the limits are clear: timeliner.io, Product Hunt,
G2 and the web archive are all egress-blocked from Claude Code sessions, so
none of their pages could be opened directly. Everything below comes from
search results that quote their own pages (home, /features, /pricing,
/integrations, /vs, /alternatives, /blog, /roadmap) and from launch
directories. That covers what they say and how the site is organised. It does
NOT cover how it LOOKS: colour, type, motion and layout have not been seen. A
screen recording of a scroll through it, like the monday.com one, would close
that gap.

## What it is
"The Video Agency OS": project management, video review, client approvals,
file storage and payment tracking for video AGENCIES, in-house content teams
and freelance editors. Its pitch is that it replaces "ClickUp + Frame.io +
Google Sheets". Timeliner Inc., founded 2025, launched on Product Hunt
2026-04-08 (96 upvotes). It claims 370+ teams in 15+ countries and 5,000+
projects, though other pages on the same site say 270+.

WHERE IT OVERLAPS US, AND WHERE IT DOES NOT. Its world is POST-PRODUCTION and
CONTENT: editors, cuts, revision rounds, social posting. It has no
pre-production or shoot side at all (no call sheets, schedule, shot list,
storyboards, crew roster, budget against a bid, agreements or previz). The
overlap is review, the client portal, approvals and money tracking, and on
that overlap it is a serious competitor. It is also a working example of the
argument we make: one vertical-shaped hub instead of a stack of generic tools.

## Pricing (their own pages, which contradict each other)
- Studio $89/mo (5 seats), Agency $199/mo ("most popular", adds social
  posting), Scale $499/mo (20 seats, up to 40, 20TB), Enterprise custom (SSO,
  a success manager, an uptime SLA). One table on their site says Studio is
  $139.
- Extra seat $10/mo, which also adds 250GB. FREE, UNLIMITED CLIENT SEATS.
  14-day trial on every plan. Older listings say "from $19" and "from $29".
- Against ours (Free / Solo $19 / Studio $59 / Production $119): we are
  cheaper at every step and we have a free plan, which they do not.

## Features, and what each means for us
Rated for fit with a commercial production studio rather than with an
editing agency.

### Worth having (strongest first)
1. CLIENT APPROVAL BY WHATSAPP OR TEXT, ONE TAP, NO LOGIN. The approval
   request arrives as a message with a thumbnail and a review link, and one
   tap approves; the team is told in Slack. This is their lead selling point.
   We send a /r/<token> link by EMAIL only. Text messaging is already this
   file's recorded "likeliest gap" (the meal round), and an agency producer
   answers a text faster than an email. The cost is real (Twilio, a number,
   per-message cost, opt-out handling) and WhatsApp needs Meta's business API
   on top, so SMS first.
2. COMMENTS OUT AS TIMELINE MARKERS. Review notes export as marker files for
   Premiere, Resolve and Final Cut, so the editor sees each note at its frame
   in the timeline. We already store timecodes, in-points and out-points on
   every comment, so this is mostly writing a file format. Cheap, and it fits
   "orchestrate, do not replace" exactly. Good companion to the editor handoff.
3. DOWNLOAD LOCKED UNTIL APPROVAL. The client can watch but cannot download
   the master until it is approved. For a studio the stronger form is
   "locked until the invoice is paid", which protects against a client taking
   the work and going quiet. Small: a flag on the review link plus the
   existing token-guarded file proxy.
4. VOICE MEMO COMMENTS in review, beside text and drawings. A director
   talking for ten seconds beats typing a paragraph. The browser recording
   this needs was already measured for the location scout idea (audio-only
   opus is about 2MB per ten minutes).
5. STUDIO REPORTS: approval turnaround, revision rounds per client or per
   project, time to first cut, profitability per project. We already hold the
   data (review comments, approvals, versions, margin per job) and show none
   of it studio-wide. "Which client costs us the most revision rounds" is a
   question a producer genuinely asks before quoting the next job.
6. BRIEF INTAKE FORM. A client fills a form and uploads files, and it becomes
   a task with the brief attached. For us that is a public "start a job" form
   that creates a deal (or a project) with the brief filled in. Useful for a
   studio taking repeat work from the same brands.
7. VIDEO VERSION COMPARE. They have it; ours is images only (already noted as
   open). A cut-to-cut comparison is what a client asks for on round three.

### Have already, or deliberately out of scope
- Internal review before the client sees anything: have it (doc reviews and
  asset review both run internal first).
- Frame-accurate comments, drawings, a branded no-login portal: have them,
  and ours goes further (ranges, threads, reactions, crop guides, PDF pins).
- Payment tracking: ours is deeper (cost ledger, schedules, BILL payments).
- Workload planning (per-editor capacity, time off, over-capacity warnings)
  and time tracking with hourly rates: built for a salaried edit bay, not a
  freelance crew booked per day. Revisit only if a studio with in-house
  editors asks.
- No-code automations ("when this, then that", deadlines set backward from a
  publish date): nobody has asked; our schedule cascade covers the deadline
  half where it matters.
- Built-in chat with team-only and client channels: against our
  connect-don't-replace rule. We link the Gmail and Slack people already use.
- Social posting to Instagram, YouTube and the rest: outside our vertical.

### Integrations
Slack now, a REST API, Discord and a Premiere Pro panel "coming soon". No
Google Drive or Dropbox anywhere. We already connect more (Gmail, Slack,
Google Chat, Drive, Calendar, Figma, BILL), and have no page that says so.

## Their website: pages and what each does for a visitor
- HOME: positioned against the stack it replaces, stats row (teams,
  countries, projects), a quoted customer, pricing headline.
- /features, plus deeper pages such as /features/workflows.
- KEYWORD LANDING PAGES such as /video-editing-workflow-software (our
  [slug] pages do the same job and we have more of them).
- /pricing with seat add-ons and "free unlimited client seats" spelled out.
- /integrations: what connects now and what is coming.
- COMPARISON PAGES (/vs/timeliner-vs-frame-io): a side-by-side table with
  prices, a section on WHERE THE COMPETITOR STILL WINS, and a "last reviewed"
  date. That honesty is what makes it credible, and it ranks for "Frame.io
  alternative" searches.
- ALTERNATIVES PAGES (/alternatives/kreatli, /alternatives/krock-io): one
  page per rival, aimed at people searching "<rival> alternative".
- /blog ("Frame.io Alternative: Why Video Teams Are Switching in 2026").
- /help-center, API docs, a /learning section (with a language prefix,
  /learning/en).
- /roadmap with public feature requests.
- Partner program, plus partner terms in the footer.
- Cookie policy page.

## What we have against that, and what is missing
HAVE: home, 16 keyword feature pages with their own share cards, /features
index, /pricing with a full comparison table and ten FAQs, /contact, terms
and privacy, structured data, a sitemap.

MISSING, in the order I would build them:
1. COMPARISON PAGES. "StudioBinder alternative", "Frame.io alternative",
   "Saturation alternative", "Monday for production". These are the searches
   of somebody already shopping. Copy their honest shape: a table, a "where
   they are stronger" section, and a reviewed-on date. Never invent a
   competitor's price; cite and date it.
2. AN INTEGRATIONS PAGE. We connect more than they do and say it nowhere.
   It is also the page that states the connect-don't-replace principle.
3. HELP CENTRE / GETTING STARTED. Somebody evaluating needs to see that
   they will not be stranded. A dozen short articles beats an empty promise.
4. CHANGELOG (or a public roadmap). For a young product it is the proof
   that it is alive and moving, and we ship something most days.
5. "FREE UNLIMITED CLIENT REVIEWERS" STATED ON PRICING. It is already true of
   ours (a review link needs no account) and we do not say so. Pure copy.
6. A SECURITY PAGE: still parked on two-factor sign-in, per
   docs/launch/security-and-compliance.md. Timeliner shows no SOC 2 either,
   so we are not behind here.
7. A blog and a referral or partner programme: later, once there is
   something to say and somebody to say it to.

WHAT NOT TO COPY: their stats disagree with each other (270 vs 370 teams),
and the pricing appears in three versions across their own pages. A visitor
who notices either stops trusting the rest. Our rule stays: one source for
every number, and no customer counts until there are customers.
