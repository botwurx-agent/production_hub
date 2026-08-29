// Crops the detail tiles the marketing hero's shot cluster is built from.
//
//   node scripts/crop-closeups.mjs
//
// A full app screenshot is illegible at the size a hero gives it, so the
// cluster shows CLOSEUPS instead: one legible piece of the product per tile,
// taken out of the screenshots capture-shots.mjs already produced. They stay
// real for the same reason those do (the demo studio, never a mockup), and
// cropping rather than re-shooting means a tile can never drift away from the
// screenshot it came from.
//
// Rectangles are in the SOURCE image's own pixels (the shots are captured at
// deviceScaleFactor 2, so a 700px-wide crop here draws at 350 CSS pixels and
// still survives a retina display). Re-run after capture-shots.mjs.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "..", "public", "marketing", "shots");
const OUT = join(SHOTS, "close");

/** name, source shot, and the rectangle to lift out of it. */
const CROPS = [
  // The client pointing at the frame: their comment, badged as theirs.
  ["review-comment", "client-review-portal.png", { x: 2200, y: 398, w: 770, h: 226 }],
  // The crew answering: how many have confirmed, and the send that chases them.
  ["callsheet-send", "project-callsheet.png", { x: 2240, y: 552, w: 662, h: 100 }],
  // What the job made, which is the end of the same story.
  ["budget-margin", "project-budget.png", { x: 574, y: 796, w: 740, h: 235 }],
  // The cluster's anchor: the review canvas itself, which stays legible small
  // because it is a photograph with numbered pins on it rather than an
  // interface full of 13px type. Cropped INSIDE the canvas rather than around
  // it, so the subject sits left of centre: the pins then read clear of the
  // comment tile that floats over the empty half, and pin 2 is visible beside
  // the comment that refers to it.
  ["review-stage", "client-review-portal.png", { x: 596, y: 330, w: 1492, h: 1120 }],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();

for (const [name, source, rect] of CROPS) {
  const b64 = readFileSync(join(SHOTS, source)).toString("base64");
  const data = await page.evaluate(
    async ([b64, rect]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = rect.w;
      c.height = rect.h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      return c.toDataURL("image/png");
    },
    [b64, rect]
  );
  const png = Buffer.from(data.split(",")[1], "base64");
  writeFileSync(join(OUT, `${name}.png`), png);
  console.log(`${name}.png  ${rect.w}x${rect.h}  from ${source}`);
}

await browser.close();
console.log(`\nDone. ${CROPS.length} tiles in public/marketing/shots/close/`);
