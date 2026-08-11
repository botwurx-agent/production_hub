// pdf.js needs its worker as a plain file.
//
// Importing it with new URL(..., import.meta.url) makes webpack emit it as an
// asset, and Terser then fails on it: "'import' and 'export' cannot be used
// outside of module code". Copying it into public/ and pointing workerSrc at a
// path sidesteps the bundler entirely, and keeps it in step with whatever
// version package.json resolves, which a committed copy would not.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const from = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "build",
  "pdf.worker.min.mjs"
);
mkdirSync("public", { recursive: true });
copyFileSync(from, join("public", "pdf.worker.min.mjs"));
console.log("copied pdf.js worker to public/");
