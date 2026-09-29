"use client";

import type { ReactNode } from "react";
import {
  ActionLabel,
  Avatar,
  Burst,
  Chip,
  Cursor,
  Window,
  arrive,
  dragAt,
  easeOut,
  lerp,
  ramp,
  spring,
  typed,
} from "./scene-kit";

/*
 * The moodboard page's chapter scenes: one mini explainer per section of the
 * page, each showing a part of the canvas at a pace a first-time visitor can
 * follow (actions about a second apart, a label saying what each one does).
 * Same contract as every scene: 640x440, a pure function of t.
 */

const RAIL_W = 56;
const CANVAS = { x: RAIL_W, y: 52, w: 640 - RAIL_W, h: 388 };

// Tool rail icons, in the order the real rail has them.
const TOOLS: Record<string, string> = {
  note: "M5 4h14v16H5z M8 9h8 M8 13h6",
  heading: "M6 5v14 M18 5v14 M6 12h12",
  todo: "M5 6l2 2 3-3 M12 7h7 M5 13l2 2 3-3 M12 14h7",
  color: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4A9 9 0 0 0 12 3z",
  column: "M5 4h6v16H5z M13 4h6v10h-6z",
  line: "M5 19L19 5 M13 5h6v6",
  link: "M10 14a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1 M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6-6l1-1",
  upload: "M12 16V5 M7 10l5-5 5 5 M5 19h14",
  back: "M15 5l-7 7 7 7",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7z M7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8 M6 19h8 M14 5l-4 14",
  list: "M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01",
  resize: "M4 20L20 4 M14 4h6v6 M4 14v6h6",
};
const RAIL_ORDER = ["note", "heading", "todo", "color", "column", "line", "link", "upload"];
export const railY = (key: string, order = RAIL_ORDER) => 52 + 14 + order.indexOf(key) * 42 + 17;

function Icon({ d, size = 17 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The board chrome every moodboard scene shares: window, rail, dotted canvas. */
function Board({
  title = "Moodboard · Bright Water",
  sub = "Look and feel for the hero spot",
  right,
  rail = RAIL_ORDER,
  active,
  children,
  zoom = 1,
}: {
  title?: string;
  sub?: string;
  right?: ReactNode;
  rail?: string[];
  active?: string | null;
  children: ReactNode;
  zoom?: number;
}) {
  return (
    <Window title={title} sub={sub} right={right}>
      <div
        className="absolute overflow-hidden"
        style={{
          left: CANVAS.x,
          top: CANVAS.y,
          width: CANVAS.w,
          height: CANVAS.h,
          backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1.2px)",
          backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
        }}
      />
      <div className="absolute flex flex-col items-center gap-[6px] border-r border-border bg-surface pt-[14px]" style={{ left: 0, top: 52, width: RAIL_W, height: 388 }}>
        {rail.map((k) => (
          <span
            key={k}
            className="grid h-9 w-9 place-items-center rounded-[9px]"
            style={{
              background: active === k ? "var(--accent-soft)" : "transparent",
              color: active === k ? "var(--accent)" : "var(--text-muted)",
              transition: "background .2s, color .2s",
            }}
          >
            {TOOLS[k] ? <Icon d={TOOLS[k]} /> : <span className="text-[13px] font-black">{k}</span>}
          </span>
        ))}
      </div>
      {children}
    </Window>
  );
}

/** A drawn photograph: a gradient and a couple of shapes, clearly illustration. */
function Photo({ a, b, kind = 0 }: { a: string; b: string; kind?: number }) {
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, var(--h-${a}-bg), color-mix(in oklch, var(--h-${b}) 45%, var(--h-${a}-bg)))` }}>
      <svg viewBox="0 0 150 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {kind === 0 ? (
          <>
            <circle cx="118" cy="26" r="14" fill="var(--h-yellow)" opacity=".7" />
            <rect x="0" y="70" width="150" height="30" fill="var(--h-orange)" opacity=".35" />
            <rect x="22" y="44" width="30" height="26" rx="3" fill="var(--surface)" opacity=".8" />
          </>
        ) : kind === 1 ? (
          <>
            <rect x="62" y="16" width="26" height="10" rx="3" fill="var(--h-indigo)" />
            <path d="M58 26 h34 q8 10 8 22 v44 h-50 v-44 q0 -12 8 -22z" fill="var(--h-blue)" opacity=".85" />
            <rect x="56" y="50" width="38" height="20" rx="3" fill="var(--surface)" />
          </>
        ) : kind === 2 ? (
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
        ) : (
          <>
            <path d="M0 80 Q40 50 75 66 T150 58 V100 H0z" fill="var(--h-green)" opacity=".45" />
            <circle cx="40" cy="30" r="10" fill="var(--surface)" opacity=".7" />
          </>
        )}
      </svg>
    </div>
  );
}

function Card({ x, y, w, h, style, children, className = "" }: { x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute overflow-hidden rounded-[10px] border border-border shadow-[0_10px_24px_-14px_rgba(40,30,90,.45)] ${className}`}
      style={{ left: x, top: y, width: w, height: h, ...style }}
    >
      {children}
    </div>
  );
}

/** A tool being dragged off the rail: a ghost that follows the pointer, then the card. */
function lifted(t: number, start: number, end: number) {
  return t >= start && t < end + 120;
}

/* ------------------------------------------------------------------ BUILD */

export const MB_BUILD_MS = 12500;

const B = {
  heading: { at: 900, dur: 800, to: { x: 84, y: 72 } },
  note: { at: 3500, dur: 800, to: { x: 84, y: 136 } },
  todo: { at: 6300, dur: 800, to: { x: 330, y: 136 } },
  color: { at: 9300, dur: 800, to: { x: 330, y: 300 } },
};
const NOTE_TEXT = "Warm morning light. Nothing staged, nothing glossy.";
const TODO = ["Find a glass with a thick base", "Two backup bottles", "Lock the linen colour"];

export function MoodboardBuildScene({ t }: { t: number }) {
  const from = (k: string) => ({ x: 20, y: railY(k) - 12 });
  const ghost = (k: keyof typeof B, w: number, h: number, children: ReactNode, style?: React.CSSProperties) => {
    const s = B[k];
    if (t < s.at) return null;
    const pos = dragAt(t, s.at + 150, s.dur, from(k), s.to);
    const up = lifted(t, s.at, s.at + 150 + s.dur);
    return (
      <Card
        x={pos.x}
        y={pos.y}
        w={w}
        h={h}
        style={{
          background: "var(--surface)",
          opacity: ramp(t, s.at, 150),
          transform: `scale(${up ? 1.04 : 1}) rotate(${up ? -1.5 : 0}deg)`,
          boxShadow: up ? "0 22px 40px -16px rgba(40,30,90,.55)" : undefined,
          transition: "transform .2s, box-shadow .2s",
          ...style,
        }}
      >
        {children}
      </Card>
    );
  };
  const headingFill = t >= 2600;
  const activeTool = (Object.keys(B) as (keyof typeof B)[]).find((k) => t >= B[k].at - 400 && t < B[k].at + 150 + B[k].dur);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Board active={activeTool ?? null} right={<Chip tone="muted" t={t}>Drag tools onto the board</Chip>}>
        {ghost(
          "heading",
          200,
          40,
          <p className="px-3 py-1.5 font-display text-[20px] font-extrabold leading-tight" style={{ color: "var(--h-orange)" }}>
            {typed("Morning light", t, B.heading.at + 1000, 45) || " "}
          </p>,
          {
            border: "none",
            boxShadow: "none",
            background: headingFill ? "var(--h-amber-bg)" : "transparent",
            transition: "background .4s",
          },
        )}
        {ghost(
          "note",
          220,
          96,
          <p className="p-2.5 text-[12.5px] font-semibold leading-snug">
            <b>Look:</b> {typed(NOTE_TEXT, t, B.note.at + 1050, 28)}
          </p>,
          { background: "var(--h-yellow-bg)" },
        )}
        {ghost(
          "todo",
          230,
          120,
          <div className="p-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Still needed</p>
            {TODO.map((line, i) => {
              const at = B.todo.at + 1100 + i * 350;
              const done = t >= B.todo.at + 2100 + i * 400 && i < 2;
              return t >= at ? (
                <div key={line} className="mt-1.5 flex items-center gap-2 text-[12px]" style={arrive(t, at, 4)}>
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] font-black text-white"
                    style={{ background: done ? "var(--h-green)" : "transparent", borderColor: done ? "var(--h-green)" : "var(--border-strong)" }}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span style={{ textDecoration: done ? "line-through" : undefined, color: done ? "var(--text-faint)" : undefined }}>{line}</span>
                </div>
              ) : null;
            })}
          </div>,
        )}
        {ghost(
          "color",
          170,
          70,
          <div className="flex h-full items-center gap-2 px-3">
            {["amber", "orange", "cyan", "indigo"].map((h, i) => (
              <span key={h} className="h-9 w-9 rounded-full" style={{ background: `var(--h-${h})`, transform: `scale(${spring(ramp(t, B.color.at + 1000 + i * 140, 400))})` }} />
            ))}
          </div>,
        )}
        {/* A reference already on the board, so the new cards visibly avoid it */}
        <Card x={84} y={264} w={210} h={124}>
          <Photo a="amber" b="orange" />
        </Card>
        <Burst t={t} at={B.heading.at + 1850} x={290} y={92} />
      </Board>
      {(Object.keys(B) as (keyof typeof B)[]).map((k) => (
        <ActionLabel key={k} t={t} at={B[k].at} x={24} y={railY(k) - 12} text={`Drag a ${k === "todo" ? "to-do" : k}`} before={600} after={500} />
      ))}
      <ActionLabel t={t} at={2600} x={230} y={80} text="Give it a fill" tone="amber" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 300, y: 250 },
          ...(Object.keys(B) as (keyof typeof B)[]).flatMap((k) => [
            { t: B[k].at, x: 28, y: railY(k), click: true },
            { t: B[k].at + 150 + B[k].dur, x: B[k].to.x + 60, y: B[k].to.y + 24 },
          ]),
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- IMPORT */

export const MB_IMPORT_MS = 12500;

const SOURCES = [
  { key: "upload", label: "Upload from your device", at: 1000, hue: "indigo" },
  { key: "link", label: "Paste a link", at: 3300, hue: "pink" },
  { key: "project", label: "From this project's assets", at: 5900, hue: "green" },
  { key: "drive", label: "Google Drive", at: 7900, hue: "amber" },
  { key: "figma", label: "Figma frames", at: 9700, hue: "purple" },
];
const MENU = { x: 64, y: 72, w: 196 };

export function MoodboardImportScene({ t }: { t: number }) {
  const cur = [...SOURCES].reverse().find((s) => t >= s.at - 700);
  const land = (at: number) => arrive(t, at, -20);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Board active="upload" right={<Chip tone="muted" t={t}>Five ways in</Chip>}>
        {/* Arrivals */}
        {t >= 1600 ? (
          <>
            <Card x={290} y={70} w={130} h={92} style={land(1600)}>
              <Photo a="amber" b="orange" />
              <Tag text="Upload" hue="indigo" />
            </Card>
            <Card x={432} y={82} w={112} h={130} style={land(1800)}>
              <Photo a="blue" b="indigo" kind={1} />
              <Tag text="Upload" hue="indigo" />
            </Card>
          </>
        ) : null}
        {t >= 3500 && t < 4900 ? (
          <div className="absolute rounded-[9px] border bg-surface px-2.5 py-1.5 text-[11.5px]" style={{ left: 290, top: 190, width: 250, borderColor: "var(--accent)", ...arrive(t, 3500, 6) }}>
            {typed("pinterest.com/pin/kitchen-light", t, 3700, 30)}
          </div>
        ) : null}
        {t >= 4900 ? (
          <Card x={290} y={176} w={170} h={112} style={{ background: "var(--surface)", ...land(4900) }}>
            <div className="h-[62px]" style={{ background: "linear-gradient(135deg, var(--h-amber-bg), var(--h-pink-bg))" }} />
            <div className="px-2 py-1.5">
              <p className="truncate text-[11.5px] font-bold">Kitchen light references</p>
              <p className="truncate text-[10px] text-text-faint">pinterest.com · preview pulled in</p>
            </div>
            <Tag text="Link" hue="pink" />
          </Card>
        ) : null}
        {t >= 6800 ? (
          <Card x={472} y={224} w={130} h={92} style={land(6800)}>
            <Photo a="cyan" b="blue" kind={2} />
            <Tag text="Project" hue="green" />
          </Card>
        ) : null}
        {t >= 8700 ? (
          <Card x={84} y={300} w={150} h={96} style={land(8700)}>
            <Photo a="green" b="cyan" kind={3} />
            <Tag text="Drive" hue="amber" />
          </Card>
        ) : null}
        {t >= 10500
          ? [0, 1, 2].map((i) => (
              <Card key={i} x={250 + i * 118} y={318} w={108} h={70} style={land(10500 + i * 180)}>
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--h-purple-bg), var(--h-${["pink", "indigo", "blue"][i]}-bg))` }} />
                <span className="absolute left-1.5 top-5 h-2 w-14 rounded-full" style={{ background: "var(--h-purple)", opacity: 0.5 }} />
                <span className="absolute left-1.5 top-9 h-1.5 w-10 rounded-full bg-surface" />
                <Tag text={`Frame ${i + 1}`} hue="purple" />
              </Card>
            ))
          : null}

        {/* The add menu */}
        <div className="absolute rounded-[12px] border border-border bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(40,30,90,.5)]" style={{ left: MENU.x, top: MENU.y, width: MENU.w, ...arrive(t, 300, 6) }}>
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Add references</p>
          {SOURCES.map((s) => {
            const on = cur?.key === s.key;
            return (
              <div key={s.key} className="flex items-center gap-2 rounded-[8px] px-2 py-[7px] text-[12px] font-semibold" style={{ background: on ? `var(--h-${s.hue}-bg)` : "transparent", transition: "background .25s" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: `var(--h-${s.hue})` }} />
                {s.label}
              </div>
            );
          })}
        </div>
      </Board>
      {SOURCES.map((s, i) => (
        <ActionLabel
          key={s.key}
          t={t}
          at={s.at}
          x={MENU.x + MENU.w - 10}
          y={MENU.y + 28 + i * 31 - 12}
          tone={s.hue as never}
          text={["Drop in photos", "Paste any URL", "Pick from the job", "Browse your Drive", "Import Figma frames"][i]}
          after={900}
        />
      ))}
      <Cursor
        t={t}
        travel={650}
        path={[{ t: 400, x: 300, y: 300 }, ...SOURCES.map((s, i) => ({ t: s.at, x: MENU.x + 150, y: MENU.y + 34 + i * 31, click: true }))]}
      />
    </div>
  );
}

function Tag({ text, hue }: { text: string; hue: string }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: "var(--surface)", color: `var(--h-${hue})` }}>
      {text}
    </span>
  );
}

/* --------------------------------------------------------------- ORGANIZE */

export const MB_ORG_MS = 13000;

const COL = { x: 420, y: 70, w: 180 };
const LOOSE = [
  { x: 84, y: 76, a: "amber", b: "orange", k: 0, at: 1000 },
  { x: 84, y: 190, a: "blue", b: "indigo", k: 1, at: 2600 },
  { x: 230, y: 118, a: "cyan", b: "blue", k: 2, at: 4200 },
];
const CONNECT_AT = 6200;
const LINE_AT = 8200;
const CAPTION_AT = 10300;

export function MoodboardOrganizeScene({ t }: { t: number }) {
  const filed = LOOSE.filter((c) => t >= c.at + 900).length;
  const line = easeOut(ramp(t, CONNECT_AT, 700));
  const line2 = easeOut(ramp(t, LINE_AT, 700));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Board active={t >= LINE_AT - 500 && t < LINE_AT + 900 ? "line" : null} right={<Chip tone="muted" t={t}>Columns, arrows, lines</Chip>}>
        {/* The column */}
        <div className="absolute rounded-[12px] border border-border bg-surface-2 p-2" style={{ left: COL.x, top: COL.y, width: COL.w, height: 36 + filed * 74 + (filed ? 8 : 40) }}>
          <p className="px-1 text-[12px] font-extrabold">Kitchen · {filed} cards</p>
          {filed === 0 ? <p className="mt-2 rounded-[8px] border border-dashed border-border py-2 text-center text-[10.5px] text-text-faint">Drop cards here</p> : null}
        </div>
        {LOOSE.map((c, i) => {
          const slot = { x: COL.x + 10, y: COL.y + 30 + i * 74 };
          const pos = dragAt(t, c.at, 900, { x: c.x, y: c.y }, slot);
          const w = lerp(130, 160, pos.p);
          const h = lerp(92, 66, pos.p);
          const up = t >= c.at && t < c.at + 900;
          return (
            <Card
              key={i}
              x={pos.x}
              y={pos.y}
              w={w}
              h={h}
              style={{ transform: `rotate(${up ? -2 : 0}deg) scale(${up ? 1.04 : 1})`, boxShadow: up ? "0 22px 40px -16px rgba(40,30,90,.55)" : undefined, zIndex: up ? 5 : 1 }}
            >
              <Photo a={c.a} b={c.b} kind={c.k} />
            </Card>
          );
        })}

        {/* A note connected to the column by an arrow */}
        <Card x={90} y={296} w={200} h={70} style={{ background: "var(--h-yellow-bg)", ...arrive(t, 5200, 8) }}>
          <p className="p-2.5 text-[12px] font-semibold leading-snug">These are the frames the client liked most.</p>
        </Card>
        <svg className="pointer-events-none absolute left-0 top-0" width="640" height="440" aria-hidden="true">
          <defs>
            <marker id="mbo-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
            </marker>
            <marker id="mbo-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--h-pink)" />
            </marker>
          </defs>
          {t >= CONNECT_AT ? (
            <path d="M290 330 C 350 330, 370 250, 418 220" fill="none" stroke="var(--accent)" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - line} markerEnd={line > 0.95 ? "url(#mbo-a)" : undefined} />
          ) : null}
          {t >= LINE_AT ? (
            <path d="M92 400 L 380 400" fill="none" stroke="var(--h-pink)" strokeWidth="2.5" strokeDasharray="7 6" strokeDashoffset={0} opacity={line2} markerEnd={line2 > 0.95 ? "url(#mbo-b)" : undefined} markerStart={line2 > 0.95 ? "url(#mbo-b)" : undefined} />
          ) : null}
        </svg>
        {t >= LINE_AT + 600 ? (
          <span className="absolute rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-extrabold" style={{ left: 190, top: 390, color: "var(--h-pink)", ...arrive(t, LINE_AT + 600, 4) }}>
            Hero moment
          </span>
        ) : null}
        {/* The line's style flyout */}
        {t >= LINE_AT + 300 && t < LINE_AT + 2000 ? (
          <div className="absolute flex items-center gap-2 rounded-[10px] border border-border bg-surface p-1.5 shadow-[0_12px_30px_-14px_rgba(40,30,90,.5)]" style={{ left: 62, top: railY("line") - 22, ...arrive(t, LINE_AT + 300, 4) }}>
            {["pink", "indigo", "green"].map((h) => (
              <span key={h} className="h-5 w-5 rounded-full" style={{ background: `var(--h-${h})`, boxShadow: h === "pink" ? "0 0 0 2px var(--surface), 0 0 0 4px var(--h-pink)" : undefined }} />
            ))}
            <span className="rounded-[6px] bg-surface-2 px-1.5 text-[10px] font-bold">Dashed</span>
            <span className="rounded-[6px] bg-surface-2 px-1.5 text-[10px] font-bold">Both ends</span>
          </div>
        ) : null}
        {/* Caption on a filed card */}
        {t >= CAPTION_AT ? (
          <span className="absolute rounded-[6px] bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ left: COL.x + 14, top: COL.y + 30 + 66 - 20, ...arrive(t, CAPTION_AT, 4) }}>
            {typed("Warm, not orange", t, CAPTION_AT + 150, 45)}
          </span>
        ) : null}
      </Board>
      {LOOSE.map((c) => (
        <ActionLabel key={c.at} t={t} at={c.at} x={c.x + 60} y={c.y + 30} text="Drag it into the column" />
      ))}
      <ActionLabel t={t} at={CONNECT_AT} x={290} y={326} text="Connect with an arrow" />
      <ActionLabel t={t} at={LINE_AT} x={92} y={386} text="A line with a label" tone="pink" />
      <ActionLabel t={t} at={CAPTION_AT} x={COL.x + 70} y={COL.y + 80} text="Caption the image" tone="amber" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 500, x: 300, y: 250 },
          ...LOOSE.flatMap((c, i) => [
            { t: c.at, x: c.x + 60, y: c.y + 30, click: true },
            { t: c.at + 900, x: COL.x + 70, y: COL.y + 50 + i * 74 },
          ]),
          { t: CONNECT_AT, x: 290, y: 330, click: true },
          { t: CONNECT_AT + 700, x: 420, y: 222 },
          { t: LINE_AT, x: 92, y: 400, click: true },
          { t: LINE_AT + 700, x: 380, y: 400 },
          { t: CAPTION_AT, x: COL.x + 70, y: COL.y + 80, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- EDIT */

export const MB_EDIT_MS = 12500;

const NOTE_SEL = 900;
const BOLD_AT = 2100;
const TINT_AT = 3300;
const IMG_SEL = 4800;
const RESIZE = { at: 5400, dur: 1100 };
const ZOOM_AT = 7400;
const UNDO_AT = 9300;
const REDO_AT = 10500;

export function MoodboardEditScene({ t }: { t: number }) {
  const noteMode = t >= NOTE_SEL && t < IMG_SEL;
  const imgMode = t >= IMG_SEL;
  const rail = noteMode ? ["back", "bold", "italic", "list", "link", "color"] : imgMode ? ["back", "resize", "color", "link"] : RAIL_ORDER;
  const grow = easeOut(ramp(t, RESIZE.at, RESIZE.dur));
  const undone = t >= UNDO_AT && t < REDO_AT;
  const g = undone ? 0 : grow;
  const imgW = lerp(170, 250, g);
  const imgH = lerp(116, 170, g);
  const z = 1 + 0.12 * Math.sin(Math.PI * ramp(t, ZOOM_AT, 1400));
  const zoomPct = Math.round(z * 100);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Board
        rail={rail}
        active={noteMode ? (t >= TINT_AT - 400 ? "color" : t >= BOLD_AT - 400 ? "bold" : null) : imgMode && t < 7000 ? "resize" : null}
        zoom={z}
        right={<Chip tone="muted" t={t}>{t >= ZOOM_AT && t < ZOOM_AT + 1600 ? `Zoom ${zoomPct}%` : "Select a card to edit it"}</Chip>}
      >
        <div className="absolute" style={{ left: CANVAS.x, top: CANVAS.y, width: CANVAS.w, height: CANVAS.h, transform: `scale(${z})`, transformOrigin: "300px 180px" }}>
          {/* The note */}
          <Card
            x={30}
            y={40}
            w={220}
            h={92}
            style={{
              background: t >= TINT_AT ? "var(--h-pink-bg)" : "var(--h-yellow-bg)",
              transition: "background .4s",
              boxShadow: noteMode ? "0 0 0 2px var(--accent)" : undefined,
            }}
          >
            <p className="p-2.5 text-[12.5px] leading-snug">
              <span style={{ fontWeight: t >= BOLD_AT ? 800 : 500 }}>Warm morning light.</span> Nothing staged, nothing glossy.
            </p>
          </Card>
          {/* The image being resized from its corner */}
          <Card x={290} y={60} w={imgW} h={imgH} style={{ boxShadow: imgMode ? "0 0 0 2px var(--accent)" : undefined }}>
            <Photo a="amber" b="orange" />
          </Card>
          {imgMode
            ? [
                [290, 60],
                [290 + imgW, 60],
                [290, 60 + imgH],
                [290 + imgW, 60 + imgH],
              ].map(([x, y], i) => (
                <span key={i} className="absolute h-3.5 w-3.5 rounded-full border-2 border-surface" style={{ left: x - 7, top: y - 7, background: "var(--accent)", boxShadow: "0 2px 6px rgba(20,15,60,.35)" }} />
              ))
            : null}
          <Card x={30} y={170} w={200} h={130}>
            <Photo a="cyan" b="blue" kind={2} />
          </Card>
        </div>

        {/* The formatting flyout, beside the rail */}
        {noteMode && t >= TINT_AT - 300 && t < TINT_AT + 900 ? (
          <div className="absolute flex gap-1.5 rounded-[10px] border border-border bg-surface p-1.5 shadow-[0_12px_30px_-14px_rgba(40,30,90,.5)]" style={{ left: 60, top: 52 + 14 + 5 * 42, ...arrive(t, TINT_AT - 300, 4) }}>
            {["yellow", "pink", "cyan", "green"].map((h) => (
              <span key={h} className="h-5 w-5 rounded-full" style={{ background: `var(--h-${h}-bg)`, border: `2px solid var(--h-${h})` }} />
            ))}
          </div>
        ) : null}

        {/* Undo / redo toast */}
        {t >= UNDO_AT && t < REDO_AT + 1200 ? (
          <div className="absolute rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white" style={{ left: 250, top: 396, background: "var(--text)", ...arrive(t, t >= REDO_AT ? REDO_AT : UNDO_AT, 8) }}>
            {t >= REDO_AT ? "Redone · ⌘⇧Z" : "Undone · ⌘Z"}
          </div>
        ) : null}
      </Board>
      <ActionLabel t={t} at={NOTE_SEL} x={150} y={110} text="Select a card: the rail becomes its tools" />
      <ActionLabel t={t} at={BOLD_AT} x={28} y={railY("bold", rail) - 12} text="Bold" />
      <ActionLabel t={t} at={TINT_AT} x={28} y={railY("color", rail) - 12} text="Card colour" tone="pink" />
      <ActionLabel t={t} at={RESIZE.at} x={290 + 170 + CANVAS.x} y={60 + 116 + CANVAS.y - 10} text="Resize from any corner" />
      <ActionLabel t={t} at={ZOOM_AT} x={330} y={250} text="Pinch to zoom" tone="green" after={1000} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 330 },
          { t: NOTE_SEL, x: 150, y: 150, click: true },
          { t: BOLD_AT, x: 28, y: railY("bold", ["back", "bold", "italic", "list", "link", "color"]), click: true },
          { t: TINT_AT - 300, x: 28, y: railY("color", ["back", "bold", "italic", "list", "link", "color"]), click: true },
          { t: TINT_AT, x: 96, y: 52 + 14 + 5 * 42 + 13, click: true },
          { t: IMG_SEL, x: 420, y: 160, click: true },
          { t: RESIZE.at, x: 290 + 170 + CANVAS.x, y: 60 + 116 + CANVAS.y, click: true },
          { t: RESIZE.at + RESIZE.dur, x: 290 + 250 + CANVAS.x, y: 60 + 170 + CANVAS.y },
          { t: ZOOM_AT, x: 360, y: 250 },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- REVIEW */

export const MB_REVIEW_MS = 13500;

const SHARE_AT = 900;
const COPIED_AT = 1700;
const PORTAL_AT = 3000;
const PINS = [
  { n: 1, x: 190, y: 160, at: 4100, who: "Maya", hue: "pink", text: "Love this light. More of this." },
  { n: 2, x: 452, y: 150, at: 6300, who: "Jon", hue: "cyan", text: "This glass reads too cold.", draw: true },
];
const REPLY_AT = 8300;
const APPROVE_AT = 10700;

export function MoodboardReviewScene({ t }: { t: number }) {
  const portal = t >= PORTAL_AT;
  const approved = t >= APPROVE_AT;
  const draw = easeOut(ramp(t, PINS[1].at - 900, 800));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      {!portal ? (
        <Board
          right={
            <span className="rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: "var(--accent)", transform: `scale(${t >= SHARE_AT - 60 && t < SHARE_AT + 120 ? 0.92 : 1})` }}>
              Share for review
            </span>
          }
        >
          <Card x={84} y={80} w={210} h={140}><Photo a="amber" b="orange" /></Card>
          <Card x={310} y={80} w={200} h={140}><Photo a="cyan" b="blue" kind={2} /></Card>
          {t >= SHARE_AT + 200 ? (
            <div className="absolute rounded-[14px] border border-border bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 150, top: 230, width: 340, ...arrive(t, SHARE_AT + 200, 12) }}>
              <p className="text-[13px] font-extrabold">Share for review</p>
              <p className="mt-0.5 text-[11px] text-text-faint">Anyone with the link can comment and approve. No login.</p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="flex-1 truncate rounded-[8px] bg-surface-2 px-2 py-1.5 text-[11px]">studio-flows.com/r/8f2k…</span>
                <span className="rounded-[8px] px-2.5 py-1.5 text-[11px] font-extrabold text-white" style={{ background: t >= COPIED_AT ? "var(--h-green)" : "var(--accent)" }}>
                  {t >= COPIED_AT ? "Copied ✓" : "Copy link"}
                </span>
              </div>
            </div>
          ) : null}
        </Board>
      ) : (
        <div style={arrive(t, PORTAL_AT, 10)}>
          <Window
            title="Bright Water · Moodboard review"
            sub="Reviewing as Maya · studio-flows.com/r/…"
            right={approved ? <Chip tone="green" t={t} since={APPROVE_AT}>Approved</Chip> : <Chip tone="amber" t={t}>Waiting on you</Chip>}
          >
            <div className="absolute" style={{ left: 16, top: 66, width: 400, height: 358, backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1.2px)", backgroundSize: "18px 18px" }}>
              <Card x={14} y={20} w={200} h={140}><Photo a="amber" b="orange" /></Card>
              <Card x={230} y={20} w={160} h={140}><Photo a="cyan" b="blue" kind={2} /></Card>
              <Card x={14} y={180} w={170} h={110}><Photo a="green" b="cyan" kind={3} /></Card>
              <Card x={200} y={190} w={190} h={60} style={{ background: "var(--h-yellow-bg)" }}>
                <p className="p-2 text-[11px] font-semibold">Warm morning light. Nothing staged.</p>
              </Card>
            </div>
            {/* The drawn circle Jon makes around the glass */}
            <svg className="pointer-events-none absolute left-0 top-0" width="640" height="440" aria-hidden="true">
              {t >= PINS[1].at - 900 ? (
                <ellipse cx="324" cy="156" rx="62" ry="52" fill="none" stroke="var(--h-red)" strokeWidth="3" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} strokeLinecap="round" />
              ) : null}
            </svg>
            {PINS.map((p) => {
              const s = spring(ramp(t, p.at, 480));
              return s > 0 ? (
                <span key={p.n} className="absolute grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white" style={{ left: p.x - 14, top: p.y - 14, transform: `scale(${s})`, background: approved ? "var(--h-green)" : "var(--accent)", boxShadow: "0 0 0 3px white, 0 6px 14px -4px rgba(20,15,60,.45)" }}>
                  {p.n}
                </span>
              ) : null;
            })}
            {/* Comment rail */}
            <div className="absolute" style={{ left: 430, top: 66, width: 194 }}>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Comments</p>
              <div className="mt-2 space-y-2">
                {PINS.map((p) =>
                  t >= p.at ? (
                    <div key={p.n} className="rounded-[10px] border border-border bg-surface p-2" style={arrive(t, p.at + 60)}>
                      <div className="flex items-center gap-1.5">
                        <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-white" style={{ background: "var(--accent)" }}>{p.n}</span>
                        <Avatar name={p.who} hue={p.hue} size={16} />
                        <span className="text-[11.5px] font-bold">{p.who}</span>
                        {p.draw ? <span className="ml-auto text-[9.5px] font-bold" style={{ color: "var(--h-red)" }}>drawing</span> : null}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-snug text-text-muted">{typed(p.text, t, p.at + 250, 22)}</p>
                      {p.n === 2 && t >= REPLY_AT ? (
                        <div className="mt-1.5 border-l-2 pl-2" style={{ borderColor: "var(--accent)", ...arrive(t, REPLY_AT, 4) }}>
                          <p className="text-[10.5px] font-bold">Studio <span className="font-semibold text-text-faint">· reply</span></p>
                          <p className="text-[11px] text-text-muted">{typed("Swapping in the warmer glass today.", t, REPLY_AT + 200, 24)}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null,
                )}
              </div>
              <span className="absolute left-0 right-0 rounded-[9px] py-2 text-center text-[12px] font-extrabold text-white" style={{ top: 316, background: "var(--h-green)", transform: `scale(${t >= APPROVE_AT - 60 && t < APPROVE_AT + 160 ? 0.94 : 1})` }}>
                {approved ? "Approved ✓" : "Approve the board"}
              </span>
            </div>
            <Burst t={t} at={APPROVE_AT} x={528} y={398} spread={1.4} />
          </Window>
        </div>
      )}
      <ActionLabel t={t} at={SHARE_AT} x={520} y={20} text="Share for review" />
      <ActionLabel t={t} at={COPIED_AT} x={420} y={262} text="Copy the link" tone="green" />
      <ActionLabel t={t} at={PINS[0].at} x={PINS[0].x} y={PINS[0].y} text="The client pins a note" tone="pink" />
      <ActionLabel t={t} at={PINS[1].at - 700} x={390} y={200} text="Or draws on the board" tone="red" after={1100} />
      <ActionLabel t={t} at={APPROVE_AT} x={510} y={380} text="And signs it off" tone="green" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 330, y: 330 },
          { t: SHARE_AT, x: 580, y: 26, click: true },
          { t: COPIED_AT, x: 450, y: 278, click: true },
          { t: PINS[0].at, x: PINS[0].x, y: PINS[0].y, click: true },
          { t: PINS[1].at - 900, x: 324 + 62, y: 156 },
          { t: PINS[1].at - 100, x: 324 + 60, y: 150 },
          { t: PINS[1].at, x: PINS[1].x, y: PINS[1].y, click: true },
          { t: APPROVE_AT, x: 527, y: 398, click: true },
        ]}
      />
    </div>
  );
}
