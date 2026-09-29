"use client";

import { Burst, Chip, Cursor, Window, arrive, easeInOut, easeOut, lerp, ramp, spring, typed } from "./scene-kit";

/*
 * Moodboard (a fourth hero tab) and the AI pipeline (a stack panel). Same
 * contract as the other scene files: a 640x440 drawing, a pure function of t.
 */

/* --------------------------------------------------------------- MOODBOARD */

export const MOOD_MS = 8600;

const IMAGES = [
  { x: 84, y: 112, w: 150, h: 104, at: 600, rot: -2, a: "amber", b: "orange" },
  { x: 250, y: 100, w: 118, h: 140, at: 900, rot: 1.5, a: "blue", b: "indigo" },
  { x: 386, y: 116, w: 156, h: 100, at: 1200, rot: -1, a: "cyan", b: "blue" },
];
const SWATCHES = ["amber", "orange", "cyan", "indigo"];
const DRAG_FROM = { x: 32, y: 104 };
const NOTE = { x: 392, y: 262, w: 190, h: 84 };
const DRAG_AT = 2600;
const DROP_AT = 3400;
const LINK_AT = 5000;
const CONNECT_AT = 5700;
const SHARE_AT = 7000;
const NOTE_TEXT = "Warm morning light. Nothing staged, nothing glossy.";

export function MoodboardScene({ t }: { t: number }) {
  const drag = easeInOut(ramp(t, DRAG_AT + 200, DROP_AT - DRAG_AT - 200));
  const noteX = lerp(DRAG_FROM.x, NOTE.x, drag);
  const noteY = lerp(DRAG_FROM.y - 20, NOTE.y, drag);
  const lifted = t >= DRAG_AT && t < DROP_AT + 120;
  const line = easeOut(ramp(t, CONNECT_AT, 600));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Moodboard · Bright Water"
        sub="Look and feel for the hero spot"
        right={
          t >= SHARE_AT ? (
            <Chip tone="green" t={t} since={SHARE_AT}>Shared with client</Chip>
          ) : (
            <span className="rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: "var(--accent)", transform: `scale(${t >= SHARE_AT - 80 && t < SHARE_AT + 120 ? 0.92 : 1})` }}>
              Share for review
            </span>
          )
        }
      >
        {/* The canvas, with its dot grid */}
        <div
          className="absolute"
          style={{
            left: 60,
            top: 52,
            width: 580,
            height: 388,
            backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1.2px)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* Tool rail */}
        <div className="absolute flex flex-col items-center gap-2 border-r border-border bg-surface py-3" style={{ left: 0, top: 52, width: 60, height: 388 }}>
          {[
            ["Note", "M5 4h14v16H5z M8 9h8 M8 13h6"],
            ["To-do", "M5 6l2 2 3-3 M12 7h7 M5 13l2 2 3-3 M12 14h7"],
            ["Link", "M10 14a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1 M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6-6l1-1"],
            ["Upload", "M12 16V5 M7 10l5-5 5 5 M5 19h14"],
            ["Line", "M5 19L19 5 M13 5h6v6"],
          ].map(([k, d], i) => (
            <span
              key={k}
              className="grid h-9 w-9 place-items-center rounded-[9px]"
              style={{
                background: i === 0 && t >= DRAG_AT - 300 && t < DROP_AT ? "var(--accent-soft)" : "transparent",
                color: i === 0 && t >= DRAG_AT - 300 && t < DROP_AT ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </span>
          ))}
        </div>

        {/* Heading */}
        <p className="absolute font-display text-[20px] font-extrabold" style={{ left: 84, top: 70, ...arrive(t, 250, 8) }}>
          Look &amp; feel
        </p>

        {/* Images arriving */}
        {IMAGES.map((im, i) => {
          const s = spring(ramp(t, im.at, 520));
          if (s <= 0) return null;
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-[10px] border border-border shadow-[0_10px_24px_-12px_rgba(40,30,90,.45)]"
              style={{
                left: im.x,
                top: im.y,
                width: im.w,
                height: im.h,
                transform: `translateY(${(1 - s) * -30}px) rotate(${im.rot}deg) scale(${0.85 + 0.15 * s})`,
                opacity: Math.min(1, s * 1.5),
                background: `linear-gradient(150deg, var(--h-${im.a}-bg) 0%, color-mix(in oklch, var(--h-${im.b}) 45%, var(--h-${im.a}-bg)) 100%)`,
              }}
            >
              <svg viewBox="0 0 150 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {i === 0 ? (
                  <>
                    <circle cx="118" cy="26" r="14" fill="var(--h-yellow)" opacity=".7" />
                    <rect x="0" y="70" width="150" height="30" fill="var(--h-orange)" opacity=".35" />
                    <rect x="22" y="44" width="30" height="26" rx="3" fill="var(--surface)" opacity=".8" />
                  </>
                ) : i === 1 ? (
                  <>
                    <rect x="62" y="16" width="26" height="10" rx="3" fill="var(--h-indigo)" />
                    <path d="M58 26 h34 q8 10 8 22 v44 h-50 v-44 q0 -12 8 -22z" fill="var(--h-blue)" opacity=".85" />
                    <rect x="56" y="50" width="38" height="20" rx="3" fill="var(--surface)" />
                  </>
                ) : (
                  <>
                    {[
                      [60, 50, 16],
                      [96, 34, 9],
                      [36, 30, 7],
                      [112, 66, 6],
                    ].map(([cx, cy, r], k) => (
                      <circle key={k} cx={cx} cy={cy} r={r} fill="var(--h-cyan)" opacity={0.75 - k * 0.12} />
                    ))}
                  </>
                )}
              </svg>
            </div>
          );
        })}

        {/* Colour swatches */}
        <div className="absolute flex gap-2" style={{ left: 84, top: 244 }}>
          {SWATCHES.map((h, i) => (
            <span
              key={h}
              className="h-9 w-9 rounded-full border-2 border-surface shadow-[0_6px_14px_-6px_rgba(40,30,90,.5)]"
              style={{ background: `var(--h-${h})`, transform: `scale(${spring(ramp(t, 1800 + i * 150, 420))})` }}
            />
          ))}
        </div>

        {/* Link card, unfurled from a pasted URL */}
        {t >= LINK_AT ? (
          <div className="absolute w-[160px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_10px_24px_-12px_rgba(40,30,90,.45)]" style={{ left: 84, top: 300, ...arrive(t, LINK_AT, 14) }}>
            <div className="h-[46px]" style={{ background: "linear-gradient(135deg, var(--h-amber-bg), var(--h-pink-bg))" }} />
            <div className="px-2 py-1.5">
              <p className="truncate text-[11px] font-bold">Kitchen light references</p>
              <p className="truncate text-[9.5px] text-text-faint">pinterest.com</p>
            </div>
          </div>
        ) : null}

        {/* The connection from the note to the splash */}
        {t >= CONNECT_AT ? (
          <svg className="pointer-events-none absolute left-0 top-0" width="640" height="440" aria-hidden="true">
            <defs>
              <marker id="mb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
              </marker>
            </defs>
            <path
              d={`M${NOTE.x + NOTE.w / 2} ${NOTE.y} C ${NOTE.x + NOTE.w / 2} 238, 466 250, 464 222`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - line}
              markerEnd={line > 0.95 ? "url(#mb-arrow)" : undefined}
            />
          </svg>
        ) : null}

        {/* The note, dragged off the rail and typed into */}
        {t >= DRAG_AT ? (
          <div
            className="absolute rounded-[10px] border p-2.5"
            style={{
              left: noteX,
              top: noteY,
              width: NOTE.w,
              height: NOTE.h,
              background: "var(--h-yellow-bg)",
              borderColor: t >= DROP_AT && t < CONNECT_AT + 800 ? "var(--accent)" : "var(--border)",
              boxShadow: lifted ? "0 22px 40px -16px rgba(40,30,90,.55)" : "0 8px 20px -12px rgba(40,30,90,.4)",
              transform: `scale(${lifted ? 1.04 : 1}) rotate(${lifted ? -1.5 : 0}deg)`,
              transition: "transform .2s, box-shadow .2s",
              opacity: ramp(t, DRAG_AT, 150),
            }}
          >
            <p className="text-[12px] font-semibold leading-snug">
              {typed(NOTE_TEXT, t, DROP_AT + 200, 26)}
              {t >= DROP_AT + 200 && t < DROP_AT + 200 + NOTE_TEXT.length * 26 ? (
                <span className="ml-px inline-block h-3 w-[1.5px] align-[-1px]" style={{ background: "var(--accent)" }} />
              ) : null}
            </p>
            {t >= DROP_AT && t < CONNECT_AT + 700 ? (
              <span className="absolute h-3.5 w-3.5 rounded-full border-2 border-surface" style={{ left: NOTE.w / 2 - 7, top: -8, background: "var(--accent)" }} />
            ) : null}
          </div>
        ) : null}
        <Burst t={t} at={SHARE_AT} x={570} y={26} />
      </Window>
      <Cursor
        t={t}
        path={[
          { t: 2000, x: 200, y: 360 },
          { t: DRAG_AT, x: DRAG_FROM.x + 2, y: DRAG_FROM.y + 2, click: true },
          { t: DRAG_AT + 200, x: DRAG_FROM.x + 2, y: DRAG_FROM.y + 2 },
          { t: DROP_AT, x: NOTE.x + 60, y: NOTE.y + 40 },
          { t: CONNECT_AT - 200, x: NOTE.x + NOTE.w / 2, y: NOTE.y, click: true },
          { t: CONNECT_AT + 600, x: 464, y: 224 },
          { t: SHARE_AT, x: 560, y: 28, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------- AI PIPELINE */

export const PIPELINE_MS = 14500;

const TAKES = [
  { a: "amber", b: "orange", model: "Kling 2.1", seed: "4412" },
  { a: "cyan", b: "blue", model: "Veo 3", seed: "0981" },
  { a: "amber", b: "pink", model: "Kling 2.1", seed: "4413" },
  { a: "blue", b: "indigo", model: "Runway Gen-4", seed: "2207" },
  { a: "orange", b: "amber", model: "Veo 3", seed: "0982" },
  { a: "cyan", b: "green", model: "Kling 2.1", seed: "4414" },
];
const IMPORT_AT = 500;
// One decision about every 1.1s, left to right, so each one can be followed:
// the cursor glides to a take, a label says what it is about to do, then it
// does it. The operator's note on the first cut was that it bounced around too
// fast to tell what was happening.
const ACTIONS = [
  { t: 3000, i: 0, kind: "star" },
  { t: 4200, i: 1, kind: "reject" },
  { t: 5400, i: 3, kind: "reject" },
  { t: 6600, i: 5, kind: "reject" },
  { t: 7800, i: 2, kind: "star" },
  { t: 9100, i: 2, kind: "pick" },
] as const;
const REJECT = Object.fromEntries(ACTIONS.filter((a) => a.kind === "reject").map((a) => [a.i, a.t])) as Record<number, number>;
const STAR = Object.fromEntries(ACTIONS.filter((a) => a.kind === "star").map((a) => [a.i, a.t])) as Record<number, number>;
const PICK = 2;
const PICK_AT = 9100;
const SLOT_AT = 10300;
const CLIENT_AT = 11400;
const DONE_AT = 12500;
const ACTION_LABEL = { star: "Star it", reject: "Reject it", pick: "Pick as the take" } as const;
const ACTION_TONE = { star: "amber", reject: "red", pick: "green" } as const;
const TILE = { x0: 16, y0: 100, w: 192, h: 96, gx: 16, gy: 14 };
const tilePos = (i: number) => ({ x: TILE.x0 + (i % 3) * (TILE.w + TILE.gx), y: TILE.y0 + Math.floor(i / 3) * (TILE.h + TILE.gy) });

/** Where the pointer goes for each kind of decision on a take. */
function actionPoint(i: number, kind: "star" | "reject" | "pick") {
  const p = tilePos(i);
  if (kind === "pick") return { x: p.x + 96, y: p.y + 52 };
  return { x: p.x + (kind === "star" ? 150 : 176), y: p.y + 16 };
}

export function PipelineScene({ t }: { t: number }) {
  const picked = t >= PICK_AT;
  const pp = tilePos(PICK);
  // The picked take flies down into slot 4 of the sequence.
  const fly = easeInOut(ramp(t, SLOT_AT - 800, 800));
  const slotX = 16 + 3 * 104;
  const slotY = 356;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="AI pipeline · Shot 04, The pour"
        sub="Video stage · 6 generations imported"
        right={
          t >= DONE_AT ? (
            <Chip tone="green" t={t} since={DONE_AT}>Take approved</Chip>
          ) : t >= CLIENT_AT ? (
            <Chip tone="pink" t={t} since={CLIENT_AT}>Client picked option 3</Chip>
          ) : (
            <Chip tone="purple" t={t}>Triage</Chip>
          )
        }
      >
        <div className="absolute flex items-center gap-2" style={{ left: 16, top: 64, width: 608 }}>
          <span className="rounded-[7px] px-2 py-1 text-[10.5px] font-bold" style={{ background: "var(--h-purple-bg)", color: "var(--h-purple)" }}>
            Imported from Higgsfield
          </span>
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-text-muted">
            <span className="font-bold text-text">Prompt </span>
            {typed("slow pour into a cold glass, warm morning light, 50mm", t, 300, 16)}
          </p>
        </div>

        {TAKES.map((k, i) => {
          const { x, y } = tilePos(i);
          const s = spring(ramp(t, IMPORT_AT + i * 160, 480));
          if (s <= 0) return null;
          const rejected = REJECT[i] !== undefined && t >= REJECT[i];
          const starred = STAR[i] !== undefined && t >= STAR[i];
          const isPick = i === PICK && picked;
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-[10px] border"
              style={{
                left: x,
                top: y,
                width: TILE.w,
                height: TILE.h,
                borderColor: isPick ? "var(--h-green)" : "var(--border)",
                boxShadow: isPick ? "0 0 0 3px color-mix(in oklch, var(--h-green) 35%, transparent)" : undefined,
                opacity: (rejected ? 0.35 : 1) * Math.min(1, s * 1.5),
                transform: `scale(${0.8 + 0.2 * s})`,
                filter: rejected ? "grayscale(1)" : undefined,
                transition: "opacity .3s, filter .3s",
                background: `linear-gradient(150deg, var(--h-${k.a}-bg), color-mix(in oklch, var(--h-${k.b}) 40%, var(--h-${k.a}-bg)))`,
              }}
            >
              <svg viewBox="0 0 192 96" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <path d={`M${70 + i * 3} 8 q14 14 20 32`} stroke="var(--surface)" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".8" />
                <path d="M84 40 h34 l-5 44 h-24z" fill="var(--surface)" opacity=".7" />
                <path d="M88 60 h26 l-3 22 h-20z" fill={`var(--h-${k.b})`} opacity=".6" />
              </svg>
              <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-surface px-1 text-[9.5px] font-extrabold">Option {i + 1}</span>
              <span className="absolute bottom-1.5 left-1.5 rounded-[5px] px-1 text-[9px] font-semibold text-text-muted" style={{ background: "var(--surface)" }}>
                {k.model} · seed {k.seed}
              </span>
              <span className="absolute right-1.5 top-1.5 flex gap-1">
                {starred ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[11px]" style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)", transform: `scale(${spring(ramp(t, STAR[i], 380))})` }}>
                    ★
                  </span>
                ) : null}
                {rejected ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-black" style={{ background: "var(--h-red-bg)", color: "var(--h-red)" }}>
                    ×
                  </span>
                ) : null}
                {isPick ? (
                  <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold text-white" style={{ background: "var(--h-green)", transform: `scale(${spring(ramp(t, PICK_AT, 420))})` }}>
                    Take
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
        <Burst t={t} at={PICK_AT} x={pp.x + TILE.w - 20} y={pp.y + 12} />

        {/* Sequence strip */}
        <p className="absolute text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint" style={{ left: 16, top: 334 }}>
          Sequence
        </p>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i !== 3 || t >= SLOT_AT;
          const hues = ["amber", "blue", "pink", "amber", "cyan", "indigo"];
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-[8px] border"
              style={{
                left: 16 + i * 104,
                top: slotY,
                width: 96,
                height: 58,
                borderStyle: filled ? "solid" : "dashed",
                borderColor: i === 3 && t >= SLOT_AT && t < SLOT_AT + 900 ? "var(--h-green)" : "var(--border)",
                background: filled ? `linear-gradient(150deg, var(--h-${hues[i]}-bg), var(--surface-2))` : "transparent",
              }}
            >
              <span className="absolute left-1 top-1 text-[9.5px] font-extrabold text-text-muted">0{i + 1}</span>
              {i === 3 && !filled ? <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-text-faint">Needs a take</span> : null}
            </div>
          );
        })}
        {/* The flight from grid to slot */}
        {t >= SLOT_AT - 800 && t < SLOT_AT ? (
          <div
            className="absolute rounded-[10px] border-2"
            style={{
              borderColor: "var(--h-green)",
              left: lerp(pp.x, slotX, fly),
              top: lerp(pp.y, slotY, fly),
              width: lerp(TILE.w, 96, fly),
              height: lerp(TILE.h, 58, fly),
              background: "linear-gradient(150deg, var(--h-amber-bg), color-mix(in oklch, var(--h-pink) 40%, var(--h-amber-bg)))",
            }}
          />
        ) : null}
        <Burst t={t} at={DONE_AT} x={560} y={26} />
      </Window>
      {/* What the next click does, beside the pointer */}
      {ACTIONS.map((a) => {
        const show = ramp(t, a.t - 500, 200) * (1 - ramp(t, a.t + 500, 200));
        if (show <= 0) return null;
        const at = actionPoint(a.i, a.kind);
        return (
          <span
            key={`${a.t}`}
            className="pointer-events-none absolute z-40 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold"
            style={{
              // Flip to the pointer's left near the right edge, or it spills out.
              ...(at.x > 470 ? { right: 640 - at.x + 8 } : { left: at.x + 20 }),
              top: at.y + 16,
              opacity: show,
              color: `var(--h-${ACTION_TONE[a.kind]})`,
              background: `var(--h-${ACTION_TONE[a.kind]}-bg)`,
              boxShadow: "0 6px 16px -8px rgba(40,30,90,.45)",
            }}
          >
            {ACTION_LABEL[a.kind]}
          </span>
        );
      })}
      <Cursor
        t={t}
        travel={750}
        path={[{ t: 2000, x: 320, y: 300 }, ...ACTIONS.map((a) => ({ t: a.t, ...actionPoint(a.i, a.kind), click: true }))]}
      />
    </div>
  );
}
