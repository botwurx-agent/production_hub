// Captures the source footage for the tour film (components/marketing/tour-film.tsx).
//
// STOP MOTION, NOT A SCREEN RECORDER. Each take drives the REAL app in the demo
// studio one small step at a time (move the pointer a little, scroll a little,
// seek the video one frame) and photographs every step at 2x. That gives real
// product footage that is perfectly sharp, has no dropped frames and comes out
// the same on every run, which a live screen recording in a headless browser
// cannot. The pointer is not in the pictures: its position is written to the
// take's manifest and the film draws it, so it can be restyled and is never
// blurred by a zoom.
//
//   BASE_URL=http://localhost:3111 node scripts/film/capture-tour.mjs
//   ONLY=mood,sched node scripts/film/capture-tour.mjs
//
// Needs a dev server on the demo database and a Chrome with H.264 (the review
// cut is an MP4, which Playwright's own Chromium cannot decode).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "..", "public", "film-src");
const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const P = "b1000000-0000-4000-a000-000000000001";
const VW = 1280;
const VH = 720;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(dsf, collapsed) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dsf, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill('input[type="email"]', "demo@studio-flows.com");
  await page.fill('input[type="password"]', process.env.DEMO_PASSWORD ?? "N0rthline!Demo2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|projects/, { timeout: 60000 });
  await page.evaluate((c) => {
    localStorage.setItem("theme", "light");
    localStorage.setItem("dashboard.setupDismissed", "1");
    localStorage.setItem("tour.seen.welcome", "1");
    localStorage.setItem("tour.seen.project-hub", "1");
    localStorage.setItem("board.hints.v1", JSON.stringify(["note", "todo", "column", "line", "link", "image", "color", "heading", "shape", "video"]));
    if (c) localStorage.setItem("sidebar.collapsed", "1");
    else localStorage.removeItem("sidebar.collapsed");
  }, collapsed);
  return { browser, page };
}

class Take {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.dir = join(OUT, name);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.frames = [];
    this.marks = {};
    this.files = 0;
    this.x = VW * 0.72;
    this.y = VH * 0.8;
    this.down = false;
  }
  /** Photograph the page as it stands. */
  async frame() {
    const i = this.files++;
    await this.page.screenshot({ path: join(this.dir, String(i).padStart(4, "0") + ".jpg"), type: "jpeg", quality: 90 });
    this.frames.push({ i, x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, d: this.down ? 1 : 0 });
  }
  /** n frames of nothing changing: one photograph, reused. */
  async hold(n) {
    if (n <= 0) return;
    await this.frame();
    const last = this.frames[this.frames.length - 1];
    for (let k = 1; k < n; k++) this.frames.push({ ...last });
  }
  mark(name) {
    this.marks[name] = this.frames.length;
  }
  async to(x, y, n, shoot = true) {
    const x0 = this.x;
    const y0 = this.y;
    // A slight arc reads as a hand; a straight line reads as a script.
    const bow = Math.min(40, Math.hypot(x - x0, y - y0) * 0.12);
    for (let k = 1; k <= n; k++) {
      const e = ease(k / n);
      const arc = Math.sin(Math.PI * e) * bow;
      this.x = x0 + (x - x0) * e;
      this.y = y0 + (y - y0) * e - arc;
      await this.page.mouse.move(this.x, this.y);
      if (shoot) await this.frame();
    }
  }
  /** Pointer travel where nothing on the page changes: one photograph for the lot. */
  async glide(x, y, n) {
    await this.frame();
    const base = this.frames[this.frames.length - 1];
    const x0 = this.x;
    const y0 = this.y;
    const bow = Math.min(40, Math.hypot(x - x0, y - y0) * 0.12);
    for (let k = 1; k <= n; k++) {
      const e = ease(k / n);
      this.x = x0 + (x - x0) * e;
      this.y = y0 + (y - y0) * e - Math.sin(Math.PI * e) * bow;
      this.frames.push({ i: base.i, x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, d: 0 });
    }
    await this.page.mouse.move(this.x, this.y);
    await sleep(150);
    await this.frame();
  }
  async press(settle = 350) {
    this.mark("click" + Object.keys(this.marks).filter((k) => k.startsWith("click")).length);
    await this.page.mouse.down();
    this.down = true;
    await sleep(60);
    await this.frame();
    await this.frame();
    await this.page.mouse.up();
    this.down = false;
    await sleep(settle);
    await this.frame();
  }
  async scroll(total, n, settle = 70) {
    let done = 0;
    for (let k = 1; k <= n; k++) {
      const want = total * ease(k / n);
      await this.page.mouse.wheel(0, want - done);
      done = want;
      await sleep(settle);
      await this.frame();
    }
  }
  save() {
    writeFileSync(join(this.dir, "take.json"), JSON.stringify({ name: this.name, w: VW, h: VH, files: this.files, marks: this.marks, frames: this.frames }));
    console.log(`  ${this.name}: ${this.frames.length} frames, ${this.files} pictures, marks ${JSON.stringify(this.marks)}`);
  }
}

const centre = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error("not on screen");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};
/** Scroll the whole page once so lazy pictures are in before the take starts. */
async function warm(page) {
  await page.evaluate(async () => {
    const el = document.scrollingElement;
    for (let y = 0; y < el.scrollHeight; y += 500) {
      el.scrollTop = y;
      await new Promise((r) => setTimeout(r, 120));
    }
    el.scrollTop = 0;
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  await sleep(600);
}

const TAKES = {
  // The projects board, then into the job: one real click, one real navigation.
  async open(page) {
    const t = new Take(page, "open");
    await page.goto(`${BASE}/projects`);
    await sleep(3500);
    await page.mouse.move(t.x, t.y);
    await t.hold(14);
    const card = await centre(page.locator("a", { hasText: "Bright Water hero spot" }).first());
    await t.glide(card.x - 10, card.y + 6, 26);
    await t.hold(6);
    t.mark("nav");
    await page.mouse.down();
    t.down = true;
    await t.frame();
    await t.frame();
    await page.mouse.up();
    t.down = false;
    await page.waitForURL(new RegExp(P), { timeout: 30000 });
    await sleep(4500);
    await warm(page);
    t.mark("hub");
    await t.hold(40);
    t.mark("scroll");
    await t.scroll(980, 84);
    await t.hold(24);
    t.save();
  },
  async mood(page) {
    const t = new Take(page, "mood");
    await page.goto(`${BASE}/projects/${P}/moodboard`);
    await page.waitForSelector("[data-item-id]", { timeout: 40000 });
    await sleep(2500);
    // See the whole board: pinch out a little, anchored at the top-left card.
    const stage = await centre(page.locator("[data-item-id]").first());
    await page.mouse.move(stage.x, stage.y);
    await page.keyboard.down("Control");
    for (let k = 0; k < 4; k++) {
      await page.mouse.wheel(0, 12);
      await sleep(120);
    }
    await page.keyboard.up("Control");
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll("[data-item-id]")]
        .filter((e) => e.querySelector(":scope > div > img"))
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })
    );
    console.log("  mood cards", JSON.stringify(cards.map((c) => [Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h)])));
    const c = cards[4] ?? cards[cards.length - 1];
    const pitchX = cards.length > 1 ? cards[1].x - cards[0].x : c.w * 1.1;
    const pitchY = cards.length > 3 ? cards[3].y - cards[0].y : c.h * 1.15;
    await page.mouse.move(t.x, t.y);
    await t.hold(12);
    await t.glide(c.x + c.w * 0.5, c.y + c.h * 0.45, 26);
    await t.hold(5);
    t.mark("grab");
    await page.mouse.down();
    t.down = true;
    await sleep(200);
    await t.frame();
    await t.frame();
    await t.to(t.x + pitchX * 0.5, t.y - pitchY * 0.5, 34);
    await t.frame();
    t.mark("drop");
    await page.mouse.up();
    t.down = false;
    await sleep(500);
    await t.hold(26);
    t.save();
    // Put it back where it was: the demo studio is photographed for the site.
    await page.mouse.down();
    await page.mouse.move(t.x - pitchX * 0.5, t.y + pitchY * 0.5, { steps: 12 });
    await page.mouse.up();
    await sleep(1500);
  },
  async story(page) {
    const t = new Take(page, "story");
    await page.goto(`${BASE}/projects/${P}/storyboards`);
    await sleep(3500);
    await warm(page);
    await page.mouse.move(t.x, t.y);
    await t.hold(16);
    await t.scroll(330, 46);
    await t.hold(24);
    t.save();
  },
  async sched(page) {
    const t = new Take(page, "sched");
    await page.goto(`${BASE}/projects/${P}/schedule`);
    await sleep(3500);
    await warm(page);
    await page.mouse.wheel(0, 150);
    await sleep(600);
    await page.mouse.move(t.x, t.y);
    await t.hold(14);
    const plus = page.locator('button[aria-label="15 minutes longer"]:visible, button[title="15 minutes longer"]:visible');
    const target = await centre(plus.nth(2));
    await t.glide(target.x, target.y, 26);
    await t.hold(5);
    await t.press(700);
    await t.hold(9);
    await t.press(700);
    await t.hold(9);
    await t.press(700);
    await t.hold(30);
    t.save();
    const minus = page.locator('button[aria-label="15 minutes shorter"]:visible, button[title="15 minutes shorter"]:visible');
    for (let k = 0; k < 3; k++) {
      await minus.nth(2).click();
      await sleep(900);
    }
  },
  async sheet(page) {
    const t = new Take(page, "sheet");
    await page.goto(`${BASE}/projects/${P}/callsheet`);
    await sleep(4000);
    await page.mouse.move(t.x, t.y);
    await t.hold(22);
    const send = await centre(page.getByRole("button", { name: /Send/ }).first());
    await t.glide(send.x, send.y, 24);
    await t.hold(5);
    await t.press(900);
    t.mark("panel");
    await t.hold(18);
    await t.to(640, 520, 12, false);
    await t.scroll(170, 26);
    await t.hold(26);
    t.save();
    await page.keyboard.press("Escape");
  },
  // Pins on a still: open the review window, drop a pin, write the note. Never posted.
  async pins(page) {
    const t = new Take(page, "pins");
    await page.goto(`${BASE}/projects/${P}/review`);
    await sleep(4000);
    await page.mouse.move(t.x, t.y);
    await t.hold(12);
    const open = await centre(page.getByRole("button", { name: /Review · 4/ }).first());
    await t.glide(open.x, open.y, 22);
    await t.hold(4);
    await t.press(2600);
    t.mark("window");
    await t.hold(20);
    const img = await centre(page.locator('[role="dialog"] img, .fixed img').last());
    await t.glide(img.b.x + img.b.width * 0.62, img.b.y + img.b.height * 0.34, 24);
    await t.hold(4);
    await t.press(700);
    t.mark("pin");
    await t.hold(8);
    t.mark("type");
    for (const ch of "Love this. Lift the highlight on the shoulder.") {
      await page.keyboard.type(ch);
      await sleep(30);
      await t.frame();
    }
    await t.hold(30);
    t.save();
    await page.keyboard.press("Escape");
    await sleep(300);
    await page.keyboard.press("Escape");
  },
  // The approved cut, played by seeking it one frame at a time.
  async cut(page) {
    const t = new Take(page, "cut");
    await page.goto(`${BASE}/projects/${P}/review`);
    await sleep(4000);
    await warm(page);
    // The hero cut is the approved one: its button reads "Approved (1) Review".
    const found = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Approved.*Review/.test((x.textContent || "").trim()));
      if (b) b.setAttribute("data-film-target", "cut");
      return !!b;
    });
    if (!found) throw new Error("no Review button for the hero cut");
    const btn = page.locator('[data-film-target="cut"]').first();
    await btn.scrollIntoViewIfNeeded();
    await sleep(500);
    await btn.click();
    await page.waitForSelector('video', { timeout: 20000 });
    await sleep(3500);
    const seek = (s) =>
      page.evaluate(async (s) => {
        const v = [...document.querySelectorAll("video")].sort((a, b) => b.clientWidth - a.clientWidth)[0];
        v.pause();
        await new Promise((r) => {
          v.addEventListener("seeked", r, { once: true });
          v.currentTime = s;
          setTimeout(r, 1500);
        });
        v.dispatchEvent(new Event("timeupdate"));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, s);
    // The film plays this back as a running cut, so the big paused-state play
    // button over the picture is hidden for the take.
    await page.addStyleTag({ content: 'button[aria-label="Play"].absolute{visibility:hidden!important}' });
    t.x = VW * 0.5;
    t.y = VH * 0.93;
    await page.mouse.move(t.x, t.y);
    for (let f = 0; f < 144; f++) {
      await seek(Math.min(4.95, f / 30));
      await t.frame();
    }
    t.save();
    await page.keyboard.press("Escape");
  },
  async budget(page) {
    const t = new Take(page, "budget");
    await page.goto(`${BASE}/projects/${P}/budget`);
    await sleep(3500);
    await warm(page);
    await page.mouse.move(t.x, t.y);
    await t.hold(40);
    await t.scroll(420, 50);
    await t.hold(30);
    t.save();
  },
  // The 3D scene builder: through the lens, then orbit the set in free view.
  async scene(page) {
    const t = new Take(page, "scene");
    await page.goto(`${BASE}/projects/${P}/scene-builder`);
    await sleep(9000);
    await page.keyboard.press("\\");
    await sleep(2500);
    t.x = 640;
    t.y = 430;
    await page.mouse.move(t.x, t.y);
    await t.hold(24);
    const free = await centre(page.getByRole("button", { name: "Free view" }).first());
    await t.glide(free.x, free.y, 18);
    await t.press(2500);
    t.mark("free");
    await t.hold(6);
    await t.glide(520, 420, 14);
    await page.mouse.down();
    t.down = true;
    await sleep(200);
    await t.frame();
    for (let k = 1; k <= 56; k++) {
      const e = ease(k / 56);
      t.x = 520 + 300 * e;
      t.y = 420 - 46 * Math.sin(Math.PI * e);
      await page.mouse.move(t.x, t.y);
      await sleep(220);
      await t.frame();
    }
    await page.mouse.up();
    t.down = false;
    await sleep(600);
    await t.hold(16);
    t.save();
  },
};

/** One sharp picture each, for the screens the film only looks at. */
const STILLS = [
  ["dashboard", "/dashboard", false],
  ["crm", "/pipeline", true],
  ["tasks", `/projects/${P}/tasks`, true],
  ["contacts", `/projects/${P}/contacts`, true],
  ["delivery", `/projects/${P}/delivery`, true],
  ["comms", `/projects/${P}/communication`, true],
  ["reports", "/reports", true],
  ["shots", `/projects/${P}/shot-list`, true],
];

const wants = (n) => !only || only.has(n);
mkdirSync(OUT, { recursive: true });

if (["open"].some(wants)) {
  const { browser, page } = await session(2, false);
  try {
    await TAKES.open(page);
  } catch (e) {
    console.log("  open FAILED", e.message.split("\n")[0]);
  }
  await browser.close();
}
{
  const names = Object.keys(TAKES).filter((n) => n !== "open" && wants(n));
  if (names.length) {
    const { browser, page } = await session(2, true);
    for (const n of names) {
      console.log(n);
      try {
        await TAKES[n](page);
      } catch (e) {
        console.log(`  ${n} FAILED`, e.message.split("\n")[0]);
      }
    }
    await browser.close();
  }
}
if (wants("stills")) {
  for (const collapsed of [false, true]) {
    const list = STILLS.filter((s) => s[2] === collapsed);
    if (!list.length) continue;
    const { browser, page } = await session(3, collapsed);
    mkdirSync(join(OUT, "stills"), { recursive: true });
    for (const [name, path] of list) {
      await page.goto(BASE + path);
      await sleep(3500);
      await warm(page);
      await page.mouse.move(VW - 2, VH - 2);
      await page.screenshot({ path: join(OUT, "stills", name + ".jpg"), type: "jpeg", quality: 92 });
      console.log("  still", name);
    }
    await browser.close();
  }
}
