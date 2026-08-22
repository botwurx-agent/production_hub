import { Shot } from "@/components/marketing/shot";

/**
 * The elevated card every product shot sits on. Screenshots are the site's main
 * evidence, so they are never dropped flat onto the background.
 *
 * The image itself is delegated to <Shot>, which checks on the server whether
 * the PNG has been captured yet and renders a labelled placeholder when it has
 * not. That keeps ONE answer to "is this screenshot taken", shared with
 * scripts/capture-shots.mjs, instead of this component growing a second copy of
 * the same check. Run `npm run shots` and every frame fills itself in.
 *
 * `children` is for a frame whose contents are live UI rather than an image.
 */
export function BrowserFrame({
  shot,
  alt,
  caption,
  width = 1600,
  height = 1000,
  priority = false,
  sizes,
  motion = "reveal",
  hue = "indigo",
  children,
}: {
  /** Basename in public/marketing/shots, without the extension. */
  shot?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  /**
   * How wide the shot renders. The default suits a frame sharing a row with
   * copy; a full-width frame has to say so or the browser fetches a candidate
   * sized for half the page and it looks soft.
   */
  sizes?: string;
  /**
   * How the frame arrives. "reveal" settles it as it scrolls into view;
   * "settle" plays the same move once on load, for a frame already on screen
   * when the page opens; "none" opts out. See marketing.css.
   */
  motion?: "reveal" | "settle" | "none";
  /** Tints the pending-screenshot placeholder to its section's identity hue. */
  hue?: string;
  children?: React.ReactNode;
}) {
  const move =
    motion === "reveal"
      ? "sf-reveal"
      : motion === "settle"
        ? "sf-settle-once"
        : "";
  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-lg ${move}`}
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        {caption ? (
          <span className="ml-3 truncate text-xs text-text-faint">{caption}</span>
        ) : null}
      </div>

      {children ? (
        children
      ) : shot ? (
        <Shot
          src={`/marketing/shots/${shot}.png`}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="border-0"
        />
      ) : (
        <div
          className="grid aspect-[16/10] place-items-center px-8 text-center"
          style={{
            background: `linear-gradient(135deg, var(--h-${hue}-bg) 0%, var(--surface-2) 55%, var(--surface) 100%)`,
          }}
        >
          <div>
            <p
              className="font-display text-sm font-bold"
              style={{ color: `var(--h-${hue})` }}
            >
              Screenshot pending
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              {alt}
            </p>
          </div>
        </div>
      )}
    </figure>
  );
}
