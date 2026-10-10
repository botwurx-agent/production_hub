"use client";

import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, easeOut, ramp, roll, typed, usd } from "./scene-kit";

/*
 * The CRM beat: a deal moves from Bidding to Awarded on the pipeline board,
 * its account flips from Prospect to Client, the people on the account are
 * filled in, and a project starts from it. Every piece is shipped (deal
 * stages, account_status, contacts on the account, Start a project).
 */

export const DEAL_MS = 5600;

const COLS = [
  { k: "Inbound", hue: "blue" },
  { k: "Qualifying", hue: "purple" },
  { k: "Bidding", hue: "amber" },
  { k: "Awarded", hue: "green" },
];
const COL_X = (i: number) => 16 + i * 152;
const COL_W = 144;
const CARD_Y = (row: number) => 128 + row * 70;

const OTHERS = [
  { col: 0, row: 0, who: "Lumen Skincare", what: "Social cutdowns", v: 8500 },
  { col: 1, row: 0, who: "Harbor Coffee", what: "Spring campaign", v: 18000 },
  { col: 2, row: 1, who: "Oakline", what: "Product stills", v: 6000 },
  { col: 3, row: 0, who: "Northfield & Co", what: "Brand film", v: 22000 },
];
const HERO = { who: "Bright Water", what: "30s hero spot", v: 42000 };

const DRAG_AT = 1000;
const DROP_AT = 1900;
const PANEL_AT = 2300;
const CLIENT_AT = 2800;
const PEOPLE = [
  { n: "Maya Torres", r: "Brand manager", h: "pink", at: 3200 },
  { n: "Jon Kim", r: "Agency producer", h: "cyan", at: 3700 },
];
const PROJECT_AT = 4500;

function DealCard({ who, what, v, hue, style, won }: { who: string; what: string; v: number; hue: string; style?: React.CSSProperties; won?: boolean }) {
  return (
    <div
      className="absolute rounded-[11px] border bg-surface px-2.5 py-2"
      style={{ width: COL_W, borderColor: won ? "var(--h-green)" : "var(--border)", borderLeft: `3px solid var(--h-${hue})`, ...style }}
    >
      <p className="truncate text-[11.5px] font-extrabold">{who}</p>
      <p className="truncate text-[10px] text-text-faint">{what}</p>
      <p className="mt-0.5 text-[11.5px] font-bold tabular-nums">{usd(v)}</p>
    </div>
  );
}

export function DealScene({ t }: { t: number }) {
  const from = { x: COL_X(2), y: CARD_Y(0) };
  const to = { x: COL_X(3), y: CARD_Y(0) };
  const d = dragAt(t, DRAG_AT, DROP_AT - DRAG_AT, from, to);
  const lifted = t >= DRAG_AT && t < DROP_AT;
  const won = t >= DROP_AT;
  const panel = easeOut(ramp(t, PANEL_AT, 450));
  const client = t >= CLIENT_AT;
  const sum = (col: number) =>
    OTHERS.filter((o) => o.col === col).reduce((a, o) => a + o.v, 0) + (col === 2 && !won ? HERO.v : 0) + (col === 3 && won ? HERO.v : 0);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Pipeline" sub="Every deal, by stage" right={<Chip tone="indigo" t={t}>Open pipeline {usd(roll(74500, 32500, t, DROP_AT, 600))}</Chip>}>
        {COLS.map((c, i) => (
          <div key={c.k} className="absolute rounded-[12px] bg-surface-2" style={{ left: COL_X(i) - 4, top: 62, width: COL_W + 8, height: 366, borderTop: `3px solid var(--h-${c.hue})` }}>
            <div className="flex items-center justify-between px-2.5 pt-2">
              <span className="text-[11.5px] font-extrabold">{c.k}</span>
              <span className="text-[10px] font-bold tabular-nums text-text-faint">{usd(sum(i))}</span>
            </div>
          </div>
        ))}
        {OTHERS.map((o) => (
          <DealCard
            key={o.who}
            who={o.who}
            what={o.what}
            v={o.v}
            hue={COLS[o.col].hue}
            style={{ left: COL_X(o.col), top: o.col === 3 && won ? CARD_Y(1) : CARD_Y(o.row), transition: "none" }}
          />
        ))}
        <DealCard
          who={HERO.who}
          what={HERO.what}
          v={HERO.v}
          hue={won ? "green" : "amber"}
          won={won}
          style={{
            left: d.x,
            top: d.y - (lifted ? 8 * Math.sin(d.p * Math.PI) + 4 : 0),
            zIndex: 10,
            transform: lifted ? "rotate(-3deg) scale(1.05)" : undefined,
            boxShadow: lifted ? "0 18px 40px -12px rgba(40,30,90,.45)" : "0 4px 12px -8px rgba(40,30,90,.3)",
          }}
        />
        {won ? (
          <div className="absolute z-10" style={{ left: COL_X(3) + 70, top: CARD_Y(0) - 10 }}>
            <Chip tone="green" t={t} since={DROP_AT}>Awarded</Chip>
          </div>
        ) : null}
        <Burst t={t} at={DROP_AT} x={COL_X(3) + 72} y={CARD_Y(0) + 30} spread={1.4} />

        {/* The account, sliding over the board */}
        {panel > 0 ? (
          <div
            className="absolute z-20 rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(40,30,90,.5)]"
            style={{ left: 300, top: 70, width: 322, height: 350, transform: `translateX(${(1 - panel) * 360}px)` }}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] text-[13px] font-black text-white" style={{ background: "var(--h-cyan)" }}>BW</span>
              <div className="flex-1">
                <p className="font-display text-[15px] font-extrabold leading-tight">Bright Water</p>
                <p className="text-[10.5px] text-text-faint">Beverage · via inbound email</p>
              </div>
              {client ? <Chip tone="green" t={t} since={CLIENT_AT}>Client</Chip> : <Chip tone="amber" t={t}>Prospect</Chip>}
            </div>
            <Burst t={t} at={CLIENT_AT} x={268} y={18} />
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">People</p>
            <div className="mt-1 space-y-1.5">
              {PEOPLE.map((p) =>
                t >= p.at ? (
                  <div key={p.n} className="flex items-center gap-2 rounded-[9px] border border-border px-2 py-1.5" style={arrive(t, p.at, 8)}>
                    <Avatar name={p.n} hue={p.h} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-bold">{typed(p.n, t, p.at + 100, 30)}</p>
                      <p className="text-[10px] text-text-faint">{p.r}</p>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Activity</p>
            <div className="mt-1 space-y-1 text-[11px]">
              <p style={arrive(t, PANEL_AT + 200, 6)}>
                <span className="font-bold" style={{ color: "var(--h-green)" }}>Won</span> · Moved to Awarded, {usd(HERO.v)}
              </p>
              {t >= PROJECT_AT ? (
                <p style={arrive(t, PROJECT_AT + 200, 6)}>
                  <span className="font-bold" style={{ color: "var(--accent)" }}>Project</span> · 30s hero spot started
                </p>
              ) : null}
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <span
                className="grid h-[34px] place-items-center rounded-[9px] text-[12px] font-extrabold text-white"
                style={{ background: "var(--accent)", transform: t >= PROJECT_AT - 60 && t < PROJECT_AT + 90 ? "scale(.96)" : undefined }}
              >
                {t >= PROJECT_AT ? "Project started" : "Start a project"}
              </span>
            </div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={DRAG_AT} x={COL_X(2) + 40} y={CARD_Y(0) + 20} text="Drag it to Awarded" tone="green" after={700} />
      <ActionLabel t={t} at={PROJECT_AT} x={420} y={360} text="Start the job from the client" after={900} />
      <Cursor
        t={t}
        travel={850}
        path={[
          { t: 400, x: 300, y: 400 },
          { t: DRAG_AT, x: from.x + 60, y: from.y + 30, click: true },
          { t: DROP_AT, x: to.x + 60, y: to.y + 30 },
          { t: PROJECT_AT, x: 460, y: 400, click: true },
        ]}
      />
    </div>
  );
}
