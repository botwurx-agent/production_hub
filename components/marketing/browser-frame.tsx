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
  children,
}: {
  src?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
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
        <div className="grid aspect-[16/10] place-items-center bg-surface-2 px-6 text-center">
          <div>
            <p className="font-display text-sm font-semibold text-text-muted">
              Screenshot pending
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-faint">
              {alt}
            </p>
          </div>
        </div>
      )}
    </figure>
  );
}
