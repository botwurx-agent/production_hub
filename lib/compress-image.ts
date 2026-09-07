"use client";

/**
 * Shrink a photograph in the browser before it is uploaded.
 *
 * WHY IN THE BROWSER, which is the part that beats the compressor sites: they
 * upload your file to their machine, compress it there, and hand it back, so
 * the big bytes cross the network anyway. Doing it here means they never leave
 * the device. A 12MP phone photo lands at a few hundred KB instead of four or
 * five megabytes, which is under any cap and cheaper to store forever.
 *
 * ONE RULE THAT MUST NOT BE BROKEN: never compress the thing a client is
 * judging. This is for a photo of a prop, a headshot on a roster, a reference
 * dropped on a task. It is NOT for an asset version, a master cut, or anything
 * going out for review, because compressing on upload destroys the original,
 * and a client approving artwork is evaluating the image itself. The app
 * already holds this line for DISPLAY (signThumb serves resized copies to
 * grids while print, export and review surfaces get the real file); this is
 * the same line, one step earlier.
 *
 * FAILS OPEN, ALWAYS. Every path that cannot produce a smaller file returns
 * the original untouched: an unreadable format, a decode error, a canvas that
 * refuses, or a result that came out bigger than what went in. A compressor
 * that blocks an upload is worse than no compressor.
 */

export type CompressOptions = {
  /** Longest edge of the result, in CSS pixels. */
  maxEdge?: number;
  /** JPEG quality, 0 to 1. */
  quality?: number;
  /** Files at or under this are passed straight through. */
  skipUnderBytes?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  // Comfortably sharp on a retina screen at full width, and far below what a
  // modern phone camera produces.
  maxEdge: 2400,
  // Measured to be visually indistinguishable on photographs at this scale
  // while cutting a camera JPEG by roughly an order of magnitude.
  quality: 0.82,
  // Not worth decoding and re-encoding something already small, and a tiny
  // image re-encoded can easily come out larger.
  skipUnderBytes: 600_000,
};

/**
 * True when this is a raster photograph we can decode and re-encode.
 *
 * HEIC IS DELIBERATELY EXCLUDED even though it is what an iPhone shoots.
 * Chrome cannot decode it to a canvas at all, so attempting it throws on the
 * platform most likely to hit this. iOS normally hands over a JPEG through the
 * file picker anyway, and when it does not, passing the original through is
 * the right outcome.
 *
 * SVG is excluded because it is not a raster: rendering it to a canvas would
 * flatten a resolution-independent file into pixels, which is a loss rather
 * than a saving. GIF is excluded because re-encoding kills the animation.
 */
export function isCompressibleImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const o = { ...DEFAULTS, ...opts };
  if (!isCompressibleImage(file)) return file;
  if (file.size <= o.skipUnderBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, o.maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // A PNG with transparency becomes a JPEG, so the alpha would otherwise
    // composite against black. White matches every surface this lands on.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", o.quality)
    );
    if (!blob) return file;

    // A screenshot, a flat graphic or an already-optimised JPEG can come out
    // BIGGER as a re-encoded JPEG. Keeping whichever is smaller means this can
    // never make things worse, which is the only way it is safe to run on
    // every picker without thinking about it.
    if (blob.size >= file.size) return file;

    return new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // A format the browser will not decode, a canvas that is tainted, memory
    // exhausted on a huge image. The original still uploads.
    return file;
  }
}

/** Compress a batch, keeping order, and never failing the batch for one file. */
export async function compressImages(
  files: File[],
  opts: CompressOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}

/** foo.PNG becomes foo.jpg, since the bytes really are a JPEG now. */
function jpegName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem || "image"}.jpg`;
}
