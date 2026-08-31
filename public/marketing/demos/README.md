# Marketing demo clips

Recorded, never hand-made. `npm run demos` drives the real app in a browser as
the demo studio and writes three files per clip:

- `<clip>.webm` (what Playwright records; VP8 is the only format it can write)
- `<clip>.mp4` (H.264, listed first by the player because iOS Safari's WebM
  support is patchy enough that some iPhones would show a blank frame)
- `<clip>.jpg` (the poster, and what someone with reduced motion sees)

Clips are committed. One is around 180KB, less than any of the screenshots it
sits beside, so keeping them in the repo is cheaper than the plumbing an
external host would need.

Recording needs ffmpeg on PATH, or `ffmpeg-static` in node_modules, or the
`imageio-ffmpeg` python package. The script looks for all three and says which
it found.

The pointer in the clips is DRAWN, not recorded. Playwright records through
Chromium's screencast API, which does not composite the operating system's
cursor, so without this a clip shows cards moving with nothing driving them.
The drawn one follows the real mouse by listening for the events Playwright's
dispatches produce, so it cannot drift out of step with what the app is being
told. `glide()` eases each move rather than using Playwright's linear
interpolation, which starts and stops dead.

Adding a clip: add an entry to `CLIPS` in `scripts/capture-demos.mjs` and give
whatever it clicks a `data-demo` attribute in the component. Anchor on
`data-demo`, never on a CSS class, so restyling cannot silently break a
recording.
