# Outward-facing collateral

Two pages, both built on the app's own design tokens rather than on a separate
marketing palette. If `app/globals.css` changes, these change with it.

| File | What it is |
| --- | --- |
| `brand-foundation.html` | The brand sheet: ground, type, colour rules, voice. The reference the other surfaces are held against. |
| `deck.html` | The studio deck. One job, Bright Water hero spot, watched running from the brief landing to the invoice going out. |

## Why they are single-theme

Both commit to the **paper** ground on purpose. The brand sheet is a specimen of
that ground, and the deck's argument (an interface that does not compete with
the work being judged) stops being visible the moment the page can invert. Light
and dark stay in the product, where the user chooses them.

## Building a publishable copy

Both files carry a `/*FONTS*/` placeholder inside their `<style>` block. Plus
Jakarta Sans and Hanken Grotesk have to be **inlined as base64 `@font-face`
rules** before publishing, because an artifact's CSP blocks font CDNs and a
linked webfont fails silently to a system fallback, which is precisely the thing
a type-led page cannot afford.

Fetch the two families (weights 700 and 800 for Jakarta, 400 and 500 for Hanken;
nothing else is used, so no weight is ever synthesised), build one CSS file of
`@font-face` rules with `src: url(data:font/woff2;base64,...)`, then:

```bash
python3 - <<'PY'
src = open('deck.html').read()
fonts = open('fonts.css').read()
open('deck.built.html', 'w').write(src.replace('/*FONTS*/', fonts))
PY
```

The built file is around 200KB, nearly all of it font bytes. Publish that one.

## Deck notes

The first version was thirteen slides of headline plus paragraph, and it read as
generic for a reason worth writing down: **it described a visual product without
showing it.** The only product on it was a gradient rectangle. It also went
feature by feature, which is a list of parts, and a list never adds up to a
picture of a job.

So this version shows the software instead. A single project window is pinned
while seven captions scroll past it, and the window's contents, day counter and
lifecycle stepper change as they do. The motion is the job progressing, not
decoration.

- **One job, not nine features.** Bright Water hero spot, day 1 to day 22. The
  last screen is the payoff: every module filled in at once, which is the only
  slide that actually states the product's argument.
- The panel box is a **fixed height** so the window never resizes as content
  swaps. That means anything overflowing is silently clipped, which is why the
  narrow breakpoint trims specific rows rather than just reflowing.
- A caption goes live when it crosses the **middle of the viewport**, which is
  where the pinned window sits, so the screen and the words can never disagree.
- Stacked label/value pairs are spans, so they carry an explicit
  `display: block`. Without it the label and its value run together on one line
  ("v3Aug 15"), which is easy to miss in review.
- `.wrap` needs `width: 100%`: an auto cross-axis margin cancels flex stretch,
  which shrink-wraps the hero and breaks its left edge away from the window.
- Every screen shows something that is built. If a panel starts depicting
  something only planned, the deck has stopped being useful.
