# Outward-facing collateral

Two pages, both built on the app's own design tokens rather than on a separate
marketing palette. If `app/globals.css` changes, these change with it.

| File | What it is |
| --- | --- |
| `brand-foundation.html` | The brand sheet: ground, type, colour rules, voice. The reference the other surfaces are held against. |
| `deck.html` | The 13-slide pitch deck for prospective studios. Opens on the eleven-places problem, lands on running a real job through it. |

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

- The rail down the left is a real index. A deck is a sequence, so the numbers
  carry order rather than decorating it.
- Arrow keys, page keys, space, Home and End all move between slides; the rail
  numbers are links.
- The active slide is derived from **scroll position**, not from the
  IntersectionObserver entries, so two numbers can never light up at once during
  a transition. The observer only reveals content.
- Every claim on it is something that is built. If a slide starts describing
  something that is only planned, the deck has stopped being useful.
