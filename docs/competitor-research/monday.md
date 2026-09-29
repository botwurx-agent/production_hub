# monday.com home page: design and motion (from the operator's recordings, 2026-09-28)

Two screen recordings: a 5s capture of the hero animation and a 45s scroll of
the whole page. Read frame by frame (1fps sheets, 3-4fps on the scroll-driven
moments). monday.com itself is egress-blocked from Claude Code sessions.

## The vibe
Calm, white and confident. Almost the whole page is white or a very pale grey
panel; colour comes only from the product UI and the 3D characters, never from
section backgrounds. Huge tight headlines, very little body copy (one or two
sentences per section), and ONE animated centrepiece per section. It feels
expensive because it is sparse, and alive because something is always moving
exactly where you are looking.

## Design system
- Type: a geometric sans, headlines enormous (roughly 90-110px on "Work in
  context", "Full control", "Consider yourself limitless"), leading near 0.95,
  stacked two or three short lines, left-aligned. Section eyebrows are small
  ("Orchestrate workflows"). Body 15-16px, max two lines.
- Colour: white ground, pale grey (#f5f5f7-ish) rounded panels to stage
  demos, black primary buttons inside sections, brand purple only for the nav
  CTA. Status colours (green/orange/red) live inside the product UI only.
- Layout alternates: two-column (huge headline left, one sentence + black CTA
  right, demo below) and centred (headline + sentence + CTA centred, demo
  below). Section gaps are generous but each section is one composed block.
- Inline avatars INSIDE a headline ("between [5 faces] people and agents
  [3 faces]") as a typographic device.
- Real product UI, simplified and enlarged: boards, workflow nodes, a Claude
  chat panel, all readable at page size. No full screenshots anywhere.
- Social proof section: logo strip under the hero, quote cards with photos,
  a stats row (3, 346%), compliance badges. (We refuse invented versions.)

## Motion, section by section
1. HERO: the animated board (see hero-motion.tsx): a floating chip types what
   an agent did, a status cell shimmers to green, then cuts to a card stack.
   Loops on its own, not scroll-driven.
2. LOGO STRIP: static row.
3. "Get more done with agents": a TAB STRIP (Marketing / IT / Product / ...)
   over a demo panel; the panel content carousels by itself (a row of agent
   cards slides left, then the panel morphs into a board with an assigned
   agent chip). Auto-advancing, tab-driven.
4. "An agent for every use case": a horizontal CAROUSEL of big cards (list of
   categories left, a hero card with a floating "3 emerging trends identified"
   chip, neighbours peeking and faded at the edges), arrows + dots.
5. "Work in context": the SIGNATURE SCROLL MOMENT. A pale line-drawing of a
   character sits among floating UI fragments (Integrations, Docs, Files,
   Dashboards, Data records, Conversations). As you scroll, the fragments
   DRIFT INWARD toward the character (parallax, different speeds) and fade,
   while the character FILLS WITH COLOUR from sketch to full 3D render. Scroll
   scrubbed, not timed: the drawing "absorbs" the context.
6. "Full control": the next section is a pale panel that SLIDES UP OVER the
   character (sticky stacking), headline first, then a 3x2 grid of small icon
   + title + sentence features. The previous section stays pinned underneath.
7. "Consider yourself limitless": a stacked-panel pair. "Bring your own agent"
   (a board with an external agent chip creating tasks) then "Use your
   favorite AI tools" (a dark Claude panel) SLIDES UP over it, same sticky
   stack. Small logo row with an arrow into the monday mark.
8. "Let work flow": centred headline with inline avatars, then a workflow
   diagram that DRAWS ITSELF as you scroll: trigger node, a line grows down, a
   diamond, the next node, then it branches Yes/No and each branch's nodes
   appear in order. Scroll scrubbed, one node per few dozen pixels.
9. "Our customers achieve more": horizontal card carousel with arrows.
10. "Trusted by enterprises": a bordered 3-card grid of badges and stats.
11. Closing band: a GIANT MARQUEE line ("...agents [faces] Built for people")
   that slides horizontally with scroll, over two centred CTAs.
12. Footer: dense link columns.

## Principles worth stealing
- Motion always explains the headline it sits under; nothing moves for
  decoration.
- Scroll-SCRUBBED rather than triggered for the big moments, so the visitor
  controls the pace and can scroll back.
- Sticky STACKING: sections slide up over the pinned previous one, which makes
  a long page feel like a deck of cards rather than a scroll.
- Simplified product UI, big enough to read, instead of full screenshots.
- One idea per section, one sentence of copy.

## For Studio Flows: take / adapt / skip
TAKE: the hero board (built as a prototype), sticky stacking between sections,
scroll-drawn diagrams, simplified readable product UI instead of screenshots,
huge left-aligned headlines with one sentence.
ADAPT: the sketch-to-colour moment becomes a production one (a storyboard
frame going from pencil sketch to the approved final, with shot list, call
sheet and schedule fragments flowing into it: "every job, in one place"). The
self-drawing workflow becomes the job's path: brief -> storyboard -> client
review (branch: changes requested / approved) -> schedule -> call sheet ->
delivery -> invoice. The use-case tabs become project types (Live action /
Commercial / AI video / CGI).
SKIP: 3D mascot characters (we have no brand illustration system, and faking
one would read as borrowed), customer logos, quotes, stats and compliance
badges (no customers yet, no certifications: the invented-social-proof rule
in CLAUDE.md), the giant marquee (a statement page, not an explanation).
