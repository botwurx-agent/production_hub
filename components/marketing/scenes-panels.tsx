"use client";

import { GmailGlyph, SlackGlyph, ChatGlyph } from "@/components/communication/comms-ui";
import { GenreStill, type Genre } from "./genre-frames";
import {
  Avatar,
  Burst,
  Chip,
  Cursor,
  Window,
  arrive,
  easeOut,
  ramp,
  typed,
} from "./scene-kit";

/*
 * The scenes for the feature panels under the hero. Same contract as
 * scenes-hero.tsx: a 640x440 drawing, a pure function of t.
 */

/* -------------------------------------------------------------- STORYBOARD */

export const BOARD_MS = 8400;

type Frame = { key: string; genre: Genre };

// Six frames of a family spot, drawn as pencil first, then the final frame
// fades up over it: the "sketch to final" beat the operator agreed.
const FRAMES: Frame[] = [
  { key: "1A", genre: "family" },
  { key: "1B", genre: "profile" },
  { key: "2A", genre: "cafe" },
  { key: "2B", genre: "steps" },
  { key: "3A", genre: "interview" },
  { key: "3B", genre: "endcard" },
];

const SHOTS = [
  { desc: "Sunday morning on the sofa", size: "Wide", move: "Dolly in" },
  { desc: "Mum, still half asleep", size: "Close-up", move: "Static" },
  { desc: "Coffee at the window", size: "Medium", move: "Slider" },
  { desc: "The kids race outside", size: "Wide", move: "Handheld" },
  { desc: "Dad tells the story", size: "Medium", move: "Locked off" },
  { desc: "End card and logo", size: "Wide", move: "Locked off" },
];

const SKETCH_AT = (i: number) => 300 + i * 260;
const COLOR_AT = (i: number) => 2500 + i * 220;
const ROW_AT = (i: number) => 4200 + i * 280;
const LIST_DONE = 6400;

function FrameArt({ f, t, i, w = 136, h = 80 }: { f: Frame; t: number; i: number; w?: number; h?: number }) {
  const draw = easeOut(ramp(t, SKETCH_AT(i), 800));
  const color = ramp(t, COLOR_AT(i), 500);
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }}>
        <GenreStill genre={f.genre} sketch />
      </div>
      <div className="absolute inset-0" style={{ opacity: color }}>
        <GenreStill genre={f.genre} />
      </div>
    </div>
  );
}

export function StoryboardScene({ t }: { t: number }) {
  const listed = SHOTS.filter((_, i) => t >= ROW_AT(i)).length;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Storyboard · Sunday morning"
        sub="6 frames, sketch to final"
        right={
          t >= LIST_DONE ? (
            <Chip tone="green" t={t} since={LIST_DONE}>Shot list ready</Chip>
          ) : t >= COLOR_AT(0) ? (
            <Chip tone="purple" t={t} since={COLOR_AT(0)}>Final frames</Chip>
          ) : (
            <Chip tone="muted" t={t}>Pencils</Chip>
          )
        }
      >
        {/* Storyboard grid */}
        <div className="absolute grid grid-cols-2 gap-x-3 gap-y-2" style={{ left: 16, top: 66, width: 284 }}>
          {FRAMES.map((f, i) => (
            <div key={f.key}>
              <div className="relative overflow-hidden rounded-[8px] border border-border">
                <FrameArt f={f} t={t} i={i} />
                <span className="absolute left-1 top-1 rounded-[5px] bg-surface px-1 text-[9.5px] font-extrabold">{f.key}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow between the two */}
        <div className="absolute grid place-items-center" style={{ left: 304, top: 220, width: 24, height: 24, opacity: ramp(t, 4000, 300) }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Shot list, built from the board */}
        <div className="absolute" style={{ left: 332, top: 66, width: 292 }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">Shot list</p>
            <p className="text-[11px] font-bold tabular-nums text-text-muted">{listed} shots</p>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {SHOTS.map((s, i) =>
              t >= ROW_AT(i) ? (
                <div
                  key={i}
                  className="flex h-[50px] items-center gap-2 rounded-[9px] border border-border bg-surface px-1.5"
                  style={arrive(t, ROW_AT(i), 12)}
                >
                  <div className="overflow-hidden rounded-[5px] border border-border">
                    <FrameArt f={FRAMES[i]} t={t} i={i} w={54} h={32} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-bold">
                      <span style={{ color: "var(--accent)" }}>{FRAMES[i].key}</span> {s.desc}
                    </p>
                    <p className="truncate text-[10.5px] text-text-faint">
                      {s.size} · {s.move}
                    </p>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
        <Burst t={t} at={LIST_DONE} x={580} y={26} />
      </Window>
    </div>
  );
}

/* ---------------------------------------------------------------- SCHEDULE */

export const SCHEDULE_MS = 8800;

type SRow = { title: string; codes?: string; kind: string; dur: number; anchor?: number };
const KIND_HUE: Record<string, string> = { call: "indigo", setup: "blue", shot: "green", meal: "amber", wrap: "indigo" };

const BASE: SRow[] = [
  { title: "Crew call", kind: "call", dur: 30 },
  { title: "Set up the living room", kind: "setup", dur: 60 },
  { title: "The sofa, wide", codes: "1A 1B", kind: "shot", dur: 120 },
  { title: "Coffee at the window", codes: "2A 2B", kind: "shot", dur: 90 },
  { title: "Reset", kind: "setup", dur: 30 },
  { title: "Lunch", kind: "meal", dur: 60, anchor: 12 * 60 + 30 },
  { title: "Kids outside and end card", codes: "3A 3B", kind: "shot", dur: 240 },
  { title: "Wrap", kind: "wrap", dur: 30 },
];
// +15, +15 on the sofa, then -15, -15 at the window.
const CLICKS = [
  { at: 1300, row: 2, d: 15 },
  { at: 1900, row: 2, d: 15 },
  { at: 4500, row: 3, d: -15 },
  { at: 5100, row: 3, d: -15 },
];
const CALL = 7 * 60;
const ROW_H = 40;
const TOP = 66;

const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function ScheduleScene({ t }: { t: number }) {
  const rows = BASE.map((r, i) => ({
    ...r,
    dur: r.dur + CLICKS.filter((c) => c.row === i && t >= c.at).reduce((s, c) => s + c.d, 0),
  }));
  // The cascade: each row starts when the last ends, an anchor holds its time.
  let cursor = CALL;
  let overrun = 0;
  const starts = rows.map((r) => {
    if (r.anchor !== undefined) {
      overrun = Math.max(0, cursor - r.anchor);
      cursor = r.anchor;
    }
    const s = cursor;
    cursor += r.dur;
    return s;
  });
  const wrapEnd = cursor;
  const lastClick = CLICKS.filter((c) => t >= c.at).pop();
  const changedAt = lastClick?.at ?? -1e9;
  const risk = overrun > 0;
  const fixedAt = CLICKS[3].at;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Schedule · Day 1"
        sub={`Call 7:00 AM · Wrap target 6:00 PM · wraps ${clock(wrapEnd)}`}
        right={
          risk ? (
            <Chip tone="red" t={t} since={CLICKS[1].at}>Lunch at risk</Chip>
          ) : t >= fixedAt ? (
            <Chip tone="green" t={t} since={fixedAt}>On target</Chip>
          ) : (
            <Chip tone="green" t={t}>On target</Chip>
          )
        }
      >
        {rows.map((r, i) => {
          const hue = KIND_HUE[r.kind];
          const moved = i > 0 && t >= changedAt && t < changedAt + 700 && lastClick && i > lastClick.row && !(r.anchor !== undefined);
          const editable = i === 2 || i === 3;
          return (
            <div
              key={r.title}
              className="absolute flex items-center gap-3 border-b border-border px-4"
              style={{
                left: 0,
                top: TOP + i * ROW_H,
                width: 640,
                height: ROW_H,
                background: r.kind === "meal" && risk ? "color-mix(in oklch, var(--h-red) 7%, transparent)" : undefined,
              }}
            >
              <span
                className="w-[70px] text-[12px] font-bold tabular-nums"
                style={{ color: moved ? "var(--accent)" : "var(--text-muted)", transition: "color .4s" }}
              >
                {clock(starts[i])}
              </span>
              <span className="h-6 w-1 rounded-full" style={{ background: `var(--h-${hue})` }} />
              <span className="text-[13px] font-bold">{r.title}</span>
              {r.codes ? <span className="text-[11px] font-semibold text-text-faint">{r.codes}</span> : null}
              {r.anchor !== undefined ? (
                <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: "var(--h-amber)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" />
                  </svg>
                  Fixed 12:30
                </span>
              ) : null}
              {r.anchor !== undefined && risk ? (
                <span style={arrive(t, CLICKS[1].at, 4)}>
                  <Chip tone="red" t={t} since={CLICKS[1].at}>{overrun} min overrun</Chip>
                </span>
              ) : null}
              <span className="ml-auto flex items-center gap-1.5">
                {editable ? (
                  <span className="grid h-6 w-6 place-items-center rounded-[6px] border border-border text-[13px] font-bold text-text-muted">−</span>
                ) : null}
                <span
                  className="w-[62px] rounded-[6px] py-0.5 text-center text-[11.5px] font-bold tabular-nums"
                  style={{ background: "var(--surface-2)" }}
                >
                  {r.dur >= 60 ? `${Math.floor(r.dur / 60)}h${r.dur % 60 ? ` ${r.dur % 60}m` : ""}` : `${r.dur}m`}
                </span>
                {editable ? (
                  <span className="grid h-6 w-6 place-items-center rounded-[6px] border border-border text-[13px] font-bold text-text-muted">+</span>
                ) : null}
              </span>
            </div>
          );
        })}
        <div className="absolute flex items-center justify-between px-4" style={{ left: 0, top: TOP + 8 * ROW_H + 10, width: 640 }}>
          <span className="text-[11.5px] text-text-faint">Change one row and every time after it moves.</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: risk ? "var(--h-red)" : "var(--h-green)" }}>
            Wrap {clock(wrapEnd)}
          </span>
        </div>
        <Burst t={t} at={fixedAt} x={590} y={26} />
      </Window>
      <Cursor
        t={t}
        path={[
          { t: 700, x: 420, y: 300 },
          { t: CLICKS[0].at, x: 618, y: TOP + 2 * ROW_H + 20, click: true },
          { t: CLICKS[1].at, x: 618, y: TOP + 2 * ROW_H + 20, click: true },
          { t: 3600, x: 480, y: TOP + 5 * ROW_H + 20 },
          { t: CLICKS[2].at, x: 530, y: TOP + 3 * ROW_H + 20, click: true },
          { t: CLICKS[3].at, x: 530, y: TOP + 3 * ROW_H + 20, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------- COMMUNICATION */

export const COMMS_MS = 8800;

const MSGS = [
  {
    at: 500,
    svc: "gmail" as const,
    where: "Re: Hero spot, v3 cut",
    who: "Maya Torres",
    hue: "pink",
    text: "Looks great. Notes on the end card attached.",
    file: "EndCard_notes.pdf",
  },
  { at: 1600, svc: "slack" as const, where: "#bright-water", who: "Priya Shah", hue: "blue", text: "Lens test is up. The 50mm looks best." },
  { at: 2700, svc: "gchat" as const, where: "Bright Water agency", who: "Jon Kim", hue: "cyan", text: "Can we see the next cut by Friday?" },
];
const FILE_AT = 3900;
const REPLY_AT = 4800;
const REPLY = "Yes, v4 is with you Thursday.";
const SENT_AT = 6800;

const GLYPH = { gmail: GmailGlyph, slack: SlackGlyph, gchat: ChatGlyph };

export function CommsScene({ t }: { t: number }) {
  const unread = MSGS.filter((m) => t >= m.at).length - (t >= SENT_AT ? 3 : 0);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Communication · Bright Water"
        sub="Gmail, Slack and Google Chat, filed with the job"
        right={
          t >= SENT_AT ? (
            <Chip tone="green" t={t} since={SENT_AT}>All caught up</Chip>
          ) : (
            <Chip tone="indigo" t={t} since={MSGS[0].at}>{Math.max(0, unread)} unread</Chip>
          )
        }
      >
        <div className="absolute flex gap-2" style={{ left: 16, top: 64 }}>
          {[
            ["All", null],
            ["Email", GmailGlyph],
            ["Slack", SlackGlyph],
            ["Chat", ChatGlyph],
          ].map(([k, G], i) => {
            const Glyph = G as typeof GmailGlyph | null;
            return (
              <span
                key={k as string}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={{
                  borderColor: i === 0 ? "var(--accent)" : "var(--border)",
                  color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {Glyph ? <Glyph size={12} /> : null}
                {k as string}
              </span>
            );
          })}
        </div>

        <div className="absolute space-y-2" style={{ left: 16, top: 100, width: 608 }}>
          {MSGS.map((m) => {
            if (t < m.at) return null;
            const G = GLYPH[m.svc];
            const read = t >= SENT_AT;
            return (
              <div key={m.who} className="flex gap-3 rounded-[12px] border border-border bg-surface p-2.5" style={arrive(t, m.at, 14)}>
                <Avatar name={m.who} hue={m.hue} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold">{m.who}</span>
                    <span className="flex items-center gap-1 text-[10.5px] text-text-faint">
                      <G size={11} /> {m.where}
                    </span>
                    {!read ? <span className="ml-auto h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-muted">{typed(m.text, t, m.at + 200, 14)}</p>
                  {m.file && t >= m.at + 800 ? (
                    <div className="mt-1.5 flex items-center gap-2" style={arrive(t, m.at + 800, 4)}>
                      <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold">
                        <span className="text-[8.5px] font-black" style={{ color: "var(--h-red)" }}>PDF</span>
                        {m.file}
                      </span>
                      {t >= FILE_AT ? (
                        <Chip tone="green" t={t} since={FILE_AT}>Filed to documents</Chip>
                      ) : (
                        <span className="rounded-[8px] px-2 py-1 text-[11px] font-bold" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                          Add to documents
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply, from the project, sent through their Chat */}
        {t >= REPLY_AT - 300 ? (
          <div
            className="absolute rounded-[12px] border bg-surface px-3 py-2"
            style={{ left: 16, top: 352, width: 608, borderColor: "var(--accent)", ...arrive(t, REPLY_AT - 300, 12) }}
          >
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
              <ChatGlyph size={11} /> Reply to Jon, sends from your Google Chat
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 text-[13px] font-semibold">
                {t >= SENT_AT ? <span className="text-text-faint">Sent. The thread stays in Chat.</span> : typed(REPLY, t, REPLY_AT, 40)}
              </p>
              <span
                className="rounded-[8px] px-3 py-1 text-[11.5px] font-extrabold text-white"
                style={{ background: "var(--accent)", transform: `scale(${t >= SENT_AT - 100 && t < SENT_AT + 120 ? 0.92 : 1})` }}
              >
                Send
              </span>
            </div>
          </div>
        ) : null}
        <Burst t={t} at={SENT_AT} x={590} y={26} />
      </Window>
      <Cursor
        t={t}
        path={[
          { t: 3300, x: 420, y: 250 },
          { t: FILE_AT, x: 296, y: 180, click: true },
          { t: SENT_AT - 100, x: 598, y: 406, click: true },
        ]}
      />
    </div>
  );
}
