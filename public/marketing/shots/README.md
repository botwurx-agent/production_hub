# Product screenshots

Drop the marketing site's screenshots here as PNGs. They are referenced by
basename, so the filename IS the wiring: `projects-board.png` fills the frame
the page asks for with `shot="projects-board"`, and a name nothing asks for is
simply unused.

Until a file exists its frame renders a dashed placeholder naming what is
missing, so a gap is obvious rather than silent (see components/marketing/shot.tsx).

## Currently asked for by the home page

| File | Where it appears |
| --- | --- |
| `projects-board.png` | under the hero |
| `client-review-portal.png` | Client review section |
| `project-callsheet.png` | Shoot day section |
| `project-budget.png` | The money section, left column |
| `project-invoices.png` | The money section, right column |
| `project-pipeline.png` | AI pipeline section |
| `runner-panel.png` | Runner section |

Two of those are not a plain page load, so a capture script cannot get them on
its own and they are taken by hand:

- `runner-panel.png` needs Runner open with a PROPOSAL CARD on screen, since
  the section's claim is that it asks before it writes. An answer without a
  card does not make that argument. Stand on a project so the panel's
  selector names it, and press Cancel afterwards, or the write lands in the
  demo and the budget shot above stops matching.
- `project-pipeline.png` needs a project with real generations in it.

## Size

Do not bother optimizing these. They are served through `next/image`, which
resizes and re-encodes to AVIF or WebP per request, so a 3000px retina capture
costs a visitor about 10-30KB. Export at whatever your screen gives you.

## Capturing them

    npm run dev      # one terminal
    npm run shots    # another

That signs in as the demo studio and writes every screen in
scripts/capture-shots.mjs here at 2x. Re-run it whenever the UI changes: the
point of a script rather than hand-taken images is that the site cannot drift
away from the product. It does not cover the two hand-taken shots above.

**Capture from the DEMO studio, not a real one.** Northline Studio exists so
these images carry invented client names; a screenshot of live work publishes
your client list on a public page. See scripts/README.md.

This file also exists to keep the directory in git, which does not track empty
folders, so there is somewhere to upload to.
