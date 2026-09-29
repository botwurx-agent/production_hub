"use client";

import type { ReactNode } from "react";
import { ActionLabel, Avatar, Chip, Cursor, Window, arrive, ramp, spring, typed } from "./scene-kit";

/*
 * The crew and contacts page's chapter scenes (640x440, pure functions of t).
 * As shipped: one roster per project in folder tabs with category colours, an
 * add modal with a position list per category and a day rate, pulling people
 * in from the client, talent profiles (wardrobe, dietary with allergies first,
 * representation, credit name, headshot, files), project-only invites with a
 * reviewer tier, and money hidden from collaborators by the database.
 */

const CAT: Record<string, string> = { Crew: "blue", Talent: "pink", Extras: "purple", Vendors: "amber", Clients: "green" };

const PEOPLE = [
  { n: "Priya Shah", r: "Director of photography", c: "Crew", rate: "$1,200/day" },
  { n: "Leo Park", r: "Gaffer", c: "Crew", rate: "$900/day" },
  { n: "Nina Cole", r: "Key grip", c: "Crew", rate: "$850/day" },
  { n: "Rae Morgan", r: "Principal", c: "Talent", rate: "$2,500/day", allergy: "Tree nuts" },
  { n: "Theo Lin", r: "Hand model", c: "Talent", rate: "$900/day" },
  { n: "Aurora CGI", r: "CGI studio", c: "Vendors", rate: "" },
  { n: "Maya Torres", r: "Brand manager", c: "Clients", rate: "" },
];

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

function PersonCard({ p, t, since, hideRate }: { p: (typeof PEOPLE)[number]; t: number; since?: number; hideRate?: boolean }) {
  const hue = CAT[p.c];
  return (
    <div className="rounded-[12px] border border-border bg-surface p-2.5" style={{ borderTop: `3px solid var(--h-${hue})`, ...(since !== undefined ? arrive(t, since, 8) : {}) }}>
      <div className="flex items-center gap-2">
        <Avatar name={p.n} hue={hue} size={28} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold">{p.n}</p>
          <p className="truncate text-[10.5px] text-text-faint">{p.r}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}>{p.c}</span>
        {p.rate && !hideRate ? <span className="text-[10.5px] font-bold tabular-nums text-text-muted">{p.rate}</span> : null}
        {"allergy" in p && p.allergy ? <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: "var(--h-red-bg)", color: "var(--h-red)" }}>Allergy: {p.allergy}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- ROSTER */

export const CR_ROSTER_MS = 11000;

const TABS = [
  { k: "All", at: 0 },
  { k: "Crew", at: 1800 },
  { k: "Talent", at: 3800 },
  { k: "Vendors", at: 5800 },
  { k: "All", at: 7800 },
];

export function CrewRosterScene({ t }: { t: number }) {
  const cur = [...TABS].reverse().find((x) => t >= x.at)!;
  const shown = PEOPLE.filter((p) => cur.k === "All" || p.c === cur.k);
  const count = (k: string) => (k === "All" ? PEOPLE.length : PEOPLE.filter((p) => p.c === k).length);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Contacts · Bright Water" sub="Everyone on this job, in one place" right={<Btn tone="accent">+ Add contact</Btn>}>
        <div className="absolute flex gap-1" style={{ left: 16, top: 62 }}>
          {["All", "Crew", "Talent", "Extras", "Vendors", "Clients"].map((k) => {
            const on = cur.k === k;
            const hue = CAT[k];
            return (
              <span key={k} className="rounded-t-[9px] border border-b-0 px-3 py-1.5 text-[11.5px] font-bold" style={{ borderColor: on ? "var(--border)" : "transparent", background: on ? "var(--surface)" : undefined, color: on ? "var(--text)" : "var(--text-muted)" }}>
                {hue ? <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: `var(--h-${hue})` }} /> : null}
                {k} <span className="text-text-faint">{count(k)}</span>
              </span>
            );
          })}
        </div>
        <div className="absolute grid grid-cols-3 gap-2.5 border-t border-border pt-3" style={{ left: 16, top: 94, width: 608 }}>
          {shown.map((p, i) => <PersonCard key={p.n + cur.at} p={p} t={t} since={cur.at + i * 80} />)}
        </div>
      </Window>
      <ActionLabel t={t} at={TABS[1].at} x={80} y={60} text="Folder tabs by category" after={1400} />
      <ActionLabel t={t} at={TABS[2].at} x={150} y={60} text="Talent carries allergies up front" tone="red" after={1500} />
      <ActionLabel t={t} at={TABS[3].at} x={250} y={60} text="Vendors, too" tone="amber" after={1400} />
      <Cursor t={t} travel={650} path={[{ t: 600, x: 320, y: 380 }, ...TABS.slice(1).map((x, i) => ({ t: x.at, x: [100, 160, 290, 40][i], y: 74, click: true }))]} />
    </div>
  );
}

/* -------------------------------------------------------------------- ADD */

export const CR_ADD_MS = 13000;

const OPEN_AT = 800;
const CAT_AT = 1700;
const NAME_AT = 2600;
const POS_OPEN = 4000;
const POS_AT = 5000;
const RATE_AT = 6200;
const SAVE_AT = 7600;
const CLIENT_AT = 9400;

export function CrewAddScene({ t }: { t: number }) {
  const saved = t >= SAVE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Contacts · Bright Water" sub="Add someone in seconds" right={<span className="flex gap-1.5"><Btn on={t >= CLIENT_AT - 300} press={t >= CLIENT_AT - 60 && t < CLIENT_AT + 80}>+ From Bright Water</Btn><Btn tone="accent" press={t >= OPEN_AT - 60 && t < OPEN_AT + 80}>+ Add contact</Btn></span>}>
        {!saved || t >= CLIENT_AT ? null : (
          <div className="absolute grid grid-cols-3 gap-2.5" style={{ left: 16, top: 66, width: 608 }}>
            <PersonCard p={{ n: "Sofia Marin", r: "Food stylist", c: "Crew", rate: "$1,100/day" }} t={t} since={SAVE_AT} />
          </div>
        )}
        {t >= OPEN_AT && !saved ? (
          <div className="absolute rounded-[16px] border border-border bg-surface p-4 shadow-[0_28px_70px_-24px_rgba(40,30,90,.6)]" style={{ left: 70, top: 64, width: 500, ...arrive(t, OPEN_AT, 12) }}>
            <p className="font-display text-[14px] font-extrabold">Add a contact</p>
            <div className="mt-2 flex gap-1.5">
              {Object.keys(CAT).map((k) => {
                const on = (k === "Crew" && t >= CAT_AT) || (k === "Talent" && t < CAT_AT);
                return <span key={k} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: on ? `var(--h-${CAT[k]}-bg)` : "var(--surface-2)", color: on ? `var(--h-${CAT[k]})` : "var(--text-muted)" }}>{k}</span>;
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Name", typed("Sofia Marin", t, NAME_AT, 70), t >= NAME_AT - 200 && t < POS_OPEN - 200],
                ["Position", t >= POS_AT ? "Food stylist" : "", t >= POS_OPEN - 200 && t < POS_AT + 400],
                ["Email", t >= NAME_AT + 900 ? "sofia@marinstyling.com" : "", false],
                ["Day rate", t >= RATE_AT ? `$${typed("1,100", t, RATE_AT, 110)}/day` : "", t >= RATE_AT - 200 && t < SAVE_AT - 300],
              ].map(([k, v, lit]) => (
                <div key={k as string}>
                  <p className="text-[10.5px] font-semibold text-text-faint">{k as string}</p>
                  <div className="mt-0.5 h-[28px] rounded-[7px] border px-2 text-[12px] font-semibold leading-[26px]" style={{ borderColor: lit ? "var(--accent)" : "var(--border)" }}>{v as string}</div>
                </div>
              ))}
            </div>
            {t >= POS_OPEN && t < POS_AT + 150 ? (
              <div className="absolute rounded-[10px] border border-border bg-surface p-1 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 266, top: 146, width: 200, ...arrive(t, POS_OPEN, 6) }}>
                <p className="px-2 pb-0.5 pt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Crew positions</p>
                {["Food stylist", "Prop stylist", "Wardrobe stylist", "Hair and makeup"].map((k, i) => (
                  <p key={k} className="rounded-[7px] px-2 py-1 text-[11.5px] font-semibold" style={{ background: i === 0 && t >= POS_AT - 400 ? "var(--accent-soft)" : undefined }}>{k}</p>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10.5px] text-text-faint">Day rates are visible to your studio only.</span>
              <span className="flex gap-1.5"><Btn>Save & add another</Btn><Btn tone="accent" press={t >= SAVE_AT - 60}>Save</Btn></span>
            </div>
          </div>
        ) : null}
        {/* From the client */}
        {t >= CLIENT_AT ? (
          <div className="absolute rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ right: 16, top: 60, width: 300, ...arrive(t, CLIENT_AT, 8) }}>
            <p className="text-[12px] font-extrabold">Add from Bright Water</p>
            <p className="text-[10.5px] text-text-faint">The client's own contacts, ready to add to this job</p>
            {["Maya Torres · Brand manager", "Ben Ortega · Marketing lead"].map((n, i) => (
              <div key={n} className="mt-1.5 flex items-center gap-2 rounded-[8px] px-2 py-1.5" style={{ background: i === 1 && t >= CLIENT_AT + 900 ? "var(--accent-soft)" : undefined }}>
                <Avatar name={n} hue="green" size={22} />
                <span className="text-[11.5px] font-semibold">{n}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={CAT_AT} x={140} y={100} text="Pick what they are" />
      <ActionLabel t={t} at={POS_OPEN} x={420} y={150} text="Positions for that category" tone="blue" after={1100} />
      <ActionLabel t={t} at={RATE_AT} x={420} y={210} text="Their day rate" tone="amber" />
      <ActionLabel t={t} at={CLIENT_AT} x={330} y={180} text="Or pull in the client's people" tone="green" after={1600} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: OPEN_AT, x: 580, y: 26, click: true },
          { t: CAT_AT, x: 110, y: 110, click: true },
          { t: NAME_AT, x: 200, y: 150, click: true },
          { t: POS_OPEN, x: 420, y: 150, click: true },
          { t: POS_AT, x: 340, y: 184, click: true },
          { t: RATE_AT, x: 420, y: 194, click: true },
          { t: SAVE_AT, x: 546, y: 240, click: true },
          { t: CLIENT_AT, x: 470, y: 26, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- TALENT */

export const CR_TALENT_MS = 12500;

const PANES = [
  { k: "Details", at: 0 },
  { k: "Talent details", at: 1400 },
  { k: "Files", at: 7400 },
];

export function CrewTalentScene({ t }: { t: number }) {
  const pane = [...PANES].reverse().find((p) => t >= p.at)!.k;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Rae Morgan · Talent" sub="Everything wardrobe, catering and accounts ask for" right={<Chip tone="pink" t={t}>Talent</Chip>}>
        <div className="absolute flex items-center gap-3" style={{ left: 16, top: 64 }}>
          <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full text-[16px] font-extrabold" style={{ background: "var(--h-pink-bg)", color: "var(--h-pink)" }}>
            {t >= 900 ? <span className="absolute inset-0" style={{ background: "linear-gradient(160deg, var(--h-amber-bg), var(--h-pink))", ...arrive(t, 900, 0) }} /> : "RM"}
          </span>
          <div>
            <p className="text-[14px] font-extrabold">Rae Morgan</p>
            <p className="text-[11px] text-text-faint">Principal · credited as <b className="text-text">Rae M. Morgan</b></p>
          </div>
        </div>
        <div className="absolute flex gap-1" style={{ left: 16, top: 128 }}>
          {PANES.map((p) => (
            <span key={p.k} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: pane === p.k ? "var(--accent-soft)" : "var(--surface-2)", color: pane === p.k ? "var(--accent)" : "var(--text-muted)" }}>{p.k}</span>
          ))}
        </div>
        {pane === "Talent details" ? (
          <div className="absolute grid grid-cols-2 gap-4" style={{ left: 16, top: 164, width: 608, ...arrive(t, PANES[1].at, 6) }}>
            <div className="rounded-[12px] border border-border p-3">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Wardrobe</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  ["Height", "5'8\""],
                  ["Dress", "6"],
                  ["Shoe", "8.5"],
                  ["Waist", "27"],
                  ["Inseam", "31"],
                  ["Hat", "7"],
                ].map(([k, v], i) => (
                  <div key={k} style={arrive(t, PANES[1].at + 300 + i * 200, 3)}>
                    <p className="text-[9.5px] text-text-faint">{k}</p>
                    <p className="text-[12px] font-bold">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[12px] border border-border p-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Dietary</p>
                {t >= 3600 ? <p className="mt-1 text-[12px] font-bold" style={{ color: "var(--h-red)", ...arrive(t, 3600, 3) }}>Allergy: tree nuts</p> : null}
                {t >= 4200 ? <p className="text-[11.5px] text-text-muted" style={arrive(t, 4200, 3)}>Vegetarian</p> : null}
              </div>
              <div className="rounded-[12px] border border-border p-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Representation</p>
                {t >= 5400 ? <p className="mt-1 text-[11.5px]" style={arrive(t, 5400, 3)}><b>Coast Talent</b> · Jess Alvarez · 310 555 0181</p> : null}
              </div>
            </div>
          </div>
        ) : pane === "Files" ? (
          <div className="absolute space-y-2" style={{ left: 16, top: 164, width: 608, ...arrive(t, PANES[2].at, 6) }}>
            {[
              ["W-9 · 2026", "PDF", "red"],
              ["Talent release, signed", "PDF", "red"],
              ["Comp card", "JPG", "blue"],
            ].map(([n, ty, h], i) => (
              <div key={n} className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2" style={arrive(t, PANES[2].at + 300 + i * 300, 6)}>
                <span className="grid h-8 w-7 place-items-center rounded-[5px] text-[8.5px] font-black text-white" style={{ background: `var(--h-${h})` }}>{ty}</span>
                <span className="flex-1 text-[12px] font-semibold">{n}</span>
                <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>Open</span>
              </div>
            ))}
            <p className="px-1 text-[11px] text-text-faint">Kept on the person, not lost in the asset library.</p>
          </div>
        ) : (
          <div className="absolute grid grid-cols-2 gap-3" style={{ left: 16, top: 164, width: 608 }}>
            {[
              ["Position", "Principal"],
              ["Email", "rae@coasttalent.com"],
              ["Phone", "310 555 0144"],
              ["Day rate", "$2,500/day"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10.5px] font-semibold text-text-faint">{k}</p>
                <div className="mt-0.5 h-[28px] rounded-[7px] border border-border px-2 text-[12px] font-semibold leading-[26px]">{v}</div>
              </div>
            ))}
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={900} x={80} y={90} text="A headshot on their card" tone="pink" after={500} />
      <ActionLabel t={t} at={2000} x={100} y={210} text="Sizes for wardrobe" tone="blue" after={1200} />
      <ActionLabel t={t} at={3600} x={330} y={200} text="Allergies first, for catering" tone="red" after={1300} />
      <ActionLabel t={t} at={5400} x={330} y={270} text="Their agent, for accounts" tone="amber" after={1200} />
      <ActionLabel t={t} at={PANES[2].at} x={200} y={130} text="W-9s and releases, on the person" tone="indigo" after={1600} />
      <Cursor t={t} travel={650} path={[{ t: 300, x: 320, y: 400 }, { t: PANES[1].at, x: 100, y: 140, click: true }, { t: PANES[2].at, x: 184, y: 140, click: true }]} />
    </div>
  );
}

/* ----------------------------------------------------------------- ACCESS */

export const CR_ACCESS_MS = 13500;

const INVITE_AT = 800;
const EMAIL_AT = 1700;
const ROLE_AT = 3200;
const SEND_AT = 4600;
const VIEW_AT = 6800;

export function CrewAccessScene({ t }: { t: number }) {
  const view = t >= VIEW_AT;
  const reviewer = t >= ROLE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title={view ? "Bright Water · as Priya sees it" : "People on this project"}
        sub={view ? "Signed in as a collaborator on this job" : "Invite crew to one job, not your whole studio"}
        right={view ? <Chip tone="muted" t={t} since={VIEW_AT}>Collaborator view</Chip> : <Btn tone="accent" press={t >= INVITE_AT - 60 && t < INVITE_AT + 80}>Invite</Btn>}
      >
        {!view ? (
          <div className="absolute" style={{ left: 16, top: 66, width: 608 }}>
            {t >= INVITE_AT ? (
              <div className="rounded-[14px] border border-border p-3" style={arrive(t, INVITE_AT, 8)}>
                <p className="text-[12.5px] font-extrabold">Invite to Bright Water only</p>
                <div className="mt-2 flex gap-2">
                  <div className="h-[30px] flex-1 rounded-[8px] border px-2 text-[12px] font-semibold leading-[28px]" style={{ borderColor: t >= EMAIL_AT - 200 && t < ROLE_AT ? "var(--accent)" : "var(--border)" }}>{typed("priya@shahcine.com", t, EMAIL_AT, 55)}</div>
                  <div className="flex overflow-hidden rounded-[8px] border border-border text-[11px] font-bold">
                    <span className="px-2.5 leading-[28px]" style={{ background: !reviewer ? "var(--accent-soft)" : undefined, color: !reviewer ? "var(--accent)" : "var(--text-muted)" }}>Collaborator</span>
                    <span className="px-2.5 leading-[28px]" style={{ background: reviewer ? "var(--accent-soft)" : undefined, color: reviewer ? "var(--accent)" : "var(--text-muted)" }}>Reviewer</span>
                  </div>
                  <Btn tone="accent" press={t >= SEND_AT - 60 && t < SEND_AT + 80}>{t >= SEND_AT ? "Sent ✓" : "Send"}</Btn>
                </div>
                <p className="mt-1.5 text-[11px] text-text-faint">{reviewer ? "Reviewers can read, comment and approve, but not edit." : "Collaborators can work on this project."}</p>
              </div>
            ) : null}
            <div className="mt-3 space-y-1.5">
              {[
                ["Sam Ortiz", "1st AD", "Collaborator", "green"],
                ["Leo Park", "Gaffer", "Collaborator", "amber"],
                ...(t >= SEND_AT ? [["priya@shahcine.com", "Invite emailed · pending", "Reviewer", "blue"]] : []),
              ].map(([n, r, role, h], i) => (
                <div key={n} className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2" style={i === 2 ? arrive(t, SEND_AT, 6) : undefined}>
                  <Avatar name={n} hue={h} size={24} />
                  <span className="w-[160px] text-[12px] font-bold">{n}</span>
                  <span className="flex-1 text-[11px] text-text-faint">{r}</span>
                  <Chip tone={role === "Reviewer" ? "blue" : "green"} t={t}>{role}</Chip>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="absolute" style={{ left: 16, top: 66, width: 608, ...arrive(t, VIEW_AT, 10) }}>
            <div className="grid grid-cols-3 gap-2.5">
              {["Call sheet", "Shot list", "Storyboards", "Schedule", "Contacts", "Review"].map((k, i) => (
                <div key={k} className="rounded-[10px] border border-border p-2.5" style={{ borderTop: `3px solid var(--h-${["amber", "blue", "purple", "green", "orange", "pink"][i]})`, ...arrive(t, VIEW_AT + i * 90, 4) }}>
                  <p className="text-[12px] font-bold">{k}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {PEOPLE.slice(0, 3).map((p) => <PersonCard key={p.n} p={p} t={t} hideRate />)}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-dashed border-border px-3 py-2 text-[11.5px] font-semibold text-text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              No day rates, no budget, no other jobs, no clients. The database keeps them out.
            </div>
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={EMAIL_AT} x={200} y={110} text="Invite by email" />
      <ActionLabel t={t} at={ROLE_AT} x={450} y={100} text="Or view and comment only" tone="blue" after={1100} />
      <ActionLabel t={t} at={VIEW_AT + 600} x={200} y={200} text="They see this job, nothing else" tone="indigo" after={1500} />
      <ActionLabel t={t} at={VIEW_AT + 2600} x={200} y={290} text="Not even anyone's rate" tone="red" after={1800} />
      <Cursor t={t} travel={650} path={[{ t: 300, x: 320, y: 380 }, { t: INVITE_AT, x: 596, y: 26, click: true }, { t: EMAIL_AT, x: 180, y: 118, click: true }, { t: ROLE_AT, x: 470, y: 118, click: true }, { t: SEND_AT, x: 580, y: 118, click: true }]} />
    </div>
  );
}

/* ---------------------------------------------------------- USED EVERYWHERE */

export const CR_USED_MS = 11500;

const USES = [
  { k: "Call sheet", sub: "Recipients ticked off the roster", hue: "amber", at: 800 },
  { k: "Schedule", sub: "Talent and crew on every row", hue: "green", at: 2800 },
  { k: "Budget", sub: "The vendor on a cost, with their agreed rate", hue: "blue", at: 4800 },
  { k: "Crew meals", sub: "Who is on the lunch order", hue: "orange", at: 6800 },
];

export function CrewUsedScene({ t }: { t: number }) {
  const cur = [...USES].reverse().find((u) => t >= u.at);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Priya Shah · Director of photography" sub="Entered once, used everywhere on the job" right={<Chip tone="blue" t={t}>Crew</Chip>}>
        <div className="absolute" style={{ left: 16, top: 66, width: 200 }}>
          <PersonCard p={PEOPLE[0]} t={t} />
          <p className="mt-2 text-[11px] text-text-faint">Typed in once, on the project's contacts.</p>
        </div>
        <svg className="pointer-events-none absolute left-0 top-0" width="640" height="440" aria-hidden="true">
          {USES.map((u, i) => {
            const p = ramp(t, u.at, 500);
            return p > 0 ? <path key={u.k} d={`M216 110 C 260 110, 260 ${96 + i * 84}, 300 ${96 + i * 84}`} stroke={`var(--h-${u.hue})`} strokeWidth="2" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} /> : null;
          })}
        </svg>
        {USES.map((u, i) => (
          <div key={u.k} className="absolute flex items-center gap-3 rounded-[12px] border bg-surface px-3 py-2.5" style={{ left: 300, top: 70 + i * 84, width: 324, borderColor: cur === u ? `var(--h-${u.hue})` : "var(--border)", ...(t >= u.at ? arrive(t, u.at + 300, 8) : { opacity: 0.35 }) }}>
            <span className="h-9 w-1 rounded-full" style={{ background: `var(--h-${u.hue})` }} />
            <div className="flex-1">
              <p className="text-[12.5px] font-bold">{u.k}</p>
              <p className="text-[11px] text-text-faint">{u.sub}</p>
            </div>
            {t >= u.at + 500 ? <span style={{ transform: `scale(${spring(ramp(t, u.at + 500, 400))})` }}><Avatar name="Priya Shah" hue="blue" size={24} /></span> : null}
          </div>
        ))}
      </Window>
      <ActionLabel t={t} at={9000} x={60} y={260} text="No retyping, anywhere" tone="green" after={1800} />
    </div>
  );
}
