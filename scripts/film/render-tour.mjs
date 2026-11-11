// Renders the tour film (components/marketing/tour-film.tsx) to an mp4.
//
//   BASE_URL=http://localhost:3000 node scripts/film/render-tour.mjs
//
// Steps the film's clock one frame at a time through /dev/tour-film?capture=1
// and pipes each 1920x1080 frame to ffmpeg. FROM / TO (ms) render a stretch,
// STILLS=a,b,c (ms) writes single frames instead, for checking an edit.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const FPS = Number(process.env.FPS || 30);
const OUT = process.env.OUT || "marketing-video/studio-flows-tour.mp4";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
// A picture that fails to load renders as a blank white page in the film, so
// a dead dev server must stop the render rather than finish it quietly.
let failed = 0;
page.on("requestfailed", (r) => {
  if (r.url().includes("/film-src/")) failed++;
});
await page.goto(`${BASE}/dev/tour-film?capture=1`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__TF && window.__TF.ready, null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__TF.duration);

const shoot = async (t) => {
  await page.evaluate((v) => window.__TF.set(v), t);
  return page.screenshot({ type: "jpeg", quality: 96 });
};

if (process.env.STILLS) {
  const dir = process.env.STILLS_DIR || "/tmp/tour-stills";
  mkdirSync(dir, { recursive: true });
  for (const s of process.env.STILLS.split(",")) {
    const t = Number(s);
    writeFileSync(`${dir}/${String(t).padStart(6, "0")}.jpg`, await shoot(t));
  }
  await browser.close();
  process.exit(0);
}

const from = Number(process.env.FROM || 0);
const to = Number(process.env.TO || duration);
const ff = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), OUT],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const total = Math.round(((to - from) / 1000) * FPS);
for (let i = 0; i < total; i++) {
  const buf = await shoot(from + (i * 1000) / FPS);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (failed) {
    console.error(`stopped at frame ${i}: ${failed} picture(s) failed to load. Is the dev server still up?`);
    ff.stdin.end();
    await browser.close();
    process.exit(1);
  }
  if (i % 60 === 0) console.log(`${i}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("wrote", OUT);
