// Captures project-communication.png, the one marketing shot the ordinary
// capture script cannot take.
//
//   npm run dev
//   node scripts/capture-communication.mjs
//
// WHY THIS IS SEPARATE. Every other screen renders from our own database, so
// capture-shots.mjs signs in as the demo studio and the page draws itself. The
// Communication page does not: it holds the LINK to a conversation and reads
// the messages from Gmail and Slack at render time. There is nothing seedable
// about a Gmail thread, and there never will be, since the whole point of the
// feature is that the mail still lives in the mail. Without a live connector
// the panels can only be photographed shut.
//
// So it shoots app/dev/comms, a fixture that renders the real Sidebar, the real
// ProjectSubhead and the real Card on the real tokens, with an invented
// conversation in the Bright Water fiction the demo studio already uses. Read
// that file's header for what is real and what is drawn.
//
// SIZE MATTERS MORE HERE THAN ANYWHERE. Every shot on the marketing page renders
// at the same WIDTH, so its aspect ratio alone decides how tall its section is.
// The other images are all 3006x1704, so this must be too: a fullPage capture
// came out 3200x3446 and drew a section twice the height of every other one,
// which read as a different site.
//
// The others get that shape by CROPPING the top of a page that carries on below
// the fold. That does not work here. Cropping this page at 852 CSS pixels gets
// as far as the Slack panel's header and stops, and a Communication shot with
// no Slack message in it is not making the argument. The three panels stack, so
// the height is the content, not a choice.
//
// So it takes the same SHAPE from a wider window instead: 2250x1276 is the same
// 1.764 ratio, and the whole page fits inside it. The trade is that the UI sits
// about a third smaller in frame than in its neighbours. Worth it, because the
// alternative loses the thing being shown, and because these are viewed at
// around 760px wide where everything is small anyway.
//
// If you add to the fixture, widen this to match (keep width / height at 1.764)
// or trim the fixture back. Do not switch it to fullPage.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "public", "marketing", "shots");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : undefined,
);
// 1.336 rather than 2, so the file lands at 3006x1705 and matches the other
// shots pixel for pixel rather than merely in proportion.
const ctx = await browser.newContext({
  viewport: { width: 2250, height: 1276 },
  deviceScaleFactor: 1.336,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/dev/comms`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  document.documentElement.setAttribute("data-theme", "light");
  try {
    localStorage.setItem("theme", "light");
  } catch {}
});
await page.waitForTimeout(1500);

await page.screenshot({ path: join(OUT, "project-communication.png") });
console.log("shot  project-communication");

await browser.close();
