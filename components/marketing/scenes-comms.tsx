"use client";

import type { ReactNode } from "react";
import { ChatGlyph, GmailGlyph, SlackGlyph } from "@/components/communication/comms-ui";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, typed } from "./scene-kit";

/*
 * The communication page's chapter scenes (640x440, pure functions of t). As
 * shipped: linking a Gmail thread, Slack channel or Chat space to a project
 * (or an account or deal), a Gmail-shaped reader with collapsed history and a
 * reply card, the Polish button's four rewrites with Undo, attachments filed
 * into assets, documents or the budget, Slack-shaped flat rows, and the
 * studio-wide page grouped by project with the same filter.
 */

function Btn({ children, press, tone = "quiet", on }: { children: ReactNode; press?: boolean; tone?: "accent" | "quiet"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
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

/* ------------------------------------------------------------------ LINK */

export const CM_LINK_MS = 12500;

const PICK_OPEN = 900;
const PICKS = [
  { svc: "gmail", label: "Re: Hero spot, v3 cut", sub: "Maya Torres · 6 messages", at: 2000 },
  { svc: "slack", label: "#bright-water", sub: "Northline Slack · 14 members", at: 4200 },
  { svc: "gchat", label: "Bright Water agency", sub: "Google Chat space", at: 6400 },
];
const GLYPH = { gmail: GmailGlyph, slack: SlackGlyph, gchat: ChatGlyph } as const;

export function CommsLinkScene({ t }: { t: number }) {
  const linked = PICKS.filter((p) => t >= p.at + 500);
  const open = t >= PICK_OPEN && t < 7200;
  const cur = [...PICKS].reverse().find((p) => t >= p.at - 1200) ?? PICKS[0];
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Communication · Bright Water" sub="Link the conversations about this job" right={<Btn on={open} press={t >= PICK_OPEN - 60 && t < PICK_OPEN + 80}>+ Link a conversation</Btn>}>
        <div className="absolute space-y-2" style={{ left: 16, top: 66, width: 608 }}>
          {linked.length === 0 ? <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[12px] text-text-faint">No conversations linked yet</p> : null}
          {linked.map((p) => {
            const G = GLYPH[p.svc as keyof typeof GLYPH];
            return (
              <div key={p.label} className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-3 py-2.5" style={arrive(t, p.at + 500, 10)}>
                <span className="grid h-9 w-9 place-items-center rounded-[9px] border border-border"><G size={18} /></span>
                <div className="flex-1">
                  <p className="text-[13px] font-bold">{p.label}</p>
                  <p className="text-[11px] text-text-faint">{p.sub}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-white" style={{ background: "var(--accent)" }}>{p.svc === "gmail" ? 2 : p.svc === "slack" ? 5 : 1} new</span>
              </div>
            );
          })}
        </div>
        {open ? (
          <div className="absolute rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ right: 16, top: 56, width: 320, ...arrive(t, PICK_OPEN, 8) }}>
            <div className="flex gap-1.5">
              {(["gmail", "slack", "gchat"] as const).map((s) => {
                const G = GLYPH[s];
                const on = cur.svc === s;
                return (
                  <span key={s} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold" style={{ borderColor: on ? "var(--accent)" : "var(--border)", color: on ? "var(--accent)" : "var(--text-muted)" }}>
                    <G size={11} />
                    {s === "gmail" ? "Gmail" : s === "slack" ? "Slack" : "Chat"}
                  </span>
                );
              })}
            </div>
            <div className="mt-2 rounded-[8px] border border-border px-2 py-1 text-[11px] text-text-faint">{cur.svc === "gmail" ? typed("hero spot", t, cur.at - 1100, 70) || "Search your inbox" : "Search"}</div>
            <div className="mt-1.5 space-y-1">
              {[cur, { label: cur.svc === "gmail" ? "Invoice INV-2231" : cur.svc === "slack" ? "#general" : "Studio team", sub: "…" }].map((r, i) => (
                <div key={i} className="rounded-[8px] px-2 py-1.5" style={{ background: i === 0 && t >= cur.at - 300 ? "var(--accent-soft)" : undefined }}>
                  <p className="text-[11.5px] font-bold">{r.label}</p>
                  <p className="text-[10px] text-text-faint">{r.sub}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={PICKS[0].at} x={330} y={120} text="Pick the Gmail thread" />
      <ActionLabel t={t} at={PICKS[1].at} x={330} y={120} text="The Slack channel" tone="purple" />
      <ActionLabel t={t} at={PICKS[2].at} x={330} y={120} text="The Chat space" tone="green" />
      <ActionLabel t={t} at={8200} x={200} y={250} text="All of it, on the job. Nothing moved." tone="indigo" after={2200} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 300, y: 380 },
          { t: PICK_OPEN, x: 560, y: 26, click: true },
          ...PICKS.flatMap((p, i) => [
            { t: p.at - 1200, x: 360 + i * 64, y: 76, click: i > 0 },
            { t: p.at, x: 440, y: 142, click: true },
          ]),
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------- READ + REPLY */

export const CM_REPLY_MS = 13500;

const EXPAND_AT = 900;
const TYPE_AT = 2600;
const DRAFT = "hey maya thanks, we can get you v4 thursday i think, let me know if that works";
const POLISH_OPEN = 5600;
const POLISH_AT = 6400;
const POLISHED = "Hi Maya, thanks for the notes. We'll have v4 with you on Thursday. Let me know if that works for you.";
const ATTACH_AT = 8400;
const SEND_AT = 10000;

export function CommsReplyScene({ t }: { t: number }) {
  const expanded = t >= EXPAND_AT;
  const polished = t >= POLISH_AT;
  const sent = t >= SEND_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Re: Hero spot, v3 cut" sub="Gmail · linked to Bright Water" right={<span className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted"><GmailGlyph size={14} /> Gmail connected</span>}>
        <div className="absolute" style={{ left: 16, top: 62, width: 608 }}>
          {["Jon Kim", "Kim Ade"].map((n, i) => (
            <div key={n} className="flex items-center gap-2 border-b border-border py-1.5 text-[11.5px]">
              <Avatar name={n} hue={["cyan", "indigo"][i]} size={22} />
              <span className="w-[80px] font-bold">{n}</span>
              <span className="flex-1 truncate text-text-faint">{["Adding Maya for the review…", "Here's v3 with the warmer glass…"][i]}</span>
              <span className="text-[10.5px] text-text-faint">Oct {3 + i}</span>
            </div>
          ))}
          <div className="border-b border-border py-2" style={{ background: t >= EXPAND_AT - 200 && t < EXPAND_AT + 600 ? "color-mix(in oklch, var(--accent) 5%, transparent)" : undefined }}>
            <div className="flex items-center gap-2">
              <Avatar name="Maya Torres" hue="pink" size={26} />
              <span className="text-[12.5px] font-bold">Maya Torres</span>
              <span className="text-[10.5px] text-text-faint">maya@brightwater.co</span>
              <span className="ml-auto text-[10.5px] text-text-faint">Oct 5</span>
            </div>
            {expanded ? <p className="mt-1.5 pl-8 text-[12px] leading-snug text-text-muted" style={arrive(t, EXPAND_AT, 4)}>Looks great. Two small notes on the end card, attached. When can we see the next one?</p> : null}
          </div>
          {/* Reply card */}
          {t >= TYPE_AT - 400 ? (
            <div className="mt-2 rounded-[12px] border border-border" style={arrive(t, TYPE_AT - 400, 8)}>
              <p className="border-b border-border px-3 py-1.5 text-[10.5px] font-semibold text-text-faint">Reply to Maya · sends from your Gmail, stays in this thread</p>
              <p className="min-h-[64px] px-3 py-2 text-[12.5px] leading-snug" style={{ background: polished && t < POLISH_AT + 900 ? "color-mix(in oklch, var(--h-purple) 8%, transparent)" : undefined, transition: "background .4s" }}>
                {sent ? <span className="text-text-faint">Sent. The reply is in the Gmail thread.</span> : polished ? POLISHED : typed(DRAFT, t, TYPE_AT, 32)}
              </p>
              <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
                <Btn tone="accent" press={t >= SEND_AT - 60 && t < SEND_AT + 80}>Send</Btn>
                <Btn on={t >= ATTACH_AT - 300 && t < ATTACH_AT + 700}>Attach</Btn>
                <Btn on={t >= POLISH_OPEN - 300 && t < POLISH_AT + 200}>✦ Polish</Btn>
                {polished && !sent ? <span className="text-[11px] font-bold" style={{ color: "var(--accent)", ...arrive(t, POLISH_AT, 3) }}>Undo</span> : null}
                {t >= ATTACH_AT + 500 && !sent ? (
                  <span className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-0.5 text-[10.5px] font-semibold" style={arrive(t, ATTACH_AT + 500, 3)}>
                    <span className="text-[8.5px] font-black" style={{ color: "var(--h-green)" }}>MP4</span> Hero_v4_preview.mp4 · from project assets
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {/* Polish menu */}
        {t >= POLISH_OPEN && t < POLISH_AT + 150 ? (
          <div className="absolute rounded-[12px] border border-border bg-surface p-1 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 190, top: 356 - 150, width: 180, ...arrive(t, POLISH_OPEN, 6) }}>
            {[
              ["Polish", "Clean it up"],
              ["Shorten", "Say it in fewer words"],
              ["Warm up", "Friendlier"],
              ["Firm up", "More direct"],
            ].map(([k, s], i) => (
              <div key={k} className="rounded-[8px] px-2 py-1" style={{ background: i === 0 && t >= POLISH_AT - 400 ? "var(--accent-soft)" : undefined }}>
                <p className="text-[11.5px] font-bold">{k}</p>
                <p className="text-[10px] text-text-faint">{s}</p>
              </div>
            ))}
          </div>
        ) : null}
        {/* Attach menu */}
        {t >= ATTACH_AT && t < ATTACH_AT + 500 ? (
          <div className="absolute rounded-[12px] border border-border bg-surface p-1 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 100, top: 240, width: 190, ...arrive(t, ATTACH_AT, 6) }}>
            {["From your device", "From project assets", "From Google Drive"].map((k, i) => (
              <p key={k} className="rounded-[8px] px-2 py-1.5 text-[11.5px] font-semibold" style={{ background: i === 1 ? "var(--accent-soft)" : undefined }}>{k}</p>
            ))}
          </div>
        ) : null}
        <Burst t={t} at={SEND_AT} x={60} y={360} />
      </Window>
      <ActionLabel t={t} at={EXPAND_AT} x={200} y={130} text="Reads like Gmail" />
      <ActionLabel t={t} at={POLISH_OPEN} x={300} y={330} text="A quick draft? Polish it" tone="purple" after={1300} />
      <ActionLabel t={t} at={POLISH_AT + 200} x={360} y={250} text="You read it, you send it" tone="purple" after={1200} />
      <ActionLabel t={t} at={ATTACH_AT} x={250} y={330} text="Attach from the project or Drive" tone="green" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 400, y: 380 },
          { t: EXPAND_AT, x: 200, y: 142, click: true },
          { t: TYPE_AT, x: 200, y: 262, click: true },
          { t: POLISH_OPEN, x: 214, y: 355, click: true },
          { t: POLISH_AT, x: 230, y: 222, click: true },
          { t: ATTACH_AT, x: 140, y: 355, click: true },
          { t: SEND_AT, x: 52, y: 355, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------ ATTACHMENTS */

export const CM_ATTACH_MS = 12500;

const FILES = [
  { name: "EndCard_notes.pdf", type: "PDF", hue: "red", action: "Add to documents", done: "Filed to documents", at: 1400 },
  { name: "Location_photos.jpg", type: "JPG", hue: "blue", action: "Add to assets", done: "In the asset library", at: 3800 },
  { name: "Northline_INV-2231.pdf", type: "PDF", hue: "red", action: "Log as a cost", done: "Cost draft ready", at: 6200 },
];
const LINK_AT = 8800;

export function CommsAttachScene({ t }: { t: number }) {
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Attachments · Bright Water threads" sub="Every file goes where it belongs" right={<Chip tone="blue" t={t}>3 files</Chip>}>
        <div className="absolute space-y-2.5" style={{ left: 16, top: 66, width: 608 }}>
          {FILES.map((f) => {
            const done = t >= f.at + 700;
            return (
              <div key={f.name} className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-3 py-2.5">
                <span className="grid h-10 w-9 place-items-center rounded-[6px] text-[9px] font-black text-white" style={{ background: `var(--h-${f.hue})` }}>{f.type}</span>
                <div className="flex-1">
                  <p className="text-[12.5px] font-bold">{f.name}</p>
                  <p className="text-[10.5px] text-text-faint">From {f.name.startsWith("North") ? "Northline Grip" : "Maya Torres"} · Oct 5</p>
                </div>
                {done ? (
                  <Chip tone="green" t={t} since={f.at + 700}>{f.done}</Chip>
                ) : (
                  <span className="flex gap-1.5">
                    {["Add to assets", "Add to documents", "Log as a cost"].map((a) => (
                      <Btn key={a} on={a === f.action && t >= f.at - 300} press={a === f.action && t >= f.at - 60 && t < f.at + 80}>{a}</Btn>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
          {t >= FILES[2].at + 900 ? (
            <p className="px-1 text-[11px] text-text-faint" style={arrive(t, FILES[2].at + 900, 4)}>The cost opens prefilled from the invoice for you to check. See the budget page for how.</p>
          ) : null}
        </div>
        {/* A Drive file too big for Gmail */}
        {t >= LINK_AT ? (
          <div className="absolute rounded-[12px] border border-border bg-surface p-3" style={{ left: 16, top: 300, width: 608, ...arrive(t, LINK_AT, 10) }}>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Sending something big</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold"><span className="text-[8.5px] font-black" style={{ color: "var(--h-green)" }}>MOV</span> Selects_4K.mov · 180 MB</span>
              <Chip tone="blue" t={t} since={LINK_AT + 400}>sent as a Drive link</Chip>
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">Too big for Gmail, so it goes as a link, the way Gmail does it. If the file isn't shared yet, you're told before you send.</p>
          </div>
        ) : null}
      </Window>
      {FILES.map((f, i) => (
        <ActionLabel key={f.name} t={t} at={f.at} x={i === 2 ? 540 : i === 1 ? 300 : 420} y={70 + i * 62 + 36} text={["Contracts and specs → Documents", "Photos → Assets", "Invoices → the budget"][i]} tone={["indigo", "blue", "amber"][i] as "indigo"} after={900} />
      ))}
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: FILES[0].at, x: 470, y: 66 + 32, click: true },
          { t: FILES[1].at, x: 370, y: 66 + 32 + 66, click: true },
          { t: FILES[2].at, x: 570, y: 66 + 32 + 132, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------ SLACK + CHAT */

export const CM_SLACK_MS = 12000;

const MSGS = [
  { who: "Priya Shah", hue: "blue", time: "10:02", text: "Lens test is up in the drive. 50mm looks best.", at: 600 },
  { who: "Leo Park", hue: "amber", time: "10:05", text: "Agreed. I'll rig for the 50 tomorrow.", at: 1800 },
  { who: "Sam Ortiz", hue: "green", time: "10:11", text: "Call moved to 6:30 for the rig.", at: 3000 },
];
const POST_AT = 4600;
const REPLY = "Perfect. Adding the 6:30 call to the sheet now.";
const SEND2 = 7400;
const CHAT_AT = 8800;

export function CommsSlackScene({ t }: { t: number }) {
  const chat = t >= CHAT_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={chat ? "Bright Water agency · Google Chat" : "#bright-water · Slack"} sub="Read and post without leaving the project" right={<span className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">{chat ? <ChatGlyph size={14} /> : <SlackGlyph size={14} />} {chat ? "Chat" : "Slack"} connected</span>}>
        {!chat ? (
          <div className="absolute" style={{ left: 16, top: 62, width: 608 }}>
            {[...MSGS, ...(t >= SEND2 ? [{ who: "Kim Ade", hue: "indigo", time: "10:14", text: REPLY, at: SEND2 }] : [])].map((m) =>
              t >= m.at ? (
                <div key={m.who + m.time} className="flex gap-2.5 px-2 py-2" style={arrive(t, m.at, 6)}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[11px] font-extrabold" style={{ background: `var(--h-${m.hue}-bg)`, color: `var(--h-${m.hue})` }}>{m.who.split(" ").map((x) => x[0]).join("")}</span>
                  <div>
                    <p className="text-[12.5px] font-extrabold">{m.who} <span className="text-[10.5px] font-semibold text-text-faint">{m.time}</span></p>
                    <p className="text-[12.5px] text-text-muted">{m.text}</p>
                  </div>
                </div>
              ) : null,
            )}
            {t >= POST_AT - 300 && t < SEND2 ? (
              <div className="mt-2 flex items-center gap-2 rounded-[10px] border px-3 py-2" style={{ borderColor: "var(--accent)", ...arrive(t, POST_AT - 300, 6) }}>
                <p className="flex-1 text-[12.5px]">{typed(REPLY, t, POST_AT, 38)}</p>
                <Btn tone="accent" press={t >= SEND2 - 60}>Post</Btn>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="absolute" style={{ left: 16, top: 62, width: 608, ...arrive(t, CHAT_AT, 8) }}>
            {[
              { who: "Jon Kim", hue: "cyan", text: "Can we see the next cut by Friday?", time: "Tue" },
              { who: "Kim Ade", hue: "indigo", text: "Yes, v4 is with you Thursday.", time: "Tue" },
            ].map((m, i) => (
              <div key={i} className="flex gap-2.5 px-2 py-2" style={arrive(t, CHAT_AT + 200 + i * 300, 4)}>
                <Avatar name={m.who} hue={m.hue} size={32} />
                <div>
                  <p className="text-[12.5px] font-extrabold">{m.who} <span className="text-[10.5px] font-semibold text-text-faint">{m.time}</span></p>
                  <p className="text-[12.5px] text-text-muted">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={1200} x={300} y={110} text="Looks like Slack, so it feels like Slack" tone="purple" after={1400} />
      <ActionLabel t={t} at={POST_AT} x={330} y={330} text="Post straight into the channel" after={1600} />
      <ActionLabel t={t} at={CHAT_AT + 300} x={300} y={110} text="Google Chat too" tone="green" after={1600} />
      <Cursor t={t} travel={650} path={[{ t: 3600, x: 320, y: 400 }, { t: POST_AT - 300, x: 200, y: 290, click: true }, { t: SEND2, x: 590, y: 290, click: true }]} />
    </div>
  );
}

/* ---------------------------------------------------------- STUDIO-WIDE */

export const CM_STUDIO_MS = 11500;

const GROUPS = [
  { job: "Bright Water · Hero spot", hue: "indigo", rows: [["gmail", "Re: Hero spot, v3 cut", 2], ["slack", "#bright-water", 5], ["gchat", "Bright Water agency", 1]] },
  { job: "Hint · Treat Yourself", hue: "pink", rows: [["gmail", "Prelight call sheet", 0], ["slack", "#hint-shoot", 3]] },
  { job: "Lead · Aurora Foods", hue: "amber", rows: [["gmail", "Intro: spring campaign", 1]] },
] as const;
const FILTER = [
  { k: "all", at: 0 },
  { k: "slack", at: 2400 },
  { k: "gmail", at: 5200 },
  { k: "all", at: 8000 },
];

export function CommsStudioScene({ t }: { t: number }) {
  const f = [...FILTER].reverse().find((x) => t >= x.at)!.k;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Communication · every job" sub="One page for every linked conversation" right={<Chip tone="indigo" t={t}>12 unread</Chip>}>
        <div className="absolute flex gap-1.5" style={{ left: 16, top: 62 }}>
          {(["all", "gmail", "slack", "gchat"] as const).map((k) => {
            const G = k === "all" ? null : GLYPH[k];
            const on = f === k;
            return (
              <span key={k} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor: on ? "var(--accent)" : "var(--border)", color: on ? "var(--accent)" : "var(--text-muted)", background: on ? "var(--accent-soft)" : undefined }}>
                {G ? <G size={12} /> : null}
                {k === "all" ? "All" : k === "gmail" ? "Email" : k === "slack" ? "Slack" : "Chat"}
              </span>
            );
          })}
        </div>
        <div className="absolute space-y-3" style={{ left: 16, top: 98, width: 608 }}>
          {GROUPS.map((g) => {
            const rows = g.rows.filter((r) => f === "all" || r[0] === f);
            if (!rows.length) return null;
            return (
              <div key={g.job}>
                <p className="flex items-center gap-2 text-[11.5px] font-extrabold"><span className="h-2 w-2 rounded-full" style={{ background: `var(--h-${g.hue})` }} />{g.job}</p>
                <div className="mt-1 space-y-1">
                  {rows.map(([svc, label, n]) => {
                    const G = GLYPH[svc];
                    return (
                      <div key={label} className="flex items-center gap-2.5 rounded-[9px] border border-border bg-surface px-2.5 py-1.5" style={arrive(t, [...FILTER].reverse().find((x) => t >= x.at)!.at, 4)}>
                        <G size={14} />
                        <span className="flex-1 text-[12px] font-semibold">{label}</span>
                        {n ? <span className="rounded-full px-1.5 text-[10px] font-extrabold text-white" style={{ background: "var(--accent)" }}>{n}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Window>
      <ActionLabel t={t} at={FILTER[1].at} x={170} y={62} text="Just Slack" tone="purple" />
      <ActionLabel t={t} at={FILTER[2].at} x={100} y={62} text="Just email" tone="red" />
      <ActionLabel t={t} at={9400} x={260} y={330} text="Leads and clients too, not just projects" tone="amber" after={1600} />
      <Cursor t={t} travel={650} path={[{ t: 500, x: 300, y: 380 }, { t: FILTER[1].at, x: 150, y: 74, click: true }, { t: FILTER[2].at, x: 90, y: 74, click: true }, { t: FILTER[3].at, x: 36, y: 74, click: true }]} />
    </div>
  );
}

