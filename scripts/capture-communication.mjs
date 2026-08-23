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
// Same viewport and deviceScaleFactor as capture-shots.mjs on purpose: a shot
// at a different scale to the others is what makes a page look assembled
// rather than designed.

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
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
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

// The fixture is taller than the viewport (three panels, one thread open), and
// the argument is that all three channels sit on one page, so a viewport-height
// crop would cut off the half that makes the point.
await page.screenshot({
  path: join(OUT, "project-communication.png"),
  fullPage: true,
});
console.log("shot  project-communication");

await browser.close();
