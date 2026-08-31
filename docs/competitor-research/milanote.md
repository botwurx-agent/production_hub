# Milanote, read off a screen recording (2026-08-31)

## How this was gathered, and its limits

milanote.com is EGRESS-BLOCKED from the build environment, the same way
studiobinder.com is: the proxy answers 403 to CONNECT, so neither curl, nor the
fetch tool, nor the real Chromium browser can open a single page. Verified three
ways rather than assumed, and the two error codes are the proof: an allowed host
returns ERR_CERT_AUTHORITY_INVALID (the tunnel opened, TLS began), Milanote
returns ERR_TUNNEL_CONNECTION_FAILED (no tunnel ever existed).

So this is read off an 89-second 1920x1080 screen recording of the HOME PAGE that
the operator captured, sampled at one frame every two seconds. It covers the home
page only. Their /product/*, /templates/*, /guide/* and /inspiration/* pages are
NOT covered here and are known only by URL and page title from search results.

Nothing below is invented. Where something is inferred rather than seen, it says
so.

## The page, section by section

| t | section | what carries it |
| --- | --- | --- |
| 0s | Hero | headline, then a large ANIMATED moodboard being built |
| 28s | "Take notes & collect research" | animated Research board: text notes, link card, expanding note editor |
| 42s | "Organize projects visually" | animated DARK Project Plan board: to-dos, budget table, file cards |
| 54s | "Collaborate with clients & your team" | animated Brainstorm board: comments arrive, a freehand arrow is drawn |
| 70s | "Made for creative work." | dark band, carousel of DISCIPLINE cards, each with a mini board |
| 74s | "Used by creative professionals at:" | real logos: Nike, IDEO, Netflix, Google, Dropbox, ustwo |
| 74s | "Easy to use on any device" | blue band, desktop + tablet + phone |
| 76s | "Try Milanote today" | the signup form INLINE: Google, Apple, then name and email |
| 78s | footer | Getting started / Templates / Guides / Inspiration / Product, Downloads, Support, Company |

Plus a closing "Get organized. Stay creative." CTA over another animated board.

## The one thing to take

EVERY BODY SECTION IS: a heading, ONE sentence of subhead, and ONE large animated
product demo. That is the whole page. There is not a single bullet list, tick
grid, or three-column feature card in the body.

The demo does the explaining, and each demo shows only its own section's claim:
the notes section highlights text and opens a note as a full document, the
collaboration section has comments arrive and a hand-drawn arrow appear on the
board, the organize section fills a plan with to-dos and a budget table.

OUR PAGES ARE THE INVERSE. A feature page carries three blocks of four bullets,
a six-cell tick grid, and a differentiator band, against ONE STATIC screenshot.
We are explaining in prose what they are demonstrating in motion. On the
moodboard page in particular that is a losing trade, because every claim we make
there is about INTERACTION (drag-only creation, the rail becoming a card's
editor, proportional pinch zoom, four-corner resize) and a still frame cannot
show interaction at all.

## The tension with section 4.6, and how to resolve it

MILANOTE CENTRES EVERYTHING. Heading centred, subhead centred, product visual
centred beneath. Our own rule (CLAUDE.md 4.6) says "NOTHING IMPORTANT IS
CENTER-STACKED. Heroes are two-column spreads."

That rule is not wrong, but it was written about pages whose visual anchor was
weak or missing, where centring left the fold empty. 4.6's actual principle is
the sentence after it: EVERY SECTION HAS A VISUAL ANCHOR. Milanote satisfies
that maximally, with an anchor so large and so alive that centring reads as
confident rather than as a template.

So the resolution is: centring is earned by the strength of the anchor. Keep the
two-column rule wherever the anchor is a still image. A section built around a
large animated demo may centre.

## What else their structure does that ours does not

- THEIR NAV IS BY AUDIENCE AND BY JOB, not by feature. "How people use Milanote"
  opens a mega-menu split into BY PROJECT TYPE (Filmmaking & video, Writing,
  Design, Graphic design, App & web design, Motion design, Photography,
  Marketing, Game development, Architecture & interiors, Interior design, Home
  renovation & DIY, Art, Craft, Fashion design, Music production) and BY
  TECHNIQUE (Moodboarding, Note-taking, Brainstorming, Storyboarding, Creative
  Writing, Creative Briefs). Ours is a list of our own features.
- A DISCIPLINE CAROUSEL ("Made for creative work") sells the same product to
  five audiences on one row. FILMMAKING IS THE FIRST CARD, and it reads "Make
  moodboards, storyboards & plan pre-production". A general tool is claiming our
  exact ground, in first position, on its home page.
- THE SIGNUP FORM IS IN THE PAGE, not behind a button: Google, Apple, then first
  name, last name, email.
- LOGO SOCIAL PROOF. We have none and must not invent any.
- A DEVICE BAND for their mobile and desktop apps. We have neither.

## Features they show that we do not have

Verified against our own code, not assumed.

| theirs | ours |
| --- | --- |
| Comments on a board CARD, in place | none. A board can only be SENT for review, and comments then land as pins in the /r portal |
| Live collaborator avatars on the board | none. There is no realtime infrastructure in the app at all |
| Freehand drawing ON the canvas | none. Drawing exists only in the REVIEW canvases (draw-canvas.tsx), not on a moodboard |
| Board templates | none. We have call sheet templates, no board templates |
| Web clipper browser extension | none. We unfurl a pasted link, which is close but needs the paste |
| Mobile and desktop apps | none. The web app is now responsive, which is not the same claim |

The first three are the ones that would actually change how the moodboard feels.
Presence is the largest by far: CLAUDE.md already records that nothing merges
concurrent edits here, so presence would make a collision VISIBLE rather than
prevent it, and that is a real piece of work rather than a widget.

Templates are the cheapest of the six and probably the highest leverage, because
they are also the SEO play: their /templates/<category>/<specific> pages are a
long-tail library, and a producer searching "commercial shoot moodboard
template" is our buyer at the exact moment of need.

## What we should do, in order

1. DONE. The moodboard page is rebuilt on their section pattern: heading, one
   sentence, one large demo, six times over, with the three-bullet claim panels
   removed rather than kept beside them. `FeatureDemo` in
   lib/marketing/features.ts is the shape, and the feature-page template
   renders the stack in place of the claim panels whenever a page carries one.
   That page is now the reference implementation for the rest.
2. DONE. scripts/capture-demos.mjs (`npm run demos`) records the clips off the
   real demo studio at the same 1503x852 viewport as the screenshots, writes
   WebM plus an MP4 and a poster, and deletes whatever the recording created so
   the studio is unchanged afterwards. Files live in the repo: a clip is around
   180KB, less than any screenshot beside it.
3. NEXT, and waiting on the operator to look at the moodboard page first: the
   same pattern on the other pages whose claims are motion. Client review
   (pins, drawn markup, the scrubber), the AI pipeline (triage, compare) and
   the task board (dragging a card between columns) are the three that gain
   most. Everything else can keep its claim panels; a page whose claims are
   layouts is not helped by a loop.
4. Board templates, as product and as marketing at once, remain the cheapest of
   the six gaps below and the only one that is also an SEO play.

## The gaps, and what each would cost

Ordered by what they would change, not by effort.

| gap | what it would take |
| --- | --- |
| Comments on a board card, in place | Real work. We have the whole review stack, but it is built around SENDING a surface for review; commenting in the working view is a different affordance. |
| Live collaborator presence | The largest by far. There is no realtime infrastructure in the app at all, and nothing merges concurrent edits, so presence would make a collision VISIBLE rather than prevent it. |
| Freehand drawing on the canvas | Small. draw-canvas.tsx already does exactly this in the review surfaces; the work is mounting it on the board and storing the strokes as an item. |
| Board templates | Small, and the highest leverage. Also the SEO play: their /templates/<category>/<specific> pages are a long-tail library, and a producer searching "commercial shoot moodboard template" is our buyer at the exact moment of need. |
| Web clipper extension | A browser extension is its own product, review process and release channel. We unfurl a pasted link, which is most of the value for a fraction of the cost. |
| Mobile and desktop apps | Not planned. The web app is responsive, which is a different and smaller claim, and we should not make theirs. |
