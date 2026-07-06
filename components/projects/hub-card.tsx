import Link from "next/link";
import type { ReactNode } from "react";

// A module card on the project hub: a colored icon tile (identity, not status),
// a title, a live-data body, and a clear entry point. Everything upfront and
// one click away.
export function HubCard({
  href,
  hue,
  icon,
  title,
  sub,
  footer,
  children,
  soon = false,
}: {
  href: string;
  hue: string;
  icon: ReactNode;
  title: string;
  sub?: string;
  footer?: ReactNode;
  children?: ReactNode;
  // Renders a visible-but-disabled card for a module that is not built yet, so
  // the intended structure is honest without shipping a dead link.
  soon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
          style={{
            backgroundColor: `var(--h-${hue}-bg)`,
            color: `var(--h-${hue})`,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-bold leading-tight text-text">
              {title}
            </span>
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Soon
            </span>
          </div>
          {sub && (
            <div className="truncate text-xs font-semibold text-text-faint">
              {sub}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 px-4 pb-4">{children}</div>
    </>
  );

  if (soon) {
    return (
      <div className="flex flex-col overflow-hidden rounded-[16px] border border-dashed border-border bg-surface/60 opacity-70">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
          style={{
            backgroundColor: `var(--h-${hue}-bg)`,
            color: `var(--h-${hue})`,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold leading-tight text-text">
            {title}
          </div>
          {sub && (
            <div className="truncate text-xs font-semibold text-text-faint">
              {sub}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">{children}</div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12.5px] font-semibold text-text-muted">
        <span className="truncate">{footer}</span>
        <span
          className="inline-flex shrink-0 items-center gap-1"
          style={{ color: `var(--h-${hue})` }}
        >
          Open
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// Small labelled band divider that groups modules by production phase.
export function BandLabel({ hue, label }: { hue: string; label: string }) {
  return (
    <div className="mb-3 mt-2 flex items-center gap-2.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: `var(--h-${hue})` }}
      />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
