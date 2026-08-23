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
| `project-communication.png` | Communication section |
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

`project-communication.png` has its own script:

    npm run dev
    npm run shots:comms

It cannot come from the demo studio like the rest. The Communication page holds
the LINK to a conversation and reads the messages from Gmail and Slack at render
time, so without a live connector the panels can only be photographed shut. The
demo studio's seeded `email_accounts` rows make the closed state render, and
nothing further: opening a thread calls the real API with an invented token and
fails.

It is also the one shot that is not a crop. Every image here is 3006x1704
because they all render at the same width on the marketing page, so the aspect
ratio alone decides how tall a section is: a full-page capture of this screen
came out 3200x3446 and drew a section twice the height of every other one. The
others reach that shape by cropping the top of a page that continues below the
fold, which does not work here, since cropping the Communication page at 852 CSS
pixels gets as far as the Slack panel's header and stops. So the script takes
the same 1.764 shape from a wider window (2250x1276 at 1.336x) and the whole
page fits inside it. The UI sits about a third smaller in frame than in its
neighbours, which is the price of not losing the thing being shown.

So the script shoots `/dev/comms`, a fixture that renders the real Sidebar,
ProjectSubhead and Card on the real tokens with an invented conversation in the
same Bright Water fiction the demo already uses. Read that file's header for
exactly what is real and what is drawn. If a throwaway inbox is ever connected
to the demo studio, delete the fixture and the script and add the real page to
capture-shots.mjs, which is strictly better. Never connect a real client inbox:
a screenshot of live mail publishes a client list.

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
