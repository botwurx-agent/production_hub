"use client";

// Reading a PDF in the BROWSER.
//
// Deliberately not on the server. Rasterising a PDF server-side means either a
// native binary (awkward on Vercel) or a heavy pure-JS render inside a function
// with a memory and time limit, and the file would have to cross the ~4.5MB
// Server Action body to get there in the first place. The PDF is already on the
// producer's machine and every browser can already draw one, so the pages are
// rendered here and only the RESULTS travel: a few kilobytes of text, or a
// handful of downscaled page images.

import type { Rect } from "@/lib/panels";

export type PdfPage = {
  /** 1-based, matching how anybody refers to a page. */
  page: number;
  width: number;
  height: number;
  /** The text layer, empty on a scan or an image-only export. */
  text: string;
  canvas: HTMLCanvasElement;
};

type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Loaded on demand, not at page load. pdf.js is around a megabyte and most
 * sessions never import a document, so it has no business in the main bundle.
 */
async function pdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      // Served from public/, copied there by scripts/copy-pdf-worker.mjs at
      // build time. Importing it with new URL(..., import.meta.url) instead
      // makes webpack emit it as an asset and Terser then fails on it, since
      // it is module code. A same-origin path also keeps it inside the CSP.
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Enough resolution to crop a usable frame out of, without melting a laptop. */
const TARGET_WIDTH = 1600;
/** A board longer than this is almost certainly not what the operator meant. */
export const MAX_PAGES = 40;

export async function readPdf(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<PdfPage[]> {
  const lib = await pdfjs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  const total = Math.min(doc.numPages, MAX_PAGES);
  const out: PdfPage[] = [];

  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not render the PDF.");
    // White behind the page: a PDF's own background is transparent, and a
    // transparent "white" reads as black to the gutter detector.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    let text = "";
    try {
      const content = await page.getTextContent();
      text = content.items
        .map((i) => ("str" in i ? i.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      // A page with no text layer is normal, not an error.
    }

    out.push({ page: n, width: canvas.width, height: canvas.height, text, canvas });
    onProgress?.(n, total);
  }

  return out;
}

/** One byte per pixel, for the gutter scan in lib/panels. */
export function toGray(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context.");
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    // Luma. A blue pencil line and a black one should both read as content.
    data[p] = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
  }
  return { data, width, height };
}

/** Cut one panel out of a rendered page. */
export function cropToBlob(
  canvas: HTMLCanvasElement,
  rect: Rect,
  type = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w));
  out.height = Math.max(1, Math.round(rect.h));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No canvas context.");
  ctx.drawImage(
    canvas,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    out.width,
    out.height
  );
  return new Promise((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not read that panel."))),
      type,
      quality
    );
  });
}

/**
 * A page as a small JPEG, for the pages that have no text layer and have to be
 * READ rather than parsed. Downscaled hard: the model needs to see the words,
 * not the grain, and these cross a Server Action.
 */
export async function pageForReading(
  canvas: HTMLCanvasElement,
  maxWidth = 1100
): Promise<string> {
  const scale = Math.min(1, maxWidth / canvas.width);
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No canvas context.");
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.75).split(",")[1] ?? "";
}
