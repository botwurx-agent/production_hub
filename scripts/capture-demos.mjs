// Records the short looping demo clips the marketing pages play.
//
//   npm run dev                    # in one terminal
//   node scripts/capture-demos.mjs
//
// A screenshot cannot show an interaction, and on the canvas pages every claim
// IS an interaction: creation is drag-only, selecting a card turns the tool rail
// into that card's editor, arrows are drawn by dragging between cards. So those
// sections get a clip instead of a still.
//
// Same rules as capture-shots.mjs, for the same reasons: the real demo studio,
// never a mockup, one viewport so nothing is a different scale to anything else,
// and 1503x852 so a clip's section is the same height as a screenshot's.
//
// Playwright records WebM/VP8 and cannot record anything else. iOS Safari's
// WebM support is patchy enough that a marketing page would show some iPhones a
// black box, so each clip is also transcoded to MP4/H.264 and the player lists
// the MP4 first. The transcode needs an ffmpeg; see resolveFfmpeg below for the
// four places this looks. Without one you still get WebM, and the script says
// so rather than failing silently.

import { mkdirSync, renameSync, rmSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "public", "marketing", "demos");
const TMP = join(here, "..", ".demo-recordings");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const DEMO_EMAIL = "demo@studio-flows.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "N0rthline!Demo2026";
const PROJECT = "b1000000-0000-4000-a000-000000000001";

/** Same shape as every screenshot, so a clip and a still are interchangeable. */
const VIEW = { width: 1503, height: 852 };

/**
 * An ffmpeg from wherever this machine happens to keep one. Deliberately not a
 * hard dependency: the repo carries very few, and a missing transcoder should
 * cost you the MP4, not the run.
 */
function resolveFfmpeg() {
  const tries = [
    () => process.env.FFMPEG,
    () => {
      const p = join(here, "..", "node_modules", "ffmpeg-static", "ffmpeg");
      return existsSync(p) ? p : null;
    },
    () => {
      try {
        return execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
      } catch {
        return null;
      }
    },
    () => {
      try {
        return execFileSync(
          "python3",
          ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
          { encoding: "utf8" },
        ).trim();
      } catch {
        return null;
      }
    },
  ];
  for (const t of tries) {
    const p = t();
    if (p && existsSync(p)) return p;
  }
  return null;
}

const FFMPEG = resolveFfmpeg();

/**
 * name, the page to open, and the interaction to perform.
 *
 * `act` receives the page. Move deliberately and pause: this is a demo, and a
 * cursor that teleports reads as a glitch rather than as a gesture. Playwright's
 * mouse has no visible pointer, so the MOTION has to carry the story, which is
 * why every drag is stepped rather than instant.
 */
/**
 * Drag a creation tool off the rail onto the canvas and return the id of the
 * card it made, or null.
 *
 * The rail's creation tools are DRAG-ONLY: a click flashes a bubble reading
 * `Drag "Note" onto the board` and creates nothing. That is the product
 * behaviour the clip exists to show, and it is also why this cannot be a
 * click. The drop uses HTML5 drag-and-drop, which Playwright's mouse does
 * drive, but only if the move is stepped: a teleport fires no dragover.
 *
 * The returned id is what the cleanup pass deletes, so a recording run leaves
 * the demo studio exactly as it found it.
 */
async function dragTool(page, tool, x, y) {
  const before = await itemIds(page);
  const el = page.locator(`[data-demo="rail-${tool}"]`).first();
  if (!(await el.count())) return null;
  const b = await el.boundingBox();
  if (!b) return null;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(700);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 45 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(1400);
  const after = await itemIds(page);
  return after.find((id) => !before.includes(id)) ?? null;
}

/** Every card currently on the canvas, by id. */
function itemIds(page) {
  return page.$$eval("[data-item-id]", (els) =>
    els.map((e) => e.getAttribute("data-item-id")).filter(Boolean),
  );
}

/**
 * The demo studio, dressed the same way every screenshot dresses it: light
 * theme, sidebar expanded, no first-run tour card over the thing being shown.
 */
async function prime(page) {
  await page.evaluate(() => {
    try {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
      localStorage.setItem("sidebar.collapsed", "0");
      localStorage.setItem("tour.seen.welcome", "1");
      localStorage.setItem("tour.seen.project-hub", "1");
      localStorage.setItem("dashboard.setupDismissed", "1");
    } catch {}
  });
}

/**
 * Put the board back.
 *
 * A clip that shows creation has to CREATE something, so recording is a write
 * against the real demo studio, and the studio's whole job is to be
 * photographed: one stray empty note per run would compound into a board
 * nobody would want in a screenshot. So every card a clip made is deleted
 * afterwards, by id, in a page that is not being recorded.
 *
 * Deleting a card takes its arrows with it (board_connections cascades) and
 * deleting a column takes its children (parent_id cascades), which is exactly
 * why the clips above only ever file cards they created themselves into
 * columns they created themselves. Filing a real reference into a demo column
 * would delete the reference.
 */
async function undoClip(browser, storageState, path, ids) {
  const ctx = await browser.newContext({ viewport: VIEW, storageState });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await prime(page);
  await page.waitForTimeout(3000);
  for (const id of ids) {
    const el = page.locator(`[data-item-id="${id}"]`).first();
    if (!(await el.count())) continue; // already gone with its parent
    await el.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(300);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(900);
  }
  const left = (await itemIds(page)).filter((id) => ids.includes(id));
  if (left.length) console.warn(`      left behind on the board: ${left.join(", ")}`);
  await ctx.close();
}

const CLIPS = [
  {
    name: "moodboard-drag",
    path: `/projects/${PROJECT}/moodboard`,
    settle: 3500,
    async act(page) {
      // Creation is drag-only on purpose (clicking a tool creates nothing and
      // says so), which is exactly the thing a still cannot show.
      await dragTool(page, "note", 640, 430);
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "moodboard-rail",
    path: `/projects/${PROJECT}/moodboard`,
    settle: 3500,
    // Selecting and opening a flyout changes nothing on the board, so there is
    // nothing to undo afterwards.
    mutates: false,
    async act(page) {
      // Selecting a card turns the 52px tool rail into that card's editor. The
      // whole point is that the canvas does not move while it happens.
      const card = page.locator("[data-item-id]").first();
      if (!(await card.count())) return;
      await card.click({ position: { x: 40, y: 40 } });
      await page.waitForTimeout(1600);
      const tool = page.locator('[data-demo="card-tool"]').first();
      if (await tool.count()) {
        await tool.click();
        await page.waitForTimeout(2200);
      }
    },
  },
  {
    name: "moodboard-connect",
    path: `/projects/${PROJECT}/moodboard`,
    settle: 3500,
    async act(page) {
      // Drag a NEW note on first, then join it to a reference that is already
      // there. Two reasons, and the second is the one that matters: it reads
      // better (a thought appears and is attached to the frame it is about),
      // and board_connections cascades on board_items delete, so deleting the
      // note in the cleanup pass takes the arrow with it. Connecting two
      // existing cards would leave an arrow nobody asked for on a board that
      // exists to be photographed.
      const made = await dragTool(page, "note", 700, 620);
      if (!made) return;
      await page.waitForTimeout(700);
      const target = page.locator("[data-item-id]").nth(1);
      const box = await target.boundingBox();
      const anchor = page.locator('[data-demo="connect-anchor"]').first();
      if (!box || !(await anchor.count())) return;
      const a = await anchor.boundingBox();
      if (!a) return;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.waitForTimeout(500);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 40 });
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.waitForTimeout(2000);
    },
  },
  {
    name: "moodboard-column",
    path: `/projects/${PROJECT}/moodboard`,
    settle: 3500,
    async act(page) {
      // A column, then a card dropped into it. BOTH are created here rather
      // than filing an existing reference away, because parent_id cascades:
      // deleting the column in the cleanup pass would delete whatever had been
      // filed inside it, and that would be a real card off the real board.
      const col = await dragTool(page, "column", 1120, 300);
      if (!col) return;
      await page.waitForTimeout(900);
      const note = await dragTool(page, "note", 700, 640);
      if (!note) return;
      await page.waitForTimeout(700);
      const from = await page.locator(`[data-item-id="${note}"]`).boundingBox();
      const to = await page.locator(`[data-column-id="${col}"]`).boundingBox();
      if (!from || !to) return;
      await page.mouse.move(from.x + from.width / 2, from.y + 16);
      await page.waitForTimeout(400);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height - 30, { steps: 45 });
      await page.waitForTimeout(500);
      await page.mouse.up();
      await page.waitForTimeout(2200);
    },
  },
  {
    name: "moodboard-import",
    path: `/projects/${PROJECT}/moodboard`,
    settle: 3500,
    // Opening the picker and closing it again touches nothing.
    mutates: false,
    async act(page) {
      // The rail's lower group reaches the project's own library, Drive and
      // Figma. Opening the first one is the claim: the references are already
      // somewhere, and the board goes and gets them.
      const tool = page.locator('[data-demo="rail-project-assets"]').first();
      if (!(await tool.count())) return;
      await page.mouse.move(760, 420);
      const b = await tool.boundingBox();
      if (!b) return;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
      await page.waitForTimeout(800);
      await tool.click();
      await page.waitForTimeout(3000);
    },
  },
];

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
);

/** Sign in once; every clip reuses the session. */
const auth = await browser.newContext({ viewport: VIEW });
const login = await auth.newPage();
await login.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await login.fill('input[type="email"]', DEMO_EMAIL);
await login.fill('input[type="password"]', DEMO_PASSWORD);
await login.click('button[type="submit"]');
await login.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
if (!/\/dashboard/.test(login.url())) {
  console.error(`Sign-in did not land on the dashboard (at ${login.url()}).`);
  console.error("Check the demo user still exists and the dev server is running.");
  await browser.close();
  process.exit(1);
}
const storageState = await auth.storageState();
await auth.close();

for (const clip of CLIPS) {
  // One context per clip: Playwright writes a video per context, and closing it
  // is what flushes the file.
  const ctx = await browser.newContext({
    viewport: VIEW,
    storageState,
    recordVideo: { dir: TMP, size: VIEW },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + clip.path, { waitUntil: "domcontentloaded" });
  await prime(page);
  await page.waitForTimeout(clip.settle);

  const before = clip.mutates === false ? [] : await itemIds(page);
  await clip.act(page);
  const after = clip.mutates === false ? [] : await itemIds(page);
  const made = after.filter((id) => !before.includes(id));

  await ctx.close();

  // Playwright names the file by an internal id, so take whatever landed.
  const files = readdirSync(TMP).filter((f) => f.endsWith(".webm"));
  const src = join(TMP, files[files.length - 1]);
  const webm = join(OUT, `${clip.name}.webm`);
  renameSync(src, webm);
  console.log(`clip  ${clip.name}.webm`);

  if (made.length) await undoClip(browser, storageState, clip.path, made);

  if (FFMPEG) {
    const mp4 = join(OUT, `${clip.name}.mp4`);
    execFileSync(FFMPEG, [
      "-loglevel", "error", "-y", "-i", webm,
      // yuv420p and the even-dimension scale are what make it play on phones
      // at all; faststart puts the index first so it starts before it finishes.
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags", "+faststart", "-an", mp4,
    ]);
    // A poster, so the section is never a blank rectangle while the clip loads
    // and so reduced-motion visitors get a still rather than nothing.
    execFileSync(FFMPEG, [
      "-loglevel", "error", "-y", "-i", webm,
      "-frames:v", "1", "-q:v", "3", join(OUT, `${clip.name}.jpg`),
    ]);
    console.log(`      ${clip.name}.mp4 + poster`);
  }
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });

if (!FFMPEG) {
  console.warn(
    "\nNo ffmpeg found, so only WebM was written. iOS Safari's WebM support is\n" +
      "patchy, so some iPhones will show a blank frame. Install one of:\n" +
      "  npm i -D ffmpeg-static      (or)      pip install imageio-ffmpeg\n" +
      "then re-run.",
  );
}
