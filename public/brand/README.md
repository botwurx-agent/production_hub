# Brand assets

One geometry, three files. The shape itself lives in `lib/brand-mark.ts` and is
drawn from there on every surface the product renders (the favicon, the nav, the
sidebar, the OG cards, the invite email). These files exist for the places code
cannot reach: uploading to Settings, Branding, handing a logo to a client, or a
deck.

- `studio-flows-tile.png` (512px) is the one to upload to Settings, Branding.
  It is square because that upload feeds two boxes at once: a 32px chip in the
  sidebar and the call sheet masthead. A wide lockup would be an unreadable
  6px strip in the first of those.
- `studio-flows-tile.svg` is the same thing as vector, for print and for any
  size above 512.
- `studio-flows-mark.svg` is the bare mark in `currentColor`, for putting on a
  ground that is not the brand indigo.

Regenerate them from the constants rather than editing them by hand, or they
drift from what the app draws.
