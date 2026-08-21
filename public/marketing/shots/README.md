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
| `project-budget.png` | The money section |

## Capturing them

    npm run dev      # one terminal
    npm run shots    # another

That signs in as the demo studio and writes every screen in
scripts/capture-shots.mjs here at 2x, which is more than the four above. Re-run
it whenever the UI changes: the point of a script rather than hand-taken images
is that the site cannot drift away from the product.

**Capture from the DEMO studio, not a real one.** Northline Studio exists so
these images carry invented client names; a screenshot of live work publishes
your client list on a public page. See scripts/README.md.

This file also exists to keep the directory in git, which does not track empty
folders, so there is somewhere to upload to.
