import fs from "node:fs";
import path from "node:path";

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
 * reason this is not a client component.
 */
export function Shot({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  const exists = fs.existsSync(path.join(process.cwd(), "public", src));

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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      className={`h-auto w-full rounded-[14px] border border-border bg-surface ${className}`}
    />
  );
}
