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

1. Rebuild the moodboard page on their section pattern: heading, one sentence,
   one large demo per capability, replacing bullet lists.
2. Build the demo-recording pipeline. Playwright records video natively and
   already drives the demo studio for screenshots, so a script can drag a card
   in, connect two, and select one to show the rail become its editor. Open
   questions: where the files live (a handful of loops outweighs this repo), and
   whether they run on the operator's machine like the screenshots do.
3. Apply the same pattern to the other feature pages, starting with the ones
   whose claims are motion (client review, AI pipeline, task board).
4. Decide on board templates, as product and as marketing at once.
