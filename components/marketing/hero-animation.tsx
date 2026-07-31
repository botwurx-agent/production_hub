/**
 * The moving hero: a client review round playing out on a loop.
 *
 * This is REAL UI, not a video. Every pin, comment, and chip is a DOM node
 * styled from the product's own tokens, animated by CSS in the marketing
 * stylesheet. A server component with no JS, no timers, and nothing to
 * hydrate, which is why it starts moving the instant the page paints.
 *
 * It shows the review loop specifically because that is the sharpest thing the
 * product does and the only one legible in a few seconds without narration: a
 * client drops pinned notes on a frame, the studio answers, the version turns
 * approved.
 */
export function HeroAnimation() {
  return (
    <div className="sf-scene" role="img" aria-label="A client review in progress: two pinned comments land on a frame and the version turns approved.">
      <div className="sf-plate" />

      {/* Pins on the frame */}
      <span className="sf-pin sf-pin-1" style={{ left: "22%", top: "34%" }}>
        1
      </span>
      <span className="sf-pin sf-pin-2" style={{ left: "46%", top: "62%" }}>
        2
      </span>

      {/* Comment rail */}
      <div className="absolute right-0 top-0 flex h-full w-[46%] flex-col gap-3 border-l border-border bg-surface p-4 sm:w-[38%]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[13px] font-bold text-text">
            Hero frame
          </span>
          <span className="sf-chip-stack">
            <span
              className="sf-chip-review rounded-pill px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--h-amber-bg)",
                color: "var(--h-amber)",
              }}
            >
              In review
            </span>
            <span
              className="sf-chip-approved rounded-pill px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--h-green-bg)",
                color: "var(--h-green)",
              }}
            >
              Approved
            </span>
          </span>
        </div>

        <div className="sf-note sf-note-1 p-3">
          <div className="flex items-center gap-2">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-fg)",
              }}
            >
              1
            </span>
            <span className="text-[11px] font-semibold text-text">Client</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
            Can we warm the label a touch? Feels cool against the fruit.
          </p>
        </div>

        <div className="sf-note sf-note-2 p-3">
          <div className="flex items-center gap-2">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-fg)",
              }}
            >
              2
            </span>
            <span className="text-[11px] font-semibold text-text">Client</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
            Bottle sits a little low in frame here.
          </p>
        </div>
      </div>

      {/* Approval toast */}
      <div className="sf-toast absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-md">
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M4 10.5 8 14l8-8"
            stroke="var(--h-green)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px] font-semibold text-text">
          Client approved v2
        </span>
      </div>
    </div>
  );
}
