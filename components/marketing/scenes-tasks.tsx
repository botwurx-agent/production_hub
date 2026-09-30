"use client";

import type { ReactNode } from "react";
import { Art } from "./scenes-shotlist";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, spring, ramp, typed } from "./scene-kit";

/*
 * The task board and gear pages' chapter scenes (640x440, pure functions of
 * t). As shipped: a kanban of To do / In progress / Waiting / Done that can
 * also group by phase, cards with several people, named checklists, files
 * with image previews and notes, inviting from the picker with pending invites
 * named, crew seeing only their own tasks, a list view; and the gear list with
 * confirmed counts and studio-only day rates, props with options and a client
 * pick through the review portal.
 */

function Btn({ children, press, tone = "quiet", on }: { children: ReactNode; press?: boolean; tone?: "accent" | "quiet"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: tone === "accent" ? "var(--accent)" : on ? "var(--accent-soft)" : "var(--surface)",
        color: tone === "accent" ? "white" : on ? "var(--accent)" : "var(--text-muted)",
        border: tone === "accent" ? "none" : "1px solid var(--border)",
        transform: `scale(${press ? 0.93 : 1})`,
      }}
    >
      {children}
    </span>
  );
}

const COLS = [
  { k: "To do", hue: "blue" },
  { k: "In progress", hue: "indigo" },
  { k: "Waiting", hue: "amber" },
  { k: "Done", hue: "green" },
];
const COLW = 146;
const colX = (i: number) => 16 + i * (COLW + 8);

function TaskCard({ title, people, due, check, img, lit, style }: { title: string; people: string[]; due?: string; check?: string; img?: number; lit?: boolean; style?: React.CSSProperties }) {
  return (
    <div className="rounded-[10px] border bg-surface p-2" style={{ borderColor: lit ? "var(--accent)" : "var(--border)", boxShadow: lit ? "0 16px 34px -14px rgba(40,30,90,.5)" : undefined, ...style }}>
      {img !== undefined ? <div className="relative mb-1.5 h-[34px] overflow-hidden rounded-[6px]"><Art i={img} /></div> : null}
      <p className="text-[11.5px] font-bold leading-tight">{title}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="flex gap-0.5">{people.map((p, i) => <Avatar key={p} name={p} hue={["blue", "amber", "green", "pink"][i % 4]} size={16} />)}</span>
        {check ? <span className="text-[9.5px] font-bold text-text-faint">☑ {check}</span> : null}
        {due ? <span className="ml-auto text-[9.5px] font-bold" style={{ color: due.startsWith("Over") ? "var(--h-red)" : "var(--text-faint)" }}>{due}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ BOARD */

export const TK_BOARD_MS = 12500;

const MOVES = [
  { at: 1200, dur: 1000, from: [0, 1], to: [1, 1] },
  { at: 4000, dur: 1000, from: [1, 1], to: [2, 0] },
];
const PHASE_AT = 7400;

export function TaskBoardScene({ t }: { t: number }) {
  const phase = t >= PHASE_AT;
  const cards = [
    { id: "a", title: "Book the Culver stage", people: ["Kim Ade"], due: "Oct 2", col: 3 },
    { id: "b", title: "Source hero glassware", people: ["Ava Brooks", "Kim Ade"], check: "2/5", col: t >= MOVES[0].at + MOVES[0].dur ? 1 : 0, img: 2 },
    { id: "c", title: "Permit for the porch", people: ["Sam Ortiz"], due: "Overdue", col: 0 },
    { id: "d", title: "Casting callbacks", people: ["Dana Reyes"], col: 1 },
    { id: "e", title: "Client sign-off on boards", people: ["Kim Ade"], col: t >= MOVES[1].at + MOVES[1].dur ? 2 : 1, due: "Oct 4" },
    { id: "f", title: "Lock the shot list", people: ["Dana Reyes", "Sam Ortiz"], col: 3 },
  ];
  const phaseCols = ["Pre-production", "Production", "Post", "Anytime"];
  const phaseOf: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  const byCol = (c: number) => cards.filter((x) => (phase ? phaseOf[x.id] === c && c < 1 ? true : false : x.col === c));
  const drag = MOVES.find((m) => t >= m.at && t < m.at + m.dur);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Tasks · Bright Water" sub="Who is on it, and what is waiting" right={<span className="flex gap-1"><Btn on={!phase}>Status</Btn><Btn on={phase} press={t >= PHASE_AT - 60 && t < PHASE_AT + 80}>Phase</Btn></span>}>
        {(phase ? phaseCols : COLS.map((c) => c.k)).map((k, i) => {
          const hue = phase ? ["indigo", "green", "purple", "blue"][i] : COLS[i].hue;
          const list = phase ? (i === 0 ? cards.filter((c) => c.id !== "f" && c.id !== "a") : i === 3 ? cards.filter((c) => c.id === "a" || c.id === "f") : []) : byCol(i);
          return (
            <div key={k} className="absolute rounded-[12px] bg-surface-2 p-1.5" style={{ left: colX(i), top: 62, width: COLW, height: 362, borderTop: `3px solid var(--h-${hue})` }}>
              <p className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-extrabold">{k}<span className="text-text-faint">{list.length}</span></p>
              <div className="space-y-1.5">
                {list.map((c) => {
                  const isDrag = drag && ((drag === MOVES[0] && c.id === "b") || (drag === MOVES[1] && c.id === "e"));
                  return <TaskCard key={c.id} {...c} style={{ opacity: isDrag ? 0.25 : 1, ...(phase ? arrive(t, PHASE_AT, 6) : {}) }} />;
                })}
              </div>
            </div>
          );
        })}
        {drag ? (() => {
          const card = drag === MOVES[0] ? cards[1] : cards[4];
          const p = dragAt(t, drag.at, drag.dur, { x: colX(drag.from[0]) + 6, y: 62 + 24 + drag.from[1] * 70 }, { x: colX(drag.to[0]) + 6, y: 62 + 24 + drag.to[1] * 70 });
          return <div className="absolute" style={{ left: p.x, top: p.y, width: COLW - 12, transform: "rotate(-2deg)", zIndex: 5 }}><TaskCard {...card} lit /></div>;
        })() : null}
        <Burst t={t} at={MOVES[1].at + MOVES[1].dur} x={colX(2) + 70} y={100} />
      </Window>
      <ActionLabel t={t} at={MOVES[0].at} x={colX(0) + 60} y={120} text="Drag to In progress" after={1200} />
      <ActionLabel t={t} at={MOVES[1].at} x={colX(1) + 60} y={200} text="Waiting on the client" tone="amber" after={1400} />
      <ActionLabel t={t} at={PHASE_AT} x={430} y={20} text="Or group by phase of the job" tone="indigo" after={1800} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 400 },
          { t: MOVES[0].at, x: colX(0) + 70, y: 62 + 50 + 70, click: true },
          { t: MOVES[0].at + MOVES[0].dur, x: colX(1) + 70, y: 62 + 50 + 70 },
          { t: MOVES[1].at, x: colX(1) + 70, y: 62 + 50 + 70, click: true },
          { t: MOVES[1].at + MOVES[1].dur, x: colX(2) + 70, y: 62 + 50 },
          { t: PHASE_AT, x: 600, y: 26, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- CARD */

export const TK_CARD_MS = 13000;

const PEOPLE_AT = 1000;
const LIST_AT = 2600;
const TICKS = [4000, 4600];
const FILE_AT = 5800;
const NOTE_AT = 7600;

export function TaskCardScene({ t }: { t: number }) {
  const items = ["Thick-base tumblers x6", "Two backup bottles", "Linen in warm grey"];
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Source hero glassware" sub="Tasks · Bright Water · Pre-production" right={<Chip tone="indigo" t={t}>In progress</Chip>}>
        <div className="absolute" style={{ left: 16, top: 64, width: 380 }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">People</p>
          <div className="mt-1 flex items-center gap-1.5">
            {["Ava Brooks", "Kim Ade", ...(t >= PEOPLE_AT + 500 ? ["Theo Lin"] : [])].map((n, i) => (
              <span key={n} className="flex items-center gap-1 rounded-full border border-border py-0.5 pl-0.5 pr-2 text-[11px] font-semibold" style={i === 2 ? arrive(t, PEOPLE_AT + 500, 4) : undefined}>
                <Avatar name={n} hue={["pink", "indigo", "orange"][i]} size={18} />{n}
              </span>
            ))}
            <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-border text-[12px] text-text-faint">+</span>
          </div>
          <p className="mt-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Checklists</p>
          <div className="mt-1 rounded-[10px] border border-border p-2">
            <p className="text-[11.5px] font-extrabold">{t >= LIST_AT ? typed("Glassware", t, LIST_AT, 60) : "Steps"}</p>
            {items.map((it, i) => {
              const done = i < 2 && t >= TICKS[i];
              return (
                <div key={it} className="mt-1 flex items-center gap-2 text-[11.5px]">
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: done ? "var(--h-green)" : "transparent", borderColor: done ? "var(--h-green)" : "var(--border-strong)", transform: done ? `scale(${spring(ramp(t, TICKS[i], 380))})` : undefined }}>{done ? "✓" : ""}</span>
                  <span style={{ textDecoration: done ? "line-through" : undefined, color: done ? "var(--text-faint)" : undefined }}>{it}</span>
                </div>
              );
            })}
            <p className="mt-1.5 text-[10px] font-bold" style={{ color: "var(--accent)" }}>+ Add another checklist</p>
          </div>
          <p className="mt-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Notes</p>
          <div className="mt-1 space-y-1.5">
            {t >= NOTE_AT ? (
              <div className="flex gap-2 rounded-[10px] bg-surface-2 p-2" style={arrive(t, NOTE_AT, 6)}>
                <Avatar name="Ava Brooks" hue="pink" size={20} />
                <p className="text-[11.5px]"><b>Ava</b> <span className="text-text-muted">{typed("Prop house has the tumblers, holding them till Friday.", t, NOTE_AT + 200, 26)}</span></p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="absolute" style={{ left: 412, top: 64, width: 212 }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Due</p>
          <p className="mt-1 text-[12.5px] font-bold">Fri, Oct 3</p>
          <p className="mt-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Files</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {[2, 0].map((k, i) => (
              <div key={k} className="relative h-[60px] overflow-hidden rounded-[7px] border border-border" style={i === 1 ? (t >= FILE_AT ? arrive(t, FILE_AT, 6) : { opacity: 0 }) : undefined}><Art i={k} /></div>
            ))}
          </div>
          <p className="mt-1 text-[10.5px] text-text-faint">Images show on the card itself.</p>
          <div className="mt-3 w-[160px]">
            <TaskCard title="Source hero glassware" people={["Ava Brooks", "Kim Ade", "Theo Lin"]} check={`${Math.min(2, TICKS.filter((x) => t >= x).length)}/3`} img={2} due="Oct 3" />
          </div>
        </div>
      </Window>
      <ActionLabel t={t} at={PEOPLE_AT} x={260} y={80} text="More than one person on it" />
      <ActionLabel t={t} at={LIST_AT} x={140} y={160} text="Named checklists" tone="green" after={2600} />
      <ActionLabel t={t} at={FILE_AT} x={430} y={190} text="Reference photos on the card" tone="blue" after={1200} />
      <ActionLabel t={t} at={NOTE_AT} x={200} y={320} text="Notes in the thread" tone="pink" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 400 },
          { t: PEOPLE_AT, x: 256, y: 86, click: true },
          { t: LIST_AT, x: 60, y: 146, click: true },
          { t: TICKS[0], x: 42, y: 166, click: true },
          { t: TICKS[1], x: 42, y: 186, click: true },
          { t: FILE_AT, x: 580, y: 150, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- PEOPLE */

export const TK_PEOPLE_MS = 12500;

const PICK_AT = 900;
const INV_AT = 2200;
const SENT_AT = 3800;
const CREW_AT = 6200;

export function TaskPeopleScene({ t }: { t: number }) {
  const crew = t >= CREW_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={crew ? "Tasks · as Leo Park sees them" : "Tasks · Bright Water"} sub={crew ? "Collaborator: only the tasks assigned to him" : "Need someone who isn't here yet?"} right={crew ? <Chip tone="muted" t={t} since={CREW_AT}>Crew view</Chip> : <Chip tone="indigo" t={t}>6 tasks</Chip>}>
        {!crew ? (
          <div className="absolute" style={{ left: 16, top: 66, width: 608 }}>
            <div className="w-[260px]"><TaskCard title="Rig the practicals" people={["Sam Ortiz"]} due="Oct 5" /></div>
            {t >= PICK_AT ? (
              <div className="mt-2 w-[300px] rounded-[12px] border border-border bg-surface p-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={arrive(t, PICK_AT, 6)}>
                <p className="px-1 pb-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Assign</p>
                {["Sam Ortiz", "Kim Ade", "Dana Reyes"].map((n, i) => (
                  <div key={n} className="flex items-center gap-2 rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold">
                    <Avatar name={n} hue={["green", "indigo", "purple"][i]} size={18} />{n}
                  </div>
                ))}
                {t >= SENT_AT ? (
                  <div className="flex items-center gap-2 rounded-[7px] px-1.5 py-1 text-[11.5px] text-text-faint" style={arrive(t, SENT_AT, 4)}>
                    <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-dashed border-border text-[9px]">L</span>leo@parklighting.com · invited, can be assigned once they accept
                  </div>
                ) : null}
                <p className="mt-1 px-1.5 text-[11px] font-bold" style={{ color: "var(--accent)", transform: `scale(${t >= INV_AT - 60 && t < INV_AT + 80 ? 0.95 : 1})` }}>+ Invite someone</p>
              </div>
            ) : null}
            {t >= INV_AT && t < SENT_AT + 300 ? (
              <div className="absolute rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 300, top: 60, width: 300, ...arrive(t, INV_AT, 8) }}>
                <p className="text-[12.5px] font-extrabold">Invite to Bright Water</p>
                <div className="mt-2 h-[28px] rounded-[7px] border px-2 text-[12px] font-semibold leading-[26px]" style={{ borderColor: "var(--accent)" }}>{typed("leo@parklighting.com", t, INV_AT + 300, 50)}</div>
                <div className="mt-2 flex justify-end"><Btn tone="accent" press={t >= SENT_AT - 60}>Send invite</Btn></div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="absolute" style={{ left: 16, top: 66, width: 608, ...arrive(t, CREW_AT, 10) }}>
            <div className="grid grid-cols-2 gap-3">
              <TaskCard title="Rig the practicals" people={["Leo Park", "Sam Ortiz"]} due="Oct 5" />
              <TaskCard title="Test the 50mm with the DP" people={["Leo Park"]} due="Oct 4" check="1/3" />
            </div>
            {t >= CREW_AT + 1800 ? (
              <div className="mt-3 w-[300px]" style={arrive(t, CREW_AT + 1800, 8)}>
                <TaskCard title={typed("Order two extra stands", t, CREW_AT + 2000, 45) || " "} people={["Leo Park"]} lit />
              </div>
            ) : null}
            <p className="mt-3 text-[11px] text-text-faint">Crew see the tasks assigned to them, and anything they add is assigned to them, so the rest of the producer's list stays the producer's.</p>
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={INV_AT} x={120} y={230} text="Invite them from right here" />
      <ActionLabel t={t} at={SENT_AT} x={320} y={220} text="Named until they accept" tone="muted" after={1600} />
      <ActionLabel t={t} at={CREW_AT + 600} x={200} y={150} text="Crew see only their own tasks" tone="indigo" after={1500} />
      <ActionLabel t={t} at={CREW_AT + 2200} x={320} y={220} text="And can add their own" tone="green" after={1500} />
      <Cursor t={t} travel={650} path={[{ t: 300, x: 320, y: 400 }, { t: PICK_AT, x: 200, y: 110, click: true }, { t: INV_AT, x: 70, y: 244, click: true }, { t: SENT_AT, x: 560, y: 150, click: true }]} />
    </div>
  );
}

/* ------------------------------------------------------------------- LIST */

export const TK_LIST_MS = 10500;

const LIST_SWITCH = 900;

export function TaskListScene({ t }: { t: number }) {
  const list = t >= LIST_SWITCH;
  const rows = [
    { s: "To do", hue: "blue", items: [["Permit for the porch", "Overdue", "Sam Ortiz"], ["Confirm catering count", "Today", "Kim Ade"]] },
    { s: "In progress", hue: "indigo", items: [["Source hero glassware", "Oct 3", "Ava Brooks"], ["Casting callbacks", "Oct 4", "Dana Reyes"]] },
    { s: "Waiting", hue: "amber", items: [["Client sign-off on boards", "Oct 4", "Kim Ade"]] },
  ];
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Tasks · Bright Water" sub="The same cards, as a list for mornings and phones" right={<span className="flex gap-1"><Btn on={!list}>Board</Btn><Btn on={list} press={t >= LIST_SWITCH - 60 && t < LIST_SWITCH + 80}>List</Btn></span>}>
        {list ? (
          <div className="absolute" style={{ left: 16, top: 62, width: 608 }}>
            {rows.map((r, gi) => (
              <div key={r.s} className="mb-2" style={arrive(t, LIST_SWITCH + gi * 250, 6)}>
                <p className="flex items-center gap-2 text-[11.5px] font-extrabold"><span className="h-2 w-2 rounded-full" style={{ background: `var(--h-${r.hue})` }} />{r.s}</p>
                {r.items.map(([n, d, p]) => (
                  <div key={n} className="mt-1 flex items-center gap-3 rounded-[9px] border border-border bg-surface px-3 py-2">
                    <span className="h-4 w-4 rounded-[4px] border border-border-strong" style={{ borderColor: "var(--border-strong)" }} />
                    <span className="flex-1 text-[12px] font-semibold">{n}</span>
                    <Avatar name={p} hue="indigo" size={20} />
                    <span className="w-[64px] text-right text-[11px] font-bold" style={{ color: d === "Overdue" ? "var(--h-red)" : d === "Today" ? "var(--h-amber)" : "var(--text-faint)" }}>{d}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={LIST_SWITCH} x={560} y={20} text="Switch to the list" />
      <ActionLabel t={t} at={3600} x={420} y={100} text="Overdue in red, due today in amber" tone="red" after={2000} />
      <ActionLabel t={t} at={6600} x={200} y={380} text="On the project's front page too" tone="indigo" after={1800} />
      <Cursor t={t} travel={650} path={[{ t: 300, x: 320, y: 400 }, { t: LIST_SWITCH, x: 596, y: 26, click: true }]} />
    </div>
  );
}

/* ================================================================== GEAR */

export const GR_LIST_MS = 12000;

const GEAR = [
  { cat: "Camera", items: [["ARRI Alexa 35 kit", 1, 2400], ["Signature Prime set", 1, 1100]] },
  { cat: "Lighting", items: [["SkyPanel S60", 4, 180], ["Litemat 4", 2, 120]] },
  { cat: "Grip", items: [["C-stand", 12, 12], ["Dolly + track", 1, 450]] },
];
const CONFIRM = [900, 1500, 2100, 2700, 3300];
const RATE_AT = 5200;
const CREW_VIEW = 7600;

export function GearListScene({ t }: { t: number }) {
  const flat = GEAR.flatMap((g) => g.items.map((i) => ({ cat: g.cat, n: i[0] as string, q: i[1] as number, r: i[2] as number })));
  const confirmed = (i: number) => i < CONFIRM.length && t >= CONFIRM[i];
  const nConf = flat.filter((_, i) => confirmed(i)).length;
  const crew = t >= CREW_VIEW;
  const total = flat.reduce((s, x) => s + x.q * x.r, 0);
  let idx = -1;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={crew ? "Gear · as crew see it" : "Gear · Bright Water"} sub={crew ? "Signed in as a collaborator" : "The kit list, and what it costs a day"} right={<Chip tone={nConf === flat.length ? "green" : "blue"} t={t}>{nConf}/{flat.length} confirmed</Chip>}>
        <div className="absolute" style={{ left: 16, top: 60, width: 608 }}>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(nConf / flat.length) * 100}%`, background: "var(--h-green)", transition: "width .4s" }} /></div>
          {GEAR.map((g) => (
            <div key={g.cat} className="mb-1.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">{g.cat}</p>
              {g.items.map((it) => {
                idx += 1;
                const i = idx;
                return (
                  <div key={it[0] as string} className="flex h-[30px] items-center gap-3 border-b border-border text-[12px]">
                    <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: confirmed(i) ? "var(--h-green)" : "transparent", borderColor: confirmed(i) ? "var(--h-green)" : "var(--border-strong)" }}>{confirmed(i) ? "✓" : ""}</span>
                    <span className="w-[26px] text-right font-bold tabular-nums text-text-muted">{it[1] as number}×</span>
                    <span className="flex-1 font-semibold">{it[0] as string}</span>
                    {!crew ? (
                      <>
                        <span className="w-[70px] text-right text-[11px] tabular-nums text-text-faint" style={t >= RATE_AT - 300 && t < RATE_AT + 1200 ? { color: "var(--accent)" } : undefined}>${(it[2] as number).toLocaleString("en-US")}/day</span>
                        <span className="w-[70px] text-right font-bold tabular-nums">${((it[1] as number) * (it[2] as number)).toLocaleString("en-US")}</span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
          {!crew ? (
            <p className="mt-1 text-right text-[12px] font-extrabold tabular-nums" style={arrive(t, RATE_AT, 4)}>Kit total ${total.toLocaleString("en-US")}/day</p>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-[11.5px] font-semibold text-text-muted" style={arrive(t, CREW_VIEW, 4)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Crew see the kit and what is confirmed. Never the rates.
            </p>
          )}
        </div>
      </Window>
      <ActionLabel t={t} at={CONFIRM[0]} x={250} y={112} text="Tick it when it's booked" tone="green" after={2500} />
      <ActionLabel t={t} at={RATE_AT} x={430} y={110} text="Day rates, and the kit's daily total" tone="blue" after={1500} />
      <ActionLabel t={t} at={CREW_VIEW + 300} x={200} y={380} text="Rates stay with the studio" tone="red" after={2000} />
      <Cursor t={t} travel={600} path={[{ t: 400, x: 320, y: 400 }, ...CONFIRM.map((c, i) => ({ t: c, x: 24, y: 60 + 12 + 18 + Math.floor(i / 2) * 18 + i * 30 + 8, click: true }))]} />
    </div>
  );
}

/* ---------------------------------------------------------------- PROPS */

export const GR_PROPS_MS = 12500;

const OPTS = [
  { at: 1200, k: 2, src: "Photo from the prop house" },
  { at: 2400, k: 6, src: "propfinder.com/listing/tumbler" },
  { at: 3600, k: 4, src: "Photo from the prop house" },
];
const PICK2 = 6000;
const SEND2 = 8000;

export function GearPropsScene({ t }: { t: number }) {
  const picked = t >= PICK2;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Props · Bright Water" sub="Options for each prop, and one pick" right={<Btn on={t >= SEND2 - 300} press={t >= SEND2 - 60 && t < SEND2 + 80}>{t >= SEND2 ? "Sent for review ✓" : "Send for review"}</Btn>}>
        <div className="absolute" style={{ left: 16, top: 64, width: 608 }}>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-extrabold">Hero tumbler</p>
            <span className="text-[11px] text-text-faint">Tableware · for shots 2A, 2B</span>
            <span className="ml-auto">{picked ? <Chip tone="green" t={t} since={PICK2}>Picked</Chip> : <Chip tone="amber" t={t} since={OPTS[0].at}>Options in</Chip>}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {OPTS.map((o, i) =>
              t >= o.at ? (
                <div key={i} className="overflow-hidden rounded-[12px] border bg-surface" style={{ borderColor: picked && i === 1 ? "var(--h-green)" : "var(--border)", boxShadow: picked && i === 1 ? "0 0 0 3px color-mix(in oklch, var(--h-green) 30%, transparent)" : undefined, ...arrive(t, o.at, 10) }}>
                  <div className="relative h-[110px]"><Art i={o.k} /><span className="absolute left-1.5 top-1.5 rounded-[5px] bg-surface px-1 text-[10px] font-extrabold">Option {i + 1}</span></div>
                  <div className="p-2">
                    <p className="truncate text-[10.5px] text-text-faint">{o.src}</p>
                    {picked && i === 1 ? <p className="mt-0.5 text-[11px] font-extrabold" style={{ color: "var(--h-green)" }}>The one</p> : null}
                  </div>
                </div>
              ) : (
                <div key={i} className="grid h-[150px] place-items-center rounded-[12px] border border-dashed border-border text-[11px] text-text-faint">+ Photo or link</div>
              ),
            )}
          </div>
          <div className="mt-4 space-y-1.5">
            {[
              ["Linen napkins", "Booked", "purple", 2],
              ["Marble board", "Needed", "red", 0],
              ["Glass carafe", "Options in", "amber", 3],
            ].map(([n, s, tone, c]) => (
              <div key={n as string} className="flex items-center gap-3 rounded-[9px] border border-border px-3 py-2">
                <span className="flex-1 text-[12px] font-bold">{n as string}</span>
                <span className="text-[11px] text-text-faint">{c as number} options</span>
                <Chip tone={tone as "green"} t={t}>{s as string}</Chip>
              </div>
            ))}
          </div>
        </div>
      </Window>
      <ActionLabel t={t} at={OPTS[0].at} x={120} y={150} text="Add the options you found" after={2600} />
      <ActionLabel t={t} at={OPTS[1].at} x={330} y={200} text="Photos or prop-house links" tone="blue" after={1300} />
      <ActionLabel t={t} at={PICK2} x={330} y={150} text="Pick the one" tone="green" after={1300} />
      <ActionLabel t={t} at={SEND2} x={520} y={20} text="Or let the client choose" tone="pink" after={1800} />
      <Cursor t={t} travel={650} path={[{ t: 400, x: 320, y: 400 }, ...OPTS.map((o, i) => ({ t: o.at, x: 90 + i * 206, y: 160, click: true })), { t: PICK2, x: 310, y: 150, click: true }, { t: SEND2, x: 560, y: 26, click: true }]} />
    </div>
  );
}

/* --------------------------------------------------------------- CLIENT PICK */

export const GR_PICK_MS = 12000;

const PIN_AT2 = 1600;
const PIN_AT3 = 3600;
const APPROVE2 = 6200;

export function GearPickScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="studio-flows.com/r/… · Props review" sub="Maya at Bright Water · no login" right={t >= APPROVE2 ? <Chip tone="green" t={t} since={APPROVE2}>Approved</Chip> : <Chip tone="amber" t={t}>Waiting on you</Chip>}>
        <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 66, width: 400 }}>
          {[2, 6, 4, 1, 5, 3].map((k, i) => (
            <div key={i}>
              <div className="relative h-[82px] overflow-hidden rounded-[8px] border border-border"><Art i={k} /><span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">{i < 3 ? `Tumbler ${i + 1}` : ["Napkin", "Board", "Carafe"][i - 3]}</span></div>
            </div>
          ))}
        </div>
        {[
          { n: 1, x: 118, y: 108, at: PIN_AT2 },
          { n: 2, x: 250, y: 108, at: PIN_AT3 },
        ].map((p) => {
          const s = spring(ramp(t, p.at, 480));
          return s > 0 ? <span key={p.n} className="absolute grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white" style={{ left: p.x - 14, top: p.y - 14, transform: `scale(${s})`, background: t >= APPROVE2 ? "var(--h-green)" : "var(--accent)", boxShadow: "0 0 0 3px white" }}>{p.n}</span> : null;
        })}
        <div className="absolute space-y-2" style={{ left: 432, top: 66, width: 192 }}>
          {[
            { n: 1, text: "Too heavy for the pour shot.", at: PIN_AT2 },
            { n: 2, text: "This one. Love the base.", at: PIN_AT3 },
          ].map((c) =>
            t >= c.at ? (
              <div key={c.n} className="rounded-[10px] border border-border bg-surface p-2" style={arrive(t, c.at + 60, 6)}>
                <p className="text-[11px] font-bold">{c.n} · Maya</p>
                <p className="text-[11.5px] text-text-muted">{typed(c.text, t, c.at + 250, 24)}</p>
              </div>
            ) : null,
          )}
          <Btn tone="accent" press={t >= APPROVE2 - 60 && t < APPROVE2 + 120}>{t >= APPROVE2 ? "Approved ✓" : "Approve props"}</Btn>
        </div>
        <Burst t={t} at={APPROVE2} x={480} y={240} />
      </Window>
      <ActionLabel t={t} at={PIN_AT3} x={250} y={108} text="“The second one”, pinned" tone="pink" after={1400} />
      <ActionLabel t={t} at={APPROVE2} x={440} y={250} text="Signed off in the same link" tone="green" after={1600} />
      <Cursor t={t} travel={650} path={[{ t: 400, x: 320, y: 400 }, { t: PIN_AT2, x: 120, y: 110, click: true }, { t: PIN_AT3, x: 252, y: 110, click: true }, { t: APPROVE2, x: 480, y: 232, click: true }]} />
    </div>
  );
}
