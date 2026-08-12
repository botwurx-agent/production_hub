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
  /** Where the document places each picture, in rendered page pixels. */
  images: Rect[];
  canvas: HTMLCanvasElement;
};

/** 2D affine matrices, in pdf.js order [a, b, c, d, e, f]. */
type Matrix = [number, number, number, number, number, number];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * Where every picture on the page was placed.
 *
 * A drawing operation paints the UNIT SQUARE and lets the current transform
 * decide where that lands, so the rectangle is not written down anywhere: it
 * has to be recovered by replaying the operator list and keeping the transform
 * stack, exactly as the renderer does. Cheap, because the operators are already
 * parsed by the time the page has been drawn.
 */
function placedImages(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  OPS: Record<string, number>,
  start: Matrix
): Rect[] {
  const out: Rect[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = start;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, ops.argsArray[i] as unknown as Matrix);
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageMaskXObject
    ) {
      // The four corners of the unit square, through the transform. Taking the
      // bounding box rather than the corners keeps a rotated picture whole.
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [ux, uy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        xs.push(ctm[0] * ux + ctm[2] * uy + ctm[4]);
        ys.push(ctm[1] * ux + ctm[3] * uy + ctm[5]);
      }
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      out.push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(Math.max(...xs) - x),
        h: Math.round(Math.max(...ys) - y),
      });
    }
  }
  return out;
}

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

    let images: Rect[] = [];
    try {
      const ops = await page.getOperatorList();
      images = placedImages(
        ops,
        lib.OPS as unknown as Record<string, number>,
        viewport.transform as Matrix
      );
    } catch {
      // A page whose operators will not replay still renders, and gutter
      // detection can still read it.
    }

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

    out.push({
      page: n,
      width: canvas.width,
      height: canvas.height,
      text,
      images,
      canvas,
    });
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
