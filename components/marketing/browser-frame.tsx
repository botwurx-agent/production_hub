import Image from "next/image";

/**
 * The elevated card every product shot sits on. Screenshots are the site's main
 * evidence, so they are never dropped flat onto the background.
 *
 * `src` is optional on purpose: until the staged demo job is captured, the
 * frame renders a labelled placeholder naming the shot that belongs here. That
 * keeps the layout honest (nobody mistakes it for a finished page) and turns
 * the swap into a one-prop change later.
 */
export function BrowserFrame({
  src,
  alt,
  caption,
  width = 1440,
  height = 900,
  priority = false,
  hue = "indigo",
  children,
}: {
  src?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  /** Tints the pending-screenshot placeholder to its section's identity hue. */
  hue?: string;
  /** Live UI rendered inside the frame, used instead of an image. */
  children?: React.ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
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
      ) : src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="h-auto w-full"
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
