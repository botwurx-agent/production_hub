// Captures the product screenshots the marketing site uses.
//
//   npm run dev            # in one terminal
//   node scripts/capture-shots.mjs
//
// Signs in as the demo studio, walks a fixed list of screens, and writes PNGs
// into public/marketing/shots/. Re-run it whenever the UI changes: the point of
// a script rather than a folder of hand-taken images is that the site can never
// drift away from the product.
//
// Every shot is deliberate about three things, because inconsistency between
// them is what makes a marketing page look assembled rather than designed:
//   - one viewport width, so nothing is a different scale to anything else
//   - deviceScaleFactor 2, so the images survive a retina display
//   - one theme per shot, chosen here rather than inherited from the machine
//
// BASE_URL overrides the target if you are not on the default dev port.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "public", "marketing", "shots");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const DEMO_EMAIL = "demo@studio-flows.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "N0rthline!Demo2026";

const PROJECT = "b1000000-0000-4000-a000-000000000001";
const CLIENT = "c1000000-0000-4000-a000-000000000001";
// the client review portal takes no login, so it is captured in a clean context
const REVIEW_TOKEN = "nl7Qk2vX9mBd4TsPzR6yHgWc1JfEoAu3";

// name, path, theme, and how long to settle. Signed image URLs and the summary
// panel arrive after first paint, so a flat wait is more reliable here than
// networkidle, which never fires while the notification poll is running.
const SHOTS = [
  ["dashboard", "/dashboard", "light", 3500],
  ["projects-board", "/projects", "light", 2500],
  ["projects-slate", "/projects?view=slate", "light", 2500],
  ["project-hub", `/projects/${PROJECT}`, "light", 3500],
  ["project-review", `/projects/${PROJECT}/review`, "light", 3000],
  ["project-assets", `/projects/${PROJECT}/assets`, "light", 3000],
  ["project-budget", `/projects/${PROJECT}/budget`, "light", 2500],
  ["project-callsheet", `/projects/${PROJECT}/callsheet`, "light", 3000],
  ["project-shot-list", `/projects/${PROJECT}/shot-list`, "light", 3000],
  ["project-storyboards", `/projects/${PROJECT}/storyboards`, "light", 3000],
  ["project-contacts", `/projects/${PROJECT}/contacts`, "light", 2500],
  ["project-calendar", `/projects/${PROJECT}/calendar`, "light", 2500],
  ["pipeline", "/pipeline", "light", 2500],
  ["client", `/clients/${CLIENT}`, "light", 2500],
  // the review canvas is the one surface that belongs on a dark ground, since
  // that is how the product itself asks you to judge a frame
  ["project-hub-dark", `/projects/${PROJECT}`, "dark", 3500],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(page, name, path, theme, settle) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
      // a tour card popping up over the UI ruins an otherwise good screenshot
      localStorage.setItem("tour.seen.welcome", "1");
      localStorage.setItem("tour.seen.project-hub", "1");
      localStorage.setItem("dashboard.setupDismissed", "1");
    } catch {}
  }, theme);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`shot  ${name}`);
}

// signed-in screens
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', DEMO_EMAIL);
await page.fill('input[type="password"]', DEMO_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
if (!/\/dashboard/.test(page.url())) {
  console.error(`Sign-in did not land on the dashboard (at ${page.url()}).`);
  console.error("Check the demo user still exists and the dev server is running.");
  await browser.close();
  process.exit(1);
}

for (const [name, path, theme, settle] of SHOTS) {
  await shoot(page, name, path, theme, settle);
}

// the client portal, signed out, because that is how a client sees it
const clean = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const guest = await clean.newPage();
await shoot(guest, "client-review-portal", `/r/${REVIEW_TOKEN}`, "light", 3500);

// phone, for the responsive band on the site
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const small = await phone.newPage();
await small.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await small.fill('input[type="email"]', DEMO_EMAIL);
await small.fill('input[type="password"]', DEMO_PASSWORD);
await small.click('button[type="submit"]');
await small.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
await shoot(small, "phone-project-hub", `/projects/${PROJECT}`, "light", 3500);

await browser.close();
console.log(`\nDone. ${SHOTS.length + 2} images in public/marketing/shots/`);
