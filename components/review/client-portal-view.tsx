import Link from "next/link";
import {
  STATE_HINT,
  STATE_LABEL,
  groupPortalItems,
  isOverdue,
  waitingSummary,
  type PortalItemState,
} from "@/lib/client-portal";
import type { PortalView, PortalItem } from "@/lib/client-portal-data";

const STATE_DOT: Record<PortalItemState, string> = {
  waiting: "var(--h-amber)",
  changes: "var(--h-blue)",
  approved: "var(--h-green)",
};

/** "Oct 12" from a YYYY-MM-DD read as a calendar day, so no timezone moves it. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The client portal, presentational and hook-free so the public page and a
 * fixture mount the same thing. The words stay in the text colour and each
 * state's hue rides on a dot, because the hue's own text on its tint is too
 * faint to read (measured on the read banner).
 */
export function ClientPortalView({
  view,
  todayIso,
  portalToken,
}: {
  view: PortalView;
  todayIso: string;
  /** Carried onto each item's link so its review can offer the way back. */
  portalToken: string;
}) {
  const groups = groupPortalItems(view.items);
  const summary = waitingSummary(view.items);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <div className="mb-6 flex items-center gap-3">
            {view.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.logoUrl}
                alt=""
                className="h-9 w-9 rounded-[10px] border border-border bg-surface object-contain"
              />
            ) : null}
            <span className="text-sm font-semibold text-text-muted">{view.studioName}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            {view.projectTitle}
          </h1>
          <p className="mt-2 text-[15px] text-text-muted">
            {view.clientName
              ? `For ${view.clientName}${/[.!?]$/.test(view.clientName) ? "" : "."} `
              : ""}
            Everything {view.studioName} has shared with you on this job, in one
            place.
          </p>
          {summary && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-text">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: STATE_DOT.waiting }}
              />
              {summary}
            </p>
          )}
        </header>

        {groups.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
            <p className="font-semibold text-text">Nothing has been shared yet</p>
            <p className="mt-1 text-sm text-text-muted">
              When {view.studioName} sends you something to review, it will
              appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((g) => (
              <section key={g.state}>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATE_DOT[g.state] }}
                  />
                  <h2 className="font-display text-lg font-bold text-text">
                    {STATE_LABEL[g.state]}
                  </h2>
                  <span className="text-sm font-semibold text-text-faint">
                    {g.items.length}
                  </span>
                </div>
                <p className="mb-4 text-sm text-text-muted">{STATE_HINT[g.state]}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((item) => (
                    <ItemCard
                      key={item.linkToken}
                      item={item}
                      todayIso={todayIso}
                      portalToken={portalToken}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-14 border-t border-border pt-5 text-center text-xs text-text-faint">
          Shared by {view.studioName}. No login needed: this link is yours, so
          please do not forward it.
        </footer>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  todayIso,
  portalToken,
}: {
  item: PortalItem;
  todayIso: string;
  portalToken: string;
}) {
  const overdue = isOverdue(item, todayIso);
  const due =
    item.state === "waiting" && item.dueDate
      ? overdue
        ? `Was due ${dayLabel(item.dueDate)}`
        : `Please respond by ${dayLabel(item.dueDate)}`
      : null;
  return (
    <Link
      href={`/r/${item.linkToken}?portal=${encodeURIComponent(portalToken)}`}
      className="group block overflow-hidden rounded-[15px] border border-border bg-surface shadow-sm transition hover:border-border-strong hover:shadow-md"
    >
      <div className="relative aspect-[16/10] bg-surface-2">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-text-faint">
            <Glyph kind={item.glyph} />
          </div>
        )}
        {item.versionLabel && (
          <span className="absolute bottom-2 left-2 rounded-[7px] bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {item.versionLabel}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="truncate font-semibold text-text">{item.title}</p>
        {item.kindLabel !== item.title && (
          <p className="mt-0.5 text-[13px] text-text-muted">{item.kindLabel}</p>
        )}
        {due && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-text">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: overdue ? "var(--h-red)" : "var(--h-amber)" }}
            />
            {due}
          </p>
        )}
        <p className="mt-3 text-[13px] font-semibold text-accent group-hover:underline">
          {item.state === "waiting" ? "Review" : "Open"}
        </p>
      </div>
    </Link>
  );
}

function Glyph({ kind }: { kind: PortalItem["glyph"] }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "video")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m10 9 5 3-5 3z" />
      </svg>
    );
  if (kind === "audio")
    return (
      <svg {...common}>
        <path d="M9 18V6l10-2v12" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </svg>
    );
  if (kind === "image")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m21 16-5-5-9 9" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}
