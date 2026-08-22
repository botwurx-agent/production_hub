import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Width and height straight out of a PNG's IHDR chunk.
 *
 * A PNG opens with an 8-byte signature, then that chunk's 4-byte length and
 * 4-byte "IHDR" type, so the dimensions are always at bytes 16 and 20. Read via
 * a file descriptor rather than readFileSync because these screenshots run to
 * megabytes and only the first 24 bytes are wanted.
 *
 * Returns null for anything that is not a PNG, which is the caller's cue to
 * fall back to the declared size rather than fail.
 */
function pngSize(file: string): { width: number; height: number } | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(24);
    if (fs.readSync(fd, head, 0, 24, 0) < 24) return null;
    if (head.toString("ascii", 12, 16) !== "IHDR") return null;
    const width = head.readUInt32BE(16);
    const height = head.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

/**
 * A product screenshot slot.
 *
 * The marketing site only ever shows real screens, captured by
 * scripts/capture-shots.mjs into public/marketing/shots. Until an image is
 * there, this renders a labelled placeholder at the exact aspect ratio rather
 * than a broken image, so the page can be designed and reviewed before the
 * captures exist, and so a missing shot is obvious instead of silent.
 *
 * The existence check runs on the server at render time, which is the whole
 * reason this is not a client component. Reading the real pixel dimensions
 * comes free off the back of it.
 *
 * WHY next/image RATHER THAN A PLAIN <img>: a retina screenshot of a full app
 * window is around 3000px wide and displays at 700, so a raw <img> ships four
 * times the pixels anyone can see. Five of them came to 5.1MB. next/image
 * serves a right-sized AVIF or WebP instead, which matters more here than
 * anywhere else in the app because this is the page strangers load first, on
 * whatever connection they happen to be on.
 *
 * The `width`/`height` PROPS are only a fallback now. They describe the slot
 * the designer had in mind, and drifted from the real files (1600x1000 declared
 * against 3008x1704 actual). The file itself is the authority: a wrong ratio
 * fed to next/image reserves the wrong space and shifts the layout as each
 * image lands.
 */
export function Shot({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(min-width: 1024px) 720px, 100vw",
  className = "",
}: {
  src: string;
  alt: string;
  /** Fallback dimensions, used only when the real ones cannot be read. */
  width: number;
  height: number;
  priority?: boolean;
  /**
   * How wide this shot actually renders, so the browser can pick a candidate
   * instead of assuming full viewport width. Getting this wrong costs
   * bandwidth silently, which is the whole thing being fixed here.
   */
  sizes?: string;
  className?: string;
}) {
  const file = path.join(process.cwd(), "public", src);
  const exists = fs.existsSync(file);

  if (!exists) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border-strong bg-surface-2 p-6 text-center ${className}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <span className="font-display text-sm font-bold text-text-muted">
          {alt}
        </span>
        <span className="font-mono text-[11px] text-text-faint">
          {src.replace("/marketing/shots/", "")} &middot; {width}&times;{height}
        </span>
      </div>
    );
  }

  const real = pngSize(file) ?? { width, height };

  return (
    <Image
      src={src}
      alt={alt}
      width={real.width}
      height={real.height}
      sizes={sizes}
      priority={priority}
      className={`h-auto w-full rounded-[14px] border border-border bg-surface ${className}`}
    />
  );
}
