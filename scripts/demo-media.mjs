// Uploads the demo studio's image files into Supabase storage.
//
// The demo rows were seeded with deterministic storage paths, so this script
// only has to put a file at each one. Run it once before capturing screenshots,
// otherwise every thumbnail in the app renders as a broken frame.
//
//   node scripts/demo-media.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
// .env.local, signs in as the demo user, and uploads through the ordinary
// client, so the studio-folder storage policy is what authorises each write.
//
// SWAP IN REAL WORK. The files in scripts/demo-media/ are neutral placeholders.
// Replace any of them with a real still of the same name and re-run; nothing
// else needs to change. Screenshots of the product are only as convincing as
// the work sitting inside them.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const MEDIA = join(here, "demo-media");

const DEMO_EMAIL = "demo@studio-flows.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "N0rthline!Demo2026";

const STUDIO = "c094e1e7-b61e-4aaa-9fc9-8f41b233a4bd";
const PROJECT = "b1000000-0000-4000-a000-000000000001";
const prefix = `${STUDIO}/${PROJECT}`;

// local file -> storage path, matching exactly what the demo rows reference
const FILES = [
  ["hero-cut-v1.mp4", `${prefix}/f1000000-0000-4000-a000-000000000001-hero-cut-v1.mp4`, "video/mp4"],
  ["hero-cut-v2.mp4", `${prefix}/f1000000-0000-4000-a000-000000000002-hero-cut-v2.mp4`, "video/mp4"],
  ["hero-cut-v3.mp4", `${prefix}/f1000000-0000-4000-a000-000000000003-hero-cut-v3.mp4`, "video/mp4"],
  ["pack-shot-v1.jpg", `${prefix}/f1000000-0000-4000-a000-000000000011-pack-shot-v1.jpg`, "image/jpeg"],
  ["pack-shot-v2.jpg", `${prefix}/f1000000-0000-4000-a000-000000000012-pack-shot-v2.jpg`, "image/jpeg"],
  ["condensation-macro.jpg", `${prefix}/f1000000-0000-4000-a000-000000000021-condensation-macro.jpg`, "image/jpeg"],
  ["label-recomp.jpg", `${prefix}/f1000000-0000-4000-a000-000000000031-label-recomp.jpg`, "image/jpeg"],
  ["delivery-specs.pdf", `${prefix}/f1000000-0000-4000-a000-000000000041-delivery-specs.pdf`, "application/pdf"],
  ["certificate-of-insurance.pdf", `${prefix}/f1000000-0000-4000-a000-000000000051-certificate-of-insurance.pdf`, "application/pdf"],
  ["frame-01.jpg", `${prefix}/df000000-0000-4000-a000-000000000001-frame-01.jpg`, "image/jpeg"],
  ["frame-02.jpg", `${prefix}/df000000-0000-4000-a000-000000000002-frame-02.jpg`, "image/jpeg"],
  ["frame-03.jpg", `${prefix}/df000000-0000-4000-a000-000000000003-frame-03.jpg`, "image/jpeg"],
  ["frame-04.jpg", `${prefix}/df000000-0000-4000-a000-000000000004-frame-04.jpg`, "image/jpeg"],
  ["frame-05.jpg", `${prefix}/df000000-0000-4000-a000-000000000005-frame-05.jpg`, "image/jpeg"],
  ["frame-06.jpg", `${prefix}/df000000-0000-4000-a000-000000000006-frame-06.jpg`, "image/jpeg"],
];

function env() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) {
    throw new Error("No .env.local found. It needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const cfg = env();
const supabase = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
});
if (authError) {
  console.error(`Could not sign in as ${DEMO_EMAIL}: ${authError.message}`);
  process.exit(1);
}

let sent = 0;
let missing = 0;

for (const [file, path, contentType] of FILES) {
  const local = join(MEDIA, file);
  if (!existsSync(local)) {
    console.warn(`skip  ${file} (not in scripts/demo-media/)`);
    missing += 1;
    continue;
  }
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, readFileSync(local), { contentType, upsert: true });
  if (error) {
    console.error(`fail  ${file}: ${error.message}`);
    continue;
  }
  console.log(`up    ${file}`);
  sent += 1;
}

console.log(`\n${sent} uploaded, ${missing} missing.`);
if (missing) {
  console.log("Missing files leave broken thumbnails in the screenshots. Add them and re-run.");
}
