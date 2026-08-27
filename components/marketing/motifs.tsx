import type { ReactNode } from "react";

/**
 * Per-page motifs: the feature behaving, drawn in tokens.
 *
 * Every feature page gets one bespoke visual built from the product's own
 * vocabulary (chips, cards, pins, bars) instead of decorative shapes. The rule
 * that keeps them honest: a motif is clearly an ILLUSTRATION, small pieces of
 * UI floating on a stage, never a fake screenshot. Real screenshots stay the
 * only thing rendered inside a browser frame.
 *
 * Server components, CSS only, token-first throughout: they follow the theme
 * and cost no JavaScript. On pages that have a real shot, the motif carries
 * the differentiator band; on pages that do not have one yet, it carries the
 * hero, which beats a tinted "screenshot pending" card by a mile.
 */

function hueVar(hue: string) {
  return {
    "--m": `var(--h-${hue})`,
    "--m-bg": `var(--h-${hue}-bg)`,
  } as React.CSSProperties;
}

/** The floor every motif stands on. */
function Stage({
  hue,
  children,
  label,
}: {
  hue: string;
  children: ReactNode;
  /** Says what the drawing shows, for the caption and screen readers. */
  label: string;
}) {
  return (
    <figure
      style={hueVar(hue)}
      className="relative overflow-clip rounded-2xl border border-border bg-surface p-8 shadow-lg sm:p-10"
    >
      {/* A quiet identity wash in the corner, not a paint bucket. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, var(--m-bg), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/* Small shared vocabulary ------------------------------------------------- */

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A greeked line of "text": communicates writing without pretending to be copy. */
function Greek({ w, className = "" }: { w: string; className?: string }) {
  return <span className={`block h-2 rounded-full bg-surface-2 ${className}`} style={{ width: w }} aria-hidden="true" />;
}

function StatusChip({
  tone,
  children,
}: {
  tone: "green" | "amber" | "faint";
  children: ReactNode;
}) {
  const style =
    tone === "faint"
      ? { backgroundColor: "var(--surface-2)", color: "var(--text-faint)" }
      : {
          backgroundColor: `var(--h-${tone}-bg)`,
          color: `var(--h-${tone})`,
        };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold"
      style={style}
    >
      {children}
    </span>
  );
}

/* The motifs -------------------------------------------------------------- */

function CallSheetMotif() {
  const rows: { name: string; tone: "green" | "amber" | "faint"; label: string }[] = [
    { name: "M. Okafor · Gaffer", tone: "green", label: "Confirmed" },
    { name: "J. Reyes · 1st AD", tone: "green", label: "Confirmed" },
    { name: "S. Lindqvist · DP", tone: "amber", label: "Viewed" },
    { name: "T. Marsh · Sound", tone: "faint", label: "Sent" },
  ];
  return (
    <Stage hue="amber" label="Call sheet recipients moving from sent to viewed to confirmed.">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-sm font-extrabold text-text">Day 1 · General call 07:00</span>
        <StatusChip tone="green"><Tick /> 2 of 4 confirmed</StatusChip>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-[10px] border border-border bg-bg px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-text">{r.name}</span>
            <StatusChip tone={r.tone}>
              {r.tone === "green" ? <Tick /> : null}
              {r.label}
            </StatusChip>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] font-medium text-text-faint">
        Unconfirmed crew are nudged automatically as the day gets close.
      </p>
    </Stage>
  );
}

function ShotListMotif() {
  return (
    <Stage hue="blue" label="One shot list row: frame, code, description, size and movement.">
      <div className="flex items-start gap-4 rounded-[12px] border border-border bg-bg p-4">
        <div
          className="grid h-20 w-28 shrink-0 place-items-center rounded-[8px] text-[11px] font-bold"
          style={{ backgroundColor: "var(--m-bg)", color: "var(--m)" }}
        >
          1B
        </div>
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          <Greek w="88%" />
          <Greek w="64%" />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Close-up", "Low angle", "Push in", "Day 1"].map((c) => (
              <span key={c} className="rounded-pill border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-text-faint">
        <Tick className="text-[color:var(--m)]" />
        Frame matched from the storyboard by its printed number
      </div>
    </Stage>
  );
}

function StoryboardMotif() {
  const frames = [
    { label: "16:9", ratio: "16 / 9" },
    { label: "1:1", ratio: "1 / 1" },
    { label: "4:5", ratio: "4 / 5" },
  ];
  return (
    <Stage hue="purple" label="Storyboard frames drawn in three different aspect ratios, none cropped.">
      <div className="flex items-end justify-center gap-4">
        {frames.map((f) => (
          <div key={f.label} className="w-full max-w-[150px]">
            <div
              className="relative w-full overflow-clip rounded-[10px] border border-border"
              style={{
                aspectRatio: f.ratio,
                background: "linear-gradient(160deg, var(--m-bg), var(--surface-2))",
              }}
            >
              <span
                className="absolute left-1.5 top-1.5 rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "var(--surface)", color: "var(--m)" }}
              >
                {f.label}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <Greek w="90%" />
              <Greek w="60%" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-[12px] font-medium text-text-faint">
        Every board keeps the shape it was drawn in.
      </p>
    </Stage>
  );
}

function MoodboardMotif() {
  return (
    <Stage hue="pink" label="Moodboard cards connected by an arrow, with a note card.">
      <div className="relative mx-auto h-56 max-w-md">
        <div
          className="absolute left-0 top-2 h-32 w-40 -rotate-3 rounded-[12px] border border-border shadow-md"
          style={{ background: "linear-gradient(150deg, var(--m-bg), var(--surface-2))" }}
        />
        <div
          className="absolute right-2 top-12 h-32 w-40 rotate-2 rounded-[12px] border border-border shadow-md"
          style={{ background: "linear-gradient(200deg, var(--h-cyan-bg), var(--surface-2))" }}
        />
        {/* The connection: the product's own arrow, not decoration. */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 224" fill="none" aria-hidden="true">
          <path
            d="M165 60 C 210 40, 230 60, 252 78"
            stroke="var(--m)"
            strokeWidth="2"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
          <path d="M244 66 l10 11 -15 2z" fill="var(--m)" />
        </svg>
        <div className="absolute bottom-0 left-10 w-44 rounded-[12px] border border-border bg-bg p-3 shadow-md">
          <p className="text-[12px] font-bold text-text">Warm haze, hard rim</p>
          <div className="mt-2 space-y-1.5">
            <Greek w="92%" />
            <Greek w="70%" />
          </div>
        </div>
      </div>
    </Stage>
  );
}

function ReviewMotif() {
  return (
    <Stage hue="green" label="A frame with a numbered comment pin, drawn markup, and a timecode comment.">
      <div
        className="relative w-full overflow-clip rounded-[12px] border border-border"
        style={{ aspectRatio: "16 / 9", background: "linear-gradient(135deg, var(--surface-2), var(--m-bg))" }}
      >
        {/* The drawn circle a client makes when words are slower. */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" fill="none" aria-hidden="true">
          <ellipse cx="216" cy="76" rx="42" ry="30" stroke="var(--h-red)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="180 40" transform="rotate(-6 216 76)" />
        </svg>
        <span
          className="absolute left-[28%] top-[54%] grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold shadow-md"
          style={{ backgroundColor: "var(--m)", color: "var(--accent-fg)" }}
        >
          1
        </span>
        <span className="absolute bottom-2 right-2 rounded-[6px] bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
          00:00:12:08
        </span>
      </div>
      <div className="mt-3 flex items-start gap-2.5 rounded-[10px] border border-border bg-bg p-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--m-bg)", color: "var(--m)" }}>
          D
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-text">
            Logo drifts here. Can it hold to the safe area?
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-text-faint">Dana · pinned at 12:08 · no login</p>
        </div>
      </div>
    </Stage>
  );
}

function CommunicationMotif() {
  const sources = [
    { name: "Gmail thread", hue: "red" },
    { name: "Slack channel", hue: "purple" },
    { name: "Chat space", hue: "green" },
  ];
  return (
    <Stage hue="cyan" label="Three conversations from different tools filing into one project.">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex w-full flex-col gap-2">
          {sources.map((s) => (
            <div key={s.name} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-bg px-3.5 py-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${s.hue})` }} />
              <span className="text-[13px] font-semibold text-text">{s.name}</span>
              <span className="ml-auto rounded-pill px-1.5 text-[11px] font-bold" style={{ backgroundColor: "var(--m-bg)", color: "var(--m)" }}>
                2
              </span>
            </div>
          ))}
        </div>
        <svg width="20" height="26" viewBox="0 0 20 26" fill="none" aria-hidden="true">
          <path d="M10 2v18M4 15l6 6 6-6" stroke="var(--m)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="w-full rounded-[12px] border-2 bg-bg px-4 py-3 text-center" style={{ borderColor: "var(--m)" }}>
          <p className="font-display text-sm font-extrabold text-text">Bright Water · Communication</p>
          <p className="text-[11.5px] font-medium text-text-faint">Read and reply from the job. Nothing moves.</p>
        </div>
      </div>
    </Stage>
  );
}

function BudgetMotif() {
  return (
    <Stage hue="blue" label="A budget line's bid and actual bars, with the invoice attached to the cost.">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <span>Camera package</span>
            <span>Bid $6,500</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-2" />
          <div className="-mt-2.5 h-2.5 w-[72%] rounded-full" style={{ backgroundColor: "var(--m)" }} />
          <div className="mt-1.5 text-right text-[11px] font-semibold" style={{ color: "var(--m)" }}>
            Actual $4,680
          </div>
        </div>
        <div className="flex items-center justify-between rounded-[10px] border border-border bg-bg px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" aria-hidden="true">
              <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="text-[12.5px] font-semibold text-text">rental_invoice_0142.pdf</span>
          </div>
          <StatusChip tone="green"><Tick /> Paid</StatusChip>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Margin on the job</span>
          <span className="font-display text-lg font-extrabold" style={{ color: "var(--h-green)" }}>
            31%
          </span>
        </div>
      </div>
    </Stage>
  );
}

function InvoicingMotif() {
  const docs = [
    { code: "EST-1042", label: "Sent", tone: "faint" as const },
    { code: "PROP-1042", label: "Signed", tone: "green" as const },
    { code: "INV-1042", label: "Paid", tone: "green" as const },
  ];
  return (
    <Stage hue="green" label="An estimate, a signed proposal, and a paid invoice, in order.">
      <div className="flex items-stretch justify-center gap-2 sm:gap-3">
        {docs.map((d, i) => (
          <div key={d.code} className="flex items-center gap-2 sm:gap-3">
            <div className="w-[104px] rounded-[10px] border border-border bg-bg p-3 shadow-sm sm:w-[118px]">
              <p className="font-mono text-[11px] font-bold text-text">{d.code}</p>
              <div className="mt-2 space-y-1.5">
                <Greek w="100%" />
                <Greek w="70%" />
              </div>
              {d.code === "PROP-1042" ? (
                // The signature: the one document that carries one.
                <svg className="mt-2" width="64" height="16" viewBox="0 0 64 16" fill="none" aria-hidden="true">
                  <path d="M2 12 C 10 2, 16 14, 24 8 S 40 2, 46 9 S 58 12, 62 6" stroke="var(--m)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <div className="mt-2 h-4" />
              )}
              <div className="mt-1.5">
                <StatusChip tone={d.tone}>{d.tone === "green" ? <Tick /> : null}{d.label}</StatusChip>
              </div>
            </div>
            {i < docs.length - 1 ? (
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none" className="shrink-0" aria-hidden="true">
                <path d="M1 7h13M9.5 2.5 14 7l-4.5 4.5" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] font-medium text-text-faint">
        Signed online, audit trail attached, frozen once accepted.
      </p>
    </Stage>
  );
}

function TasksMotif() {
  return (
    <Stage hue="purple" label="A task board with a Waiting column, one card mid-drag toward Done.">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { name: "In progress", cards: 2 },
          { name: "Waiting", cards: 0 },
          { name: "Done", cards: 1 },
        ].map((col) => (
          <div key={col.name} className="rounded-[10px] bg-surface-2 p-2">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">{col.name}</p>
            {col.name === "Waiting" ? (
              <div className="rounded-[8px] border-2 bg-bg p-2 shadow-md" style={{ borderColor: "var(--m)" }}>
                <p className="text-[11px] font-bold leading-tight text-text">Location hold: rooftop</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <StatusChip tone="amber">With the client</StatusChip>
                </div>
              </div>
            ) : (
              Array.from({ length: col.cards }).map((_, i) => (
                <div key={i} className="mb-2 space-y-1.5 rounded-[8px] border border-border bg-bg p-2 last:mb-0">
                  <Greek w="85%" />
                  <div className="flex items-center gap-1">
                    {col.name === "Done" ? <Tick className="text-[color:var(--h-green)]" /> : null}
                    <Greek w="45%" />
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] font-medium text-text-faint">
        Waiting is a real answer: half of production is somebody else's move.
      </p>
    </Stage>
  );
}

function CrewMotif() {
  return (
    <Stage hue="orange" label="A roster card for a talent contact, with the rate marked staff-only.">
      <div className="mb-3 flex gap-1.5">
        {["Crew", "Talent", "Vendors"].map((tab, i) => (
          <span
            key={tab}
            className="rounded-pill px-2.5 py-1 text-[11px] font-bold"
            style={
              i === 1
                ? { backgroundColor: "var(--m-bg)", color: "var(--m)" }
                : { backgroundColor: "var(--surface-2)", color: "var(--text-faint)" }
            }
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="overflow-clip rounded-[12px] border border-border bg-bg">
        <div className="h-1" style={{ backgroundColor: "var(--m)" }} />
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: "var(--m-bg)", color: "var(--m)" }}>
            AK
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text">Amara Khan</p>
            <p className="text-[12px] font-medium text-text-muted">Lead talent · CAA</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusChip tone="amber">Allergy: shellfish</StatusChip>
              <span className="rounded-pill border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted">Wardrobe on file</span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-[7px] bg-surface-2 px-2 py-1 text-[10.5px] font-bold text-text-faint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Rate: staff only
          </span>
        </div>
      </div>
    </Stage>
  );
}

function AiMotif() {
  const takes: ("x" | "keep" | "star" | "pick" | "x2")[] = ["x", "keep", "star", "pick", "x2"];
  return (
    <Stage hue="purple" label="Five generated takes in triage: two rejected, one starred, one picked.">
      <div className="flex justify-center gap-2">
        {takes.map((t, i) => (
          <div
            key={i}
            className={`relative h-16 w-24 overflow-clip rounded-[8px] border ${
              t === "x" || t === "x2" ? "opacity-40" : ""
            }`}
            style={{
              borderColor: t === "pick" ? "var(--m)" : "var(--border)",
              borderWidth: t === "pick" ? 2 : 1,
              background: `linear-gradient(${120 + i * 30}deg, var(--m-bg), var(--surface-2))`,
            }}
          >
            {(t === "x" || t === "x2") && (
              <span className="absolute right-1 top-1 text-[10px] font-bold text-text-faint">✕</span>
            )}
            {t === "star" && (
              <span className="absolute right-1 top-1 text-[11px]" style={{ color: "var(--h-amber)" }}>★</span>
            )}
            {t === "pick" && (
              <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full" style={{ backgroundColor: "var(--m)", color: "var(--accent-fg)" }}>
                <Tick />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-4 w-fit rounded-[8px] border border-border bg-bg px-3 py-1.5 font-mono text-[10.5px] font-semibold text-text-muted">
        kling 2.1 · seed 48213 · 1080p · 5.0s · from @maya + LK-01
      </div>
      <p className="mt-3 text-center text-[12px] font-medium text-text-faint">
        Keyboard-first triage; provenance rides on every take.
      </p>
    </Stage>
  );
}

function RunnerMotif() {
  return (
    <Stage hue="cyan" label="A chat request becoming a proposal card with Create and Cancel.">
      <div className="mx-auto max-w-sm space-y-3">
        <div className="ml-auto w-fit max-w-[85%] rounded-[14px] rounded-br-[4px] px-3.5 py-2 text-[13px] font-medium" style={{ backgroundColor: "var(--m-bg)", color: "var(--text)" }}>
          Log the $1,200 camera rental against Bright Water
        </div>
        <div className="rounded-[12px] border border-border bg-bg p-3.5 shadow-sm">
          <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Proposed cost · nothing saved yet</p>
          {[
            ["Project", "Bright Water"],
            ["Vendor", "Northside Rentals"],
            ["Amount", "$1,200.00"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border py-1.5 text-[12.5px] last:border-0">
              <span className="font-medium text-text-faint">{k}</span>
              <span className="font-semibold text-text">{v}</span>
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <span className="rounded-pill px-3.5 py-1.5 text-[12px] font-bold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}>
              Create
            </span>
            <span className="rounded-pill border border-border px-3.5 py-1.5 text-[12px] font-bold text-text-muted">
              Cancel
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function HubMotif() {
  const stages = ["Pre-pro", "Shoot", "Post", "Delivered"];
  return (
    <Stage hue="indigo" label="A job's lifecycle stepper with the second stage active.">
      <div className="flex items-center justify-center gap-1.5">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="rounded-pill px-3 py-1.5 text-[12px] font-bold"
              style={
                i === 1
                  ? { backgroundColor: "var(--m)", color: "var(--accent-fg)" }
                  : i < 1
                    ? { backgroundColor: "var(--m-bg)", color: "var(--m)" }
                    : { backgroundColor: "var(--surface-2)", color: "var(--text-faint)" }
              }
            >
              {s}
            </span>
            {i < stages.length - 1 ? <span className="h-px w-3 bg-border-strong" /> : null}
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {[
          ["Brief", "indigo"],
          ["Review", "green"],
          ["Call sheet", "amber"],
          ["Budget", "blue"],
        ].map(([name, hue]) => (
          <div key={name} className="flex items-center gap-2 rounded-[10px] border border-border bg-bg px-3 py-2.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${hue})` }} />
            <span className="text-[12.5px] font-semibold text-text">{name}</span>
            <Greek w="30%" className="ml-auto" />
          </div>
        ))}
      </div>
    </Stage>
  );
}

/** One motif per feature page, keyed by slug. */
const MOTIFS: Record<string, () => ReactNode> = {
  "production-hub": HubMotif,
  "production-task-management": TasksMotif,
  "storyboard-software": StoryboardMotif,
  "shot-list-software": ShotListMotif,
  "moodboard-maker": MoodboardMotif,
  "video-review-software": ReviewMotif,
  "production-communication": CommunicationMotif,
  "call-sheet-software": CallSheetMotif,
  "crew-management-software": CrewMotif,
  "production-budgeting-software": BudgetMotif,
  "production-invoicing": InvoicingMotif,
  "ai-video-production": AiMotif,
  runner: RunnerMotif,
};

export function Motif({ slug }: { slug: string }) {
  const M = MOTIFS[slug];
  return M ? <>{M()}</> : null;
}
