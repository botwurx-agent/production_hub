"use client";

/**
 * The result of reading a document with AI: what it filled in, and the
 * reminder to check it before saving.
 *
 * GREEN WHEN IT WORKED, AMBER ONLY WHEN IT DID NOT. It was amber in both
 * states, and the operator read a successful extraction as an error message,
 * which is fair: in this app amber is what every "someone owes you something"
 * signal wears (a cost over the agreed rate, an overdue payment, a crew member
 * who has not confirmed a call sheet). Spending the warning colour on a
 * success makes the warning mean less everywhere else. A document that could
 * not be read IS something the producer has to act on, so that keeps amber.
 *
 * THE WORDS ARE IN THE TEXT COLOUR, never the hue, and that is not a style
 * preference. Measured from the tokens: amber on amber-bg is 1.86:1 on light
 * and 1.78:1 on paper, green on green-bg is 2.43:1, all far below AA for body
 * type at this size. The hue is carried by the icon, the border and the tint
 * instead, which is the same conclusion the schedule's day-kind chips reached
 * after two attempts that failed the same way.
 *
 * THE ICON IS THE HUE MIXED TOWARD THE TEXT COLOUR, because the bare token has
 * that same problem: a thin 1.86:1 stroke on its own tint is a tick nobody can
 * see, which loses the signal this exists to give. 65% was measured in
 * Chromium across both hues and all three themes (worst case 3.34:1, clearing
 * the 3:1 bar for a meaningful graphic) and is the highest ratio that does, so
 * it keeps as much of the hue as it can. Mixing toward TEXT rather than a
 * fixed colour is what makes one value work in dark too, where the text is
 * near-white and the icon wants to be brighter rather than darker.
 */
export function ReadBanner({
  tone,
  title,
  children,
  onUndo,
}: {
  /** "ok" when fields were filled, "warn" when nothing could be read. */
  tone: "ok" | "warn";
  title: string;
  /** What to check, and anything the document kind is worth saying about. */
  children?: React.ReactNode;
  onUndo?: () => void;
}) {
  const hue = tone === "ok" ? "green" : "amber";
  return (
    <div
      className="mt-2 flex items-start gap-2 rounded-[10px] px-2.5 py-2 text-xs leading-relaxed text-text"
      style={{
        background: `var(--h-${hue}-bg)`,
        border: `1px solid var(--h-${hue})`,
      }}
    >
      <span
        className="mt-[1px] shrink-0"
        style={{ color: `color-mix(in oklab, var(--h-${hue}) 65%, var(--text))` }}
        aria-hidden
      >
        {tone === "ok" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
            <path d="m8 12.5 2.5 2.5L16 9.5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
            <path d="M12 7.5v5.5M12 16.5h.01" />
          </svg>
        )}
      </span>
      <div>
        <span className="font-semibold">{title}</span>
        {children ? <> {children}</> : null}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="ml-1 font-semibold underline"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
