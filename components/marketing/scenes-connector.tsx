"use client";

import type { CSSProperties, ReactNode } from "react";
import { ActionLabel, Chip, Cursor, Window, arrive, ramp, typed, usd, roll } from "./scene-kit";
import { CHAT_W, ChatPanel } from "./scenes-assistant";
import { GenreStill, type Genre } from "./genre-frames";

/**
 * The assistant page's scenes: a producer talking to their own Claude, with
 * Studio Flows connected, and the work landing in Studio Flows.
 *
 * Every scene is the same two halves, because that IS the feature: the chat
 * on the left (their words, the tool that ran, the answer and its link) and
 * the real page on the right filling in row by row. Each scene shows only
 * something the connector does today (lib/connector.ts), and what lands is
 * always something ADDED: nothing here is changed, deleted or sent.
 */

const WIN = { title: "Your Claude chat", sub: "Studio Flows connected" };

/** When the tool chip appears: after the ask has finished typing. */
const toolAfter = (ask: string, askAt: number) => askAt + ask.length * 18 + 450;

/** The Studio Flows page on the right. */
function Page({ title, sub, right, children }: { title: string; sub: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="absolute overflow-hidden rounded-[14px] border border-border bg-surface" style={{ left: CHAT_W + 14, top: 66, width: 640 - CHAT_W - 28, height: 360 }}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[12px] font-extrabold">{title}</span>
        <span className="text-[10px] text-text-faint">{sub}</span>
        <span className="ml-auto">{right}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 py-2.5" style={{ top: 33 }}>
        {children}
      </div>
    </div>
  );
}

const land = (t: number, at: number): CSSProperties => (t >= at ? arrive(t, at, 6) : { opacity: 0 });

function Still({ genre, w, h, sketch }: { genre: Genre; w: number; h: number; sketch?: boolean }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-[5px] border border-border" style={{ width: w, height: h }}>
      <GenreStill genre={genre} sketch={sketch} />
    </span>
  );
}

/* ------------------------------------------------------------ SHOT LIST */

export const CX_HERO_MS = 16000;

const H_ASK = 500;
const HERO_ASK = "Here is the First Light script. Break it into a shot list for the two shoot days, sizes and moves included.";
const H_TOOL = toolAfter(HERO_ASK, H_ASK);
const SHOTS: { code: string; desc: string; size: string; move: string; g: Genre }[] = [
  { code: "1A", desc: "Dawn, a runner on the ridge", size: "Wide", move: "Drone push", g: "runner" },
  { code: "1B", desc: "The shoe hits the trail", size: "Insert", move: "Static", g: "shoe" },
  { code: "1C", desc: "Her breath in the cold", size: "Close-up", move: "Handheld", g: "profile" },
  { code: "2A", desc: "Up the city steps", size: "Medium", move: "Track", g: "steps" },
  { code: "2B", desc: "Coffee with a friend", size: "Two shot", move: "Slow push", g: "cafe" },
  { code: "2C", desc: "End card", size: "Graphic", move: "Static", g: "endcard" },
];
const H_ROW0 = H_TOOL + 500;
const H_STEP = 520;
const H_DONE = H_ROW0 + SHOTS.length * H_STEP + 300;

export function ConnectorHeroScene({ t }: { t: number }) {
  const n = SHOTS.filter((_, i) => t >= H_ROW0 + i * H_STEP).length;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window {...WIN}>
        <ChatPanel
          t={t}
          ask={HERO_ASK}
          askAt={H_ASK}
          tool="add_shots"
          toolAt={H_TOOL}
          doneAt={H_DONE}
          answer="Six shots are on the list, split across Day 1 and Day 2, each with its size and movement."
          linkLabel="Open the shot list"
        />
        <Page title="Shot list" sub="First Light" right={<span className="text-[10px] font-bold text-text-muted">{n} shots</span>}>
          <div className="mb-1.5 flex gap-2 text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint">
            <span style={{ width: 46 }} />
            <span style={{ width: 22 }}>No.</span>
            <span className="flex-1">Description</span>
            <span style={{ width: 56 }}>Size</span>
            <span style={{ width: 62 }}>Movement</span>
          </div>
          <div className="space-y-1.5">
            {SHOTS.map((s, i) => (
              <div key={s.code} className="flex items-center gap-2 rounded-[8px] border border-border px-1.5 py-1.5 text-[10.5px]" style={land(t, H_ROW0 + i * H_STEP)}>
                <Still genre={s.g} w={46} h={28} />
                <span className="font-extrabold" style={{ width: 22 }}>{s.code}</span>
                <span className="min-w-0 flex-1 truncate">{s.desc}</span>
                <span className="text-text-muted" style={{ width: 56 }}>{s.size}</span>
                <span className="text-text-muted" style={{ width: 62 }}>{s.move}</span>
              </div>
            ))}
          </div>
        </Page>
      </Window>
      <ActionLabel t={t} at={H_ASK + 300} x={20} y={150} text="Ask in your own words" before={300} after={2200} />
      <ActionLabel t={t} at={H_ROW0 + 400} x={330} y={150} text="Rows land in Studio Flows" tone="green" before={100} after={2600} />
      <ActionLabel t={t} at={H_DONE + 2600} x={60} y={300} text="One link to check it" tone="blue" before={200} after={2600} />
    </div>
  );
}

/* ------------------------------------------------------------------ ASK */

export const CX_ASK_MS = 14000;

const A_ASK = 500;
const ASK_ASK = "Where does Bright Water stand, and who do we still owe?";
const A_TOOL = toolAfter(ASK_ASK, A_ASK);
const A_F = [A_TOOL + 500, A_TOOL + 1100, A_TOOL + 1700, A_TOOL + 2300];
const A_DONE = A_TOOL + 3000;

function Fact({ t, at, label, children, dot }: { t: number; at: number; label: string; children: ReactNode; dot: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[9px] border border-border px-2.5 py-2" style={land(t, at)}>
      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-wide text-text-faint">{label}</p>
        <p className="text-[11.5px] font-semibold leading-snug">{children}</p>
      </div>
    </div>
  );
}

export function ConnectorAskScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window {...WIN}>
        <ChatPanel
          t={t}
          ask={ASK_ASK}
          askAt={A_ASK}
          tool="get_project · get_money"
          toolAt={A_TOOL}
          doneAt={A_DONE}
          answer="In post. The hero cut has waited four days on the client. You owe $6,400 across two vendors, one due Friday."
          linkLabel="Open the project"
        />
        <Page title="Bright Water, hero spot" sub="Read from your studio">
          <div className="space-y-2">
            <Fact t={t} at={A_F[0]} label="Stage" dot="var(--h-blue)">Post, delivery due Nov 28</Fact>
            <Fact t={t} at={A_F[1]} label="Waiting on the client" dot="var(--h-amber)">Hero cut v3, sent four days ago, no answer yet</Fact>
            <Fact t={t} at={A_F[2]} label="Still owed" dot="var(--h-red)">
              {usd(Math.round(roll(0, 6400, t, A_F[2], 700)))} to 2 vendors, {usd(2400)} due Friday
            </Fact>
            <Fact t={t} at={A_F[3]} label="Margin so far" dot="var(--h-green)">31% on {usd(84000)} billed</Fact>
          </div>
        </Page>
      </Window>
      <ActionLabel t={t} at={A_F[0]} x={330} y={110} text="The same numbers the pages show" tone="blue" before={100} after={3000} />
    </div>
  );
}

/* ----------------------------------------------------------- STORYBOARD */

export const CX_BOARDS_MS = 15000;

const B_ASK = 500;
const BOARDS_ASK = "Make a storyboard for the family spot from these six frames I just generated.";
const B_TOOL = toolAfter(BOARDS_ASK, B_ASK);
const FRAMES: { g: Genre; d: string }[] = [
  { g: "family", d: "Sunday, the sofa" },
  { g: "pour", d: "The pour" },
  { g: "chef", d: "Dad at the stove" },
  { g: "cafe", d: "Two friends arrive" },
  { g: "interview", d: "Gran tells the story" },
  { g: "endcard", d: "End card" },
];
const B_F0 = B_TOOL + 500;
const B_STEP = 650;
const B_DONE = B_F0 + FRAMES.length * B_STEP + 300;

export function ConnectorBoardsScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window {...WIN}>
        <ChatPanel
          t={t}
          ask={BOARDS_ASK}
          askAt={B_ASK}
          tool="add_storyboard_frames"
          toolAt={B_TOOL}
          doneAt={B_DONE}
          answer="The storyboard has six frames, in order, each with its description."
          linkLabel="Open the storyboard"
        />
        <Page title="Storyboard" sub="Sunday table">
          <div className="grid grid-cols-3 gap-2">
            {FRAMES.map((f, i) => (
              <div key={f.d} style={land(t, B_F0 + i * B_STEP)}>
                <span className="relative block overflow-hidden rounded-[6px] border border-border" style={{ height: 70 }}>
                  <GenreStill genre={f.g} />
                  <span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[8.5px] font-extrabold">{i + 1}</span>
                </span>
                <p className="mt-1 truncate text-[9.5px] text-text-muted">{f.d}</p>
              </div>
            ))}
          </div>
          <p className="absolute inset-x-3 bottom-2.5 text-[9.5px] text-text-faint" style={{ opacity: ramp(t, B_DONE, 400) }}>
            Pictures are copied into your project, so they stay when the chat is gone.
          </p>
        </Page>
      </Window>
      <ActionLabel t={t} at={B_F0 + 300} x={330} y={120} text="Pictures passed by link" tone="purple" before={100} after={2600} />
    </div>
  );
}

/* ----------------------------------------------------------- CALL SHEET */

export const CX_SHOOT_MS = 15000;

const C_ASK = 500;
const SHOOT_ASK = "Put together Thursday's call sheet: 7am crew call at Stage 2, lunch at 1, pull the crew and talent from the contacts.";
const C_TOOL = toolAfter(SHOOT_ASK, C_ASK);
const C_HEAD = C_TOOL + 500;
const PEOPLE: [string, string, string][] = [
  ["Maya Chen", "Talent", "8:30 AM"],
  ["Sam Ortiz", "Director of photography", "7:00 AM"],
  ["Priya Nair", "Gaffer", "7:00 AM"],
  ["Lee Park", "Prop stylist", "7:30 AM"],
  ["Jo Reyes", "Production assistant", "6:30 AM"],
];
const C_P0 = C_HEAD + 1300;
const C_STEP = 480;
const C_DONE = C_P0 + PEOPLE.length * C_STEP + 300;

export function ConnectorShootScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window {...WIN}>
        <ChatPanel
          t={t}
          ask={SHOOT_ASK}
          askAt={C_ASK}
          tool="create_call_sheet"
          toolAt={C_TOOL}
          doneAt={C_DONE}
          answer="Thursday's sheet is a draft with five people on it. Nothing is sent: send it from Studio Flows when it reads right."
          linkLabel="Open the call sheet"
        />
        <Page
          title="Call sheet"
          sub="Day 1"
          right={t >= C_HEAD ? <Chip tone="amber" t={t} since={C_HEAD}>Draft, not sent</Chip> : null}
        >
          <div className="grid grid-cols-3 gap-1.5" style={land(t, C_HEAD)}>
            {[
              ["Crew call", "7:00 AM"],
              ["Lunch", "1:00 PM"],
              ["Location", "Stage 2"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[8px] border border-border px-2 py-1.5">
                <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint">{k}</p>
                <p className="text-[12px] font-extrabold">{v}</p>
              </div>
            ))}
          </div>
          <p className="mb-1 mt-3 text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint" style={land(t, C_P0 - 200)}>
            Who is called
          </p>
          <div className="space-y-1">
            {PEOPLE.map(([name, role, call], i) => (
              <div key={name} className="flex items-center gap-2 rounded-[7px] border border-border px-2 py-1 text-[10.5px]" style={land(t, C_P0 + i * C_STEP)}>
                <span className="w-[86px] truncate font-bold">{name}</span>
                <span className="min-w-0 flex-1 truncate text-text-muted">{role}</span>
                <span className="font-bold">{call}</span>
              </div>
            ))}
          </div>
        </Page>
      </Window>
      <ActionLabel t={t} at={C_P0 + 300} x={330} y={220} text="People come off the job's contacts" tone="blue" before={100} after={2600} />
      <ActionLabel t={t} at={C_DONE + 1200} x={330} y={376} text="You send it, not the assistant" tone="amber" before={200} after={3000} />
    </div>
  );
}

/* --------------------------------------------------------------- OFFICE */

export const CX_OFFICE_MS = 15000;

const O_ASK = 500;
const OFFICE_ASK = "Just off a call with Dana at Northline. They want a bid for a spring spot, about $48k. Add it and remind me Friday.";
const O_TOOL = toolAfter(OFFICE_ASK, O_ASK);
const O_DEAL = O_TOOL + 500;
const O_CALL = O_DEAL + 1100;
const O_TASK = O_CALL + 1000;
const O_DONE = O_TASK + 900;

export function ConnectorOfficeScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window {...WIN}>
        <ChatPanel
          t={t}
          ask={OFFICE_ASK}
          askAt={O_ASK}
          tool="add_deal"
          toolAt={O_TOOL}
          doneAt={O_DONE}
          answer="The deal is on Northline's pipeline, the call is on its timeline, and a follow-up is due Friday."
          linkLabel="Open the deal"
        />
        <Page title="Pipeline" sub="Northline">
          <div className="rounded-[10px] border border-border p-2.5" style={{ ...land(t, O_DEAL), borderTop: "3px solid var(--h-cyan)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-extrabold">Spring spot</span>
              <span className="ml-auto text-[12.5px] font-extrabold">{usd(Math.round(roll(0, 48000, t, O_DEAL, 700)))}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Chip tone="blue" t={t} since={O_DEAL}>Inbound</Chip>
              <span className="text-[10px] text-text-muted">Northline, prospect</span>
            </div>
          </div>
          <p className="mb-1 mt-3 text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint" style={land(t, O_CALL - 150)}>
            Timeline
          </p>
          <div className="rounded-[9px] border border-border px-2.5 py-2 text-[10.5px]" style={land(t, O_CALL)}>
            <p className="font-bold">Call with Dana</p>
            <p className="mt-0.5 leading-snug text-text-muted">Wants a bid for a spring spot, around $48k. Decision by end of month.</p>
          </div>
          <p className="mb-1 mt-3 text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint" style={land(t, O_TASK - 150)}>
            Follow-ups
          </p>
          <div className="flex items-center gap-2 rounded-[9px] border border-border px-2.5 py-2 text-[10.5px]" style={land(t, O_TASK)}>
            <span className="h-3 w-3 rounded-[4px] border border-border" />
            <span className="font-bold">Send Northline the bid</span>
            <span className="ml-auto text-text-muted">Due Fri</span>
          </div>
        </Page>
      </Window>
      <ActionLabel t={t} at={O_DEAL + 300} x={330} y={130} text="A deal, from a sentence" tone="blue" before={100} after={2400} />
      <ActionLabel t={t} at={O_TASK + 300} x={330} y={330} text="And the follow-up with it" tone="green" before={100} after={2600} />
    </div>
  );
}

/* -------------------------------------------------------------- CONNECT */

export const CX_CONNECT_MS = 13000;

const N_PRESS = 1200;
const N_LINK = 1700;
const N_MOVE = 3600;
const N_PASTE = 4600;
const N_ADD = 6100;
const N_ON = 6800;
const LINK = "studio-flows.com/api/mcp/sfc_••••••••";
const CAN = ["Read your jobs, money and clients", "Add boards, shot lists and schedules", "Add call sheets, tasks, costs and props", "Add clients, projects and deals"];

export function ConnectorConnectScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Two steps, once" sub="A private link, then paste it into Claude">
        <div className="absolute rounded-[14px] border border-border p-3.5" style={{ left: 16, top: 68, width: 292, height: 356 }}>
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-text-faint">Studio Flows · Settings</p>
          <p className="mt-1 text-[14px] font-extrabold">AI connector</p>
          <p className="mt-1 text-[10.5px] leading-snug text-text-muted">A private link that lets your own assistant work in this studio, as you.</p>
          <span
            className="mt-3 inline-flex rounded-[9px] px-3 py-1.5 text-[11px] font-extrabold"
            style={{ background: "var(--accent)", color: "white", transform: `scale(${t >= N_PRESS && t < N_PRESS + 180 ? 0.96 : 1})` }}
          >
            Make a link
          </span>
          {t >= N_LINK ? (
            <div className="mt-3 rounded-[9px] border border-border px-2.5 py-2" style={arrive(t, N_LINK, 6)}>
              <p className="truncate font-mono text-[10px]">{LINK}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Chip tone="green" t={t} since={N_LINK + 200}>Copied</Chip>
                <span className="text-[9.5px] text-text-faint">Shown once</span>
              </div>
            </div>
          ) : null}
          {t >= N_ON ? (
            <div className="mt-3 flex items-center gap-2 text-[10.5px]" style={arrive(t, N_ON + 400, 6)}>
              <span className="font-bold">Claude on my laptop</span>
              <span className="text-text-faint">used just now</span>
              <span className="ml-auto rounded-[7px] border border-border px-2 py-0.5 text-[9.5px] font-bold text-text-muted">Turn off</span>
            </div>
          ) : null}
        </div>
        <div className="absolute rounded-[14px] border border-border p-3.5" style={{ left: 324, top: 68, width: 300, height: 356, background: "var(--surface-2)" }}>
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-text-faint">Claude · Connectors</p>
          <p className="mt-1 text-[14px] font-extrabold">Add custom connector</p>
          <div className="mt-3 rounded-[9px] border border-border bg-surface px-2.5 py-2">
            <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint">Name</p>
            <p className="text-[11px] font-semibold">{t >= N_PASTE - 600 ? "Studio Flows" : ""}&nbsp;</p>
          </div>
          <div className="mt-2 rounded-[9px] border border-border bg-surface px-2.5 py-2">
            <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-text-faint">Address</p>
            <p className="truncate font-mono text-[10px]">{t >= N_PASTE ? typed(LINK, t, N_PASTE, 14) : ""}&nbsp;</p>
          </div>
          <span className="mt-3 inline-flex rounded-[9px] border border-border bg-surface px-3 py-1.5 text-[11px] font-extrabold">Add</span>
          {t >= N_ON ? (
            <div className="mt-3" style={arrive(t, N_ON, 6)}>
              <Chip tone="green" t={t} since={N_ON}>Connected</Chip>
              <ul className="mt-2 space-y-1">
                {CAN.map((c, i) => (
                  <li key={c} className="flex items-center gap-1.5 text-[10.5px]" style={land(t, N_ON + 500 + i * 380)}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-green)" }} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Window>
      <ActionLabel t={t} at={N_PRESS} x={110} y={150} text="Make your private link" before={500} after={1800} />
      <ActionLabel t={t} at={N_PASTE} x={420} y={190} text="Paste it into Claude" tone="blue" before={300} after={1800} />
      <ActionLabel t={t} at={N_ON + 2400} x={30} y={372} text="Turn it off any time, in one press" tone="amber" before={200} after={3000} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 300, x: 150, y: 260 },
          { t: N_PRESS, x: 76, y: 196, click: true },
          { t: N_MOVE, x: 120, y: 240 },
          { t: N_PASTE, x: 400, y: 222, click: true },
          { t: N_ADD, x: 356, y: 262, click: true },
          { t: N_ADD + 1500, x: 500, y: 380 },
        ]}
      />
    </div>
  );
}
