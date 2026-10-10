"use client";

import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, ramp, typed, usd, type Tone } from "./scene-kit";

/*
 * The CRM page's chapters, beyond the pipeline board (scenes-deal.tsx).
 * Every piece is shipped: accounts with a Prospect / Client / Past status and
 * a filter strip, the relationship timeline with linked email logged on its
 * own and a "last contact" line, tasks with due dates, and the no-login
 * request link that lands a client's request as an inbound deal.
 */

/* ------------------------------------------------------------- Accounts */

export const CRM_ACCOUNTS_MS = 5800;

type Status = "Prospect" | "Client" | "Past";
const STATUS_TONE: Record<Status, Tone> = { Prospect: "amber", Client: "green", Past: "muted" };

const ACCOUNTS: { name: string; kind: string; status: Status; open: number; last: string; hue: string }[] = [
  { name: "Bright Water", kind: "Brand", status: "Client", open: 42000, last: "today", hue: "cyan" },
  { name: "Harbor Coffee", kind: "Brand", status: "Prospect", open: 18000, last: "2 days ago", hue: "amber" },
  { name: "Lumen Skincare", kind: "Agency", status: "Prospect", open: 8500, last: "5 days ago", hue: "pink" },
  { name: "Northfield & Co", kind: "Agency", status: "Client", open: 22000, last: "1 week ago", hue: "purple" },
  { name: "Oakline", kind: "Brand", status: "Client", open: 0, last: "4 months ago", hue: "blue" },
];

const TABS = ["All", "Prospects", "Clients", "Past"] as const;
const FILTER_AT = 1100;
const BACK_AT = 2500;
const MENU_AT = 3500;
const PAST_AT = 4300;

export function CrmAccountsScene({ t }: { t: number }) {
  const tab = t >= FILTER_AT && t < BACK_AT ? 1 : 0;
  const menu = t >= MENU_AT && t < PAST_AT;
  const rows = ACCOUNTS.map((a) => (a.name === "Oakline" && t >= PAST_AT ? { ...a, status: "Past" as Status } : a)).filter(
    (a) => tab === 0 || a.status === "Prospect",
  );
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Clients" sub="Every company, from first contact to past work">
        <div className="flex gap-1.5 px-4 pt-3">
          {TABS.map((k, i) => (
            <span
              key={k}
              className="rounded-full border px-3 py-1 text-[11.5px] font-bold"
              style={{
                borderColor: i === tab ? "var(--accent)" : "var(--border)",
                background: i === tab ? "var(--h-indigo-bg)" : "var(--surface)",
                color: i === tab ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {k}
            </span>
          ))}
        </div>
        <div className="mx-4 mt-3 grid grid-cols-[1fr_90px_96px_100px] border-b border-border pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">
          <span>Account</span>
          <span>Status</span>
          <span className="text-right">Open deals</span>
          <span className="text-right">Last contact</span>
        </div>
        {rows.map((a, i) => (
          <div
            key={a.name}
            className="mx-4 grid grid-cols-[1fr_90px_96px_100px] items-center border-b border-border py-2.5"
            style={tab === 1 ? arrive(t, FILTER_AT + i * 90, 6) : undefined}
          >
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-[8px] text-[10px] font-black text-white" style={{ background: `var(--h-${a.hue})` }}>
                {a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </span>
              <span>
                <span className="block text-[12px] font-extrabold leading-tight">{a.name}</span>
                <span className="block text-[10px] text-text-faint">{a.kind}</span>
              </span>
            </span>
            <span>
              <Chip tone={STATUS_TONE[a.status]} t={t} since={a.name === "Oakline" ? PAST_AT : -1e9}>
                {a.status}
              </Chip>
            </span>
            <span className="text-right text-[12px] font-bold tabular-nums">{a.open ? usd(a.open) : "None"}</span>
            <span className="text-right text-[11px] text-text-muted">{a.last}</span>
          </div>
        ))}
        {menu && tab === 0 ? (
          <div
            className="absolute z-20 w-[150px] rounded-[12px] border border-border bg-surface p-1.5 shadow-[0_20px_40px_-14px_rgba(40,30,90,.45)]"
            style={{ left: 300, top: 360, ...arrive(t, MENU_AT, 6) }}
          >
            {(["Prospect", "Client", "Past"] as Status[]).map((k) => (
              <div
                key={k}
                className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11.5px] font-bold"
                style={{ background: k === "Past" && t > PAST_AT - 350 ? "var(--surface-2)" : undefined }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: k === "Past" ? "var(--text-faint)" : `var(--h-${STATUS_TONE[k]})` }} />
                {k}
              </div>
            ))}
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={FILTER_AT} x={92} y={60} text="Just the prospects" />
      <ActionLabel t={t} at={MENU_AT} x={330} y={330} text="Mark a finished relationship Past" after={1100} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 500, x: 380, y: 300 },
          { t: FILTER_AT, x: 100, y: 66, click: true },
          { t: BACK_AT, x: 40, y: 66, click: true },
          { t: MENU_AT, x: 330, y: 340, click: true },
          { t: PAST_AT, x: 340, y: 432, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------- Timeline */

export const CRM_TIMELINE_MS = 6400;

const LOG_AT = 1800;
const TASK_AT = 3600;
const DONE_AT = 5000;
const NOTE = "Call with Dana: wants the bid by Friday";
const TASK = "Send the spring bid";

const FEED: { kind: string; tone: Tone; body: string; when: string; auto?: boolean }[] = [
  { kind: "Email", tone: "blue", body: "Re: Spring campaign brief", when: "2 days ago", auto: true },
  { kind: "Meeting", tone: "purple", body: "Intro with the brand team", when: "1 week ago" },
  { kind: "Email", tone: "blue", body: "Studio reel and rates", when: "2 weeks ago", auto: true },
];

export function CrmTimelineScene({ t }: { t: number }) {
  const logged = t >= LOG_AT;
  const typing = t >= 700 && t < LOG_AT;
  const taskOn = t >= TASK_AT;
  const done = t >= DONE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Harbor Coffee"
        sub={logged ? "Prospect · last contact today" : "Prospect · last contact 2 days ago"}
        right={<Chip tone="amber" t={t}>Prospect</Chip>}
      >
        {/* Timeline */}
        <div className="absolute left-4 top-[64px] w-[372px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Activity</p>
          <div className="mt-1.5 rounded-[12px] border border-border p-2.5">
            <div className="flex gap-1.5">
              {["Note", "Call", "Meeting", "Email"].map((k) => (
                <span
                  key={k}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    background: k === "Call" ? "var(--h-green-bg)" : "var(--surface-2)",
                    color: k === "Call" ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
            <p className="mt-2 min-h-[18px] text-[12px]">
              {typing ? typed(NOTE, t, 800, 22) : logged ? "" : <span className="text-text-faint">Log a call, a meeting, a note...</span>}
            </p>
          </div>
          <div className="mt-2 space-y-1.5">
            {logged ? (
              <div className="flex items-start gap-2 rounded-[10px] border border-border px-2.5 py-2" style={arrive(t, LOG_AT, 8)}>
                <Chip tone="green" t={t} since={LOG_AT}>Call</Chip>
                <span className="flex-1 text-[11.5px] font-semibold">{NOTE}</span>
                <span className="text-[10px] text-text-faint">just now</span>
              </div>
            ) : null}
            {FEED.map((f) => (
              <div key={f.body} className="flex items-start gap-2 rounded-[10px] border border-border px-2.5 py-2">
                <Chip tone={f.tone} t={t}>{f.kind}</Chip>
                <span className="flex-1 text-[11.5px] font-semibold">{f.body}</span>
                {f.auto ? (
                  <span className="rounded-full bg-surface-2 px-1.5 text-[9.5px] font-bold text-text-muted">auto</span>
                ) : null}
                <span className="text-[10px] text-text-faint">{f.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="absolute right-4 top-[64px] w-[220px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Tasks</p>
          <div className="mt-1.5 space-y-1.5">
            {taskOn ? (
              <div
                className="flex items-center gap-2 rounded-[10px] border px-2.5 py-2"
                style={{ borderColor: done ? "var(--h-green)" : "var(--border)", ...arrive(t, TASK_AT, 8) }}
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-[5px] border text-[10px] font-black text-white"
                  style={{ borderColor: done ? "var(--h-green)" : "var(--border-strong)", background: done ? "var(--h-green)" : "transparent" }}
                >
                  {done ? "✓" : ""}
                </span>
                <span className="flex-1">
                  <span className={`block text-[11.5px] font-bold ${done ? "line-through text-text-faint" : ""}`}>
                    {typed(TASK, t, TASK_AT, 26)}
                  </span>
                  <span className="block text-[10px] text-text-faint">Due Fri</span>
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-[10px] border border-border px-2.5 py-2">
              <span className="h-4 w-4 rounded-[5px] border" style={{ borderColor: "var(--h-red)" }} />
              <span className="flex-1">
                <span className="block text-[11.5px] font-bold">Follow up on the reel</span>
                <span className="block text-[10px] font-bold" style={{ color: "var(--h-red)" }}>Overdue</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-[10px] border border-border px-2.5 py-2">
              <span className="h-4 w-4 rounded-[5px] border border-border-strong" />
              <span className="flex-1">
                <span className="block text-[11.5px] font-bold">Book a studio walk-through</span>
                <span className="block text-[10px] text-text-faint">Due next week</span>
              </span>
            </div>
          </div>
          <Burst t={t} at={DONE_AT} x={20} y={30} />
        </div>
      </Window>
      <ActionLabel t={t} at={LOG_AT} x={40} y={110} text="Log the call" tone="green" />
      <ActionLabel t={t} at={TASK_AT} x={440} y={120} text="A reminder with a due date" after={900} />
      <ActionLabel t={t} at={DONE_AT} x={430} y={120} text="Done" tone="green" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 200, y: 140 },
          { t: LOG_AT, x: 360, y: 128, click: true },
          { t: TASK_AT, x: 470, y: 112, click: true },
          { t: DONE_AT, x: 440, y: 112, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------- Request link */

export const CRM_REQUEST_MS = 6200;

const SEND_AT = 3300;
const LAND_AT = 3900;
const FIELDS = [
  { l: "What do you need?", v: "Holiday cutdowns, 3 x 15s", at: 500 },
  { l: "Needed by", v: "Nov 21", at: 1500 },
  { l: "Budget", v: "$12,500", at: 1900 },
];

export function CrmRequestScene({ t }: { t: number }) {
  const sent = t >= SEND_AT;
  const landed = t >= LAND_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="New work, from the client's own link" sub="No login for them, an inbound deal for you" right={landed ? <Chip tone="pink" t={t} since={LAND_AT}>1 new request</Chip> : null}>
        {/* The client's side */}
        <div className="absolute left-4 top-[64px] w-[290px] rounded-[14px] border border-border p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Bright Water's link</p>
          <p className="mt-0.5 font-display text-[14px] font-extrabold">Request new work</p>
          {sent ? (
            <div className="mt-6 text-center" style={arrive(t, SEND_AT, 8)}>
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full text-[15px] font-black text-white" style={{ background: "var(--h-green)" }}>✓</span>
              <p className="mt-2 text-[13px] font-extrabold">Request sent</p>
              <p className="mt-1 text-[11px] text-text-muted">The studio will reply by email.</p>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {FIELDS.map((f) => (
                <div key={f.l}>
                  <p className="text-[10px] font-bold text-text-muted">{f.l}</p>
                  <p className="mt-0.5 h-[26px] rounded-[8px] border border-border px-2 py-1 text-[11.5px]">{typed(f.v, t, f.at, 30)}</p>
                </div>
              ))}
              <div>
                <p className="text-[10px] font-bold text-text-muted">Files</p>
                {t >= 2400 ? (
                  <p className="mt-0.5 inline-flex rounded-[8px] bg-surface-2 px-2 py-1 text-[11px] font-bold" style={arrive(t, 2400, 6)}>
                    holiday-brief.pdf
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-text-faint">Attach a brief</p>
                )}
              </div>
              <span
                className="mt-1 grid h-[30px] place-items-center rounded-[9px] text-[11.5px] font-extrabold text-white"
                style={{ background: "var(--accent)", transform: t >= SEND_AT - 120 ? "scale(.96)" : undefined }}
              >
                Send to Northline Studio
              </span>
            </div>
          )}
        </div>

        {/* The studio's side */}
        <div className="absolute right-4 top-[64px] w-[300px]">
          <div className="rounded-[12px] bg-surface-2 p-2" style={{ borderTop: "3px solid var(--h-blue)", minHeight: 300 }}>
            <div className="flex items-center justify-between px-1">
              <span className="text-[11.5px] font-extrabold">Inbound</span>
              <span className="text-[10px] font-bold tabular-nums text-text-faint">{landed ? usd(20500) : usd(8000)}</span>
            </div>
            <div className="mt-2 space-y-2">
              {landed ? (
                <div className="rounded-[11px] border bg-surface px-2.5 py-2" style={{ borderColor: "var(--h-pink)", borderLeft: "3px solid var(--h-blue)", ...arrive(t, LAND_AT, 14) }}>
                  <p className="text-[11.5px] font-extrabold">Holiday cutdowns, 3 x 15s</p>
                  <p className="text-[10px] text-text-faint">Bright Water · via request link</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11.5px] font-bold tabular-nums">{usd(12500)}</span>
                    <span className="text-[10px] font-bold text-text-muted">brief + 1 file</span>
                  </div>
                </div>
              ) : null}
              <div className="rounded-[11px] border border-border bg-surface px-2.5 py-2" style={{ borderLeft: "3px solid var(--h-blue)" }}>
                <p className="text-[11.5px] font-extrabold">Product stills refresh</p>
                <p className="text-[10px] text-text-faint">Oakline · inbound email</p>
                <p className="mt-1 text-[11.5px] font-bold tabular-nums">{usd(8000)}</p>
              </div>
            </div>
            {t >= LAND_AT + 700 ? (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-2" style={arrive(t, LAND_AT + 700, 8)}>
                <Avatar name="Maya Torres" hue="pink" size={24} />
                <span className="text-[11px]">
                  <span className="font-bold">Maya Torres</span> added to Bright Water's contacts
                </span>
              </div>
            ) : null}
          </div>
          <Burst t={t} at={LAND_AT} x={150} y={60} />
        </div>
      </Window>
      <ActionLabel t={t} at={SEND_AT} x={60} y={330} text="The client sends it" tone="green" />
      <ActionLabel t={t} at={LAND_AT} x={400} y={150} text="It lands as a deal" tone="pink" after={1100} />
      <Cursor
        t={t}
        travel={600}
        path={[
          { t: 300, x: 160, y: 140 },
          { t: 2400, x: 120, y: 290, click: true },
          { t: SEND_AT, x: 160, y: 340, click: true },
        ]}
      />
    </div>
  );
}
