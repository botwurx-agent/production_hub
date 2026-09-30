"use client";

import type { ReactNode } from "react";
import { Art } from "./scenes-shotlist";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, ramp, typed } from "./scene-kit";

/*
 * The production hub page's chapter scenes (640x440, pure functions of t).
 * As shipped (CLAUDE.md): the project hub with its lifecycle stepper and
 * module cards in phase bands, project types that rename the stages, the
 * studio slate (one lane per project, overdue runs to today, shoot clashes
 * marked), documents filed from email with where they came from, the AI
 * summary as a label rail, and the client binder where everything starts
 * off and you choose what goes in.
 */

function Btn({ children, tone = "quiet", on }: { children: ReactNode; tone?: "accent" | "quiet"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={
        tone === "accent"
          ? { background: "var(--accent)", color: "white", transform: on ? "scale(.95)" : undefined, transition: "transform .15s" }
          : { border: "1px solid var(--border)", background: on ? "color-mix(in oklch, var(--accent) 10%, var(--surface))" : "var(--surface)", transition: "background .2s" }
      }
    >
      {children}
    </span>
  );
}

function Toast({ t, at, until, children, y = 392 }: { t: number; at: number; until: number; children: ReactNode; y?: number }) {
  if (t < at || t > until) return null;
  return (
    <div
      className="absolute left-1/2 z-20 flex items-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-2 text-[11.5px] font-bold text-white"
      style={{ top: y, background: "var(--text)", ...arrive(t, at, 8), translate: "-50% 0" }}
    >
      {children}
    </div>
  );
}

function Stepper({ labels, active, t, since }: { labels: string[]; active: number; t: number; since: number }) {
  return (
    <div className="flex items-center gap-1">
      {labels.map((l, i) => {
        const on = i === active;
        const past = i < active;
        return (
          <div key={i} className="flex items-center gap-1">
            <span
              className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
              style={{
                background: on ? "var(--accent)" : past ? "color-mix(in oklch, var(--accent) 12%, var(--surface))" : "var(--surface-2)",
                color: on ? "white" : past ? "var(--accent)" : "var(--text-muted)",
                transform: on ? `scale(${0.9 + 0.1 * ramp(t, since, 300)})` : undefined,
              }}
            >
              {l}
            </span>
            {i < labels.length - 1 ? <span className="h-px w-3 bg-border" /> : null}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- HUB */

export const HB_HUB_MS = 13500;

const H_CARDS = [
  { band: "Plan", hue: "indigo", cards: [["Brief", "Hero pour, morning light"], ["Assets", "24 files"]] },
  { band: "Visualize", hue: "purple", cards: [["Storyboards", "12 frames"], ["Shot list", "18 shots"]] },
  { band: "Review", hue: "pink", cards: [["Review", "2 waiting"], ["Communication", "3 threads"]] },
  { band: "Produce", hue: "green", cards: [["Call sheet", "Oct 4 · 9/12 confirmed"], ["Budget", "$38k of $52k"]] },
];
const H_STAGE = 7400;
const H_ATTN = 9200;

export function HubScene({ t }: { t: number }) {
  const stage = t >= H_STAGE ? 1 : 0;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Bright Water · Hero spot" sub="Bright Water Co. · shoots Oct 4 · due Oct 18" right={<Chip tone="blue" t={t}>Live action</Chip>}>
        <div className="absolute" style={{ left: 16, top: 64, right: 16 }}>
          <div className="h-1 rounded-full" style={{ background: "linear-gradient(90deg, var(--h-indigo), var(--h-pink), var(--h-green))" }} />
          <div className="mt-2.5 flex items-center justify-between">
            <Stepper labels={["Pre-pro", "Shoot", "Post", "Delivered"]} active={stage} t={t} since={H_STAGE} />
            <span className="text-[10.5px] font-bold text-text-faint">{t >= H_STAGE ? "Moved to Shoot" : "Stage"}</span>
          </div>
        </div>
        <div className="absolute grid grid-cols-4 gap-2.5" style={{ left: 16, top: 118, width: 456 }}>
          {H_CARDS.map((b, bi) => (
            <div key={b.band}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--h-${b.hue})` }} />
                {b.band}
              </p>
              <div className="space-y-2">
                {b.cards.map(([name, v], ci) => {
                  const at = 500 + (bi * 2 + ci) * 450;
                  return t >= at ? (
                    <div key={name} className="rounded-[10px] border border-border p-2" style={{ borderTop: `3px solid var(--h-${b.hue})`, ...arrive(t, at, 6) }}>
                      <span className="grid h-6 w-6 place-items-center rounded-[6px]" style={{ background: `var(--h-${b.hue}-bg)` }}>
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--h-${b.hue})` }} />
                      </span>
                      <p className="mt-1.5 text-[11.5px] font-extrabold">{name}</p>
                      <p className="text-[10px] leading-tight text-text-faint">{v}</p>
                      {name === "Budget" ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full" style={{ width: `${73 * ramp(t, at, 700)}%`, background: "var(--h-green)" }} />
                        </div>
                      ) : null}
                      {name === "Assets" ? (
                        <div className="mt-1.5 flex gap-1">
                          {[0, 1, 2].map((k) => (
                            <span key={k} className="relative h-5 w-7 overflow-hidden rounded-[4px]">
                              <Art i={k} />
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div key={name} className="h-[86px]" />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Right rail */}
        <div className="absolute space-y-2" style={{ left: 484, top: 118, width: 140 }}>
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Needs attention</p>
          {[
            { at: 4200, txt: "Storyboard v2 waiting on the client", tone: "amber" },
            { at: H_ATTN, txt: "Permit for the porch is overdue", tone: "red" },
          ].map((n) =>
            t >= n.at ? (
              <div key={n.txt} className="rounded-[9px] border border-border p-2 text-[10.5px] font-semibold leading-snug" style={{ borderLeft: `3px solid var(--h-${n.tone})`, ...arrive(t, n.at, 6) }}>
                {n.txt}
              </div>
            ) : null,
          )}
          <p className="pt-2 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Activity</p>
          {[
            { at: 5400, who: "Kim Ade", txt: "uploaded v3 of the pack shot" },
            { at: 10400, who: "Maya Chen", txt: "approved the shot list" },
          ].map((a) =>
            t >= a.at ? (
              <div key={a.txt} className="flex gap-1.5 text-[10px] leading-snug" style={arrive(t, a.at, 6)}>
                <Avatar name={a.who} hue="blue" size={18} />
                <span>
                  <b>{a.who.split(" ")[0]}</b> {a.txt}
                </span>
              </div>
            ) : null,
          )}
        </div>
        <Toast t={t} at={H_STAGE + 200} until={H_STAGE + 1700}>Stage set to Shoot</Toast>
      </Window>
      <ActionLabel t={t} at={H_STAGE} x={96} y={78} text="The stage is one click" after={1000} />
      <ActionLabel t={t} at={2000} x={130} y={300} text="Every module shows live numbers" tone="muted" before={100} after={2200} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 5800, x: 320, y: 420 },
          { t: H_STAGE, x: 88, y: 80, click: true },
          { t: H_ATTN + 400, x: 540, y: 190 },
          { t: H_ATTN + 2200, x: 560, y: 420 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ TYPES */

export const HB_TYPE_MS = 12500;

const Y_TYPES = [
  { k: "Live action", d: "A crew and a set", hue: "blue" },
  { k: "Commercial", d: "A brand spot", hue: "green" },
  { k: "AI video", d: "Generated shots", hue: "purple" },
  { k: "CGI / VFX", d: "Built in 3D", hue: "amber" },
];
const Y_PICK = 2200;
const Y_NEXT = 3600;
const Y_NAME = 4200;
const Y_CREATE = 6600;
const Y_STAGE = 9000;

export function HubTypeScene({ t }: { t: number }) {
  const wizard = t < Y_CREATE + 200;
  const step2 = t >= Y_NEXT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={wizard ? "New project" : "Aurora · Launch film"} sub={wizard ? (step2 ? "Step 2 of 2 · details" : "Step 1 of 2 · what kind of job") : "Northwind · AI video"} right={wizard ? undefined : <Chip tone="purple" t={t} since={Y_CREATE}>AI video</Chip>}>
        {wizard && !step2 ? (
          <div className="absolute grid grid-cols-2 gap-3" style={{ left: 24, top: 76, right: 24 }}>
            {Y_TYPES.map((y, i) => {
              const on = i === 2 && t >= Y_PICK;
              return (
                <div
                  key={y.k}
                  className="rounded-[14px] border p-4"
                  style={{
                    borderColor: on ? `var(--h-${y.hue})` : "var(--border)",
                    background: on ? `color-mix(in oklch, var(--h-${y.hue}) 8%, var(--surface))` : "var(--surface)",
                    ...arrive(t, 300 + i * 200, 6),
                  }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `var(--h-${y.hue}-bg)` }}>
                    <span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: `var(--h-${y.hue})` }} />
                  </span>
                  <p className="mt-2 text-[13px] font-extrabold">{y.k}</p>
                  <p className="text-[11px] text-text-faint">{y.d}</p>
                </div>
              );
            })}
            <div className="col-span-2 flex justify-end">
              <Btn tone="accent" on={t >= Y_NEXT - 150}>Next</Btn>
            </div>
          </div>
        ) : null}
        {wizard && step2 ? (
          <div className="absolute space-y-3" style={{ left: 24, top: 76, right: 24, ...arrive(t, Y_NEXT, 6) }}>
            {[
              ["Project name", typed("Aurora · Launch film", t, Y_NAME, 45)],
              ["Client", t >= Y_NAME + 1200 ? "Northwind" : ""],
              ["Due date", t >= Y_NAME + 1700 ? "Nov 20" : ""],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[10.5px] font-semibold text-text-faint">{k as string}</p>
                <div className="mt-0.5 flex h-[32px] items-center rounded-[8px] border border-border px-2.5 text-[12.5px] font-semibold">{v}</div>
              </div>
            ))}
            <div className="flex justify-end">
              <Btn tone="accent" on={t >= Y_CREATE - 150}>Create project</Btn>
            </div>
          </div>
        ) : null}
        {!wizard ? (
          <div className="absolute" style={{ left: 20, top: 72, right: 20, ...arrive(t, Y_CREATE + 200, 8) }}>
            <Stepper labels={["Concept", "Generation", "Post", "Delivered"]} active={t >= Y_STAGE ? 1 : 0} t={t} since={Y_STAGE} />
            <p className="mt-2 text-[11px] text-text-muted">Stages named for how this kind of job actually runs.</p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                ["AI pipeline", "purple", "Shown for AI video"],
                ["Elements", "purple", "Characters, places, props"],
                ["Storyboards", "purple", "Frames for the sequence"],
                ["Review", "pink", "Takes and the master cut"],
                ["Budget", "green", "Bid against actual"],
                ["Delivery", "green", "Deliverables and billing"],
              ].map(([k, h, d], i) => (
                <div key={k} className="rounded-[10px] border border-border p-2.5" style={{ borderTop: `3px solid var(--h-${h})`, ...arrive(t, Y_CREATE + 500 + i * 180, 5) }}>
                  <p className="text-[12px] font-extrabold">{k}</p>
                  <p className="text-[10.5px] text-text-faint">{d}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <Burst t={t} at={Y_STAGE} x={130} y={86} />
      </Window>
      <ActionLabel t={t} at={Y_PICK} x={60} y={250} text="Pick the kind of job" before={700} after={900} />
      <ActionLabel t={t} at={Y_CREATE + 900} x={60} y={330} text="The stages rename themselves" tone="purple" before={0} after={1800} />
      <ActionLabel t={t} at={Y_STAGE} x={330} y={40} text="Into Generation" tone="green" after={900} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 800, x: 320, y: 420 },
          { t: Y_PICK, x: 150, y: 290, click: true },
          { t: Y_NEXT, x: 590, y: 370, click: true },
          { t: Y_NAME - 100, x: 200, y: 110, click: true },
          { t: Y_CREATE, x: 560, y: 270, click: true },
          { t: Y_STAGE, x: 140, y: 88, click: true },
          { t: Y_STAGE + 1400, x: 560, y: 420 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ SLATE */

export const HB_SLATE_MS = 12500;

const L_LANES = [
  { name: "Bright Water · Hero spot", segs: [["prepro", 0, 5], ["shoot", 5, 7], ["post", 7, 14]] },
  { name: "Hint · Treat yourself", segs: [["prepro", 1, 6], ["shoot", 6, 8], ["post", 8, 16]] },
  { name: "Aurora · Launch film", segs: [["prepro", 3, 9], ["shoot", 9, 11], ["post", 11, 18]] },
  { name: "IQBar · Bites", segs: [["post", 0, 3], ["overdue", 3, 6]] },
  { name: "Northline · Reel", segs: [["prepro", 10, 15], ["shoot", 15, 16]] },
] as const;
const L_COLORS: Record<string, string> = { prepro: "indigo", shoot: "amber", post: "blue", overdue: "red" };
const L_VIEW = 1400;
const L_PAGE = 7600;

export function HubSlateScene({ t }: { t: number }) {
  const DAY = 22;
  const off = t >= L_PAGE ? -Math.round(4 * ramp(t, L_PAGE, 500)) : 0;
  const today = 6 + off;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Projects · Slate"
        sub="Every live job on one timeline"
        right={
          <span className="flex gap-1">
            {["Board", "List", "Slate"].map((v) => (
              <Btn key={v} on={v === "Slate" ? t >= L_VIEW : t < L_VIEW && v === "Board"}>
                {v}
              </Btn>
            ))}
          </span>
        }
      >
        <div className="absolute" style={{ left: 16, top: 66, right: 16, opacity: ramp(t, L_VIEW, 300) }}>
          <div className="flex text-[9.5px] font-bold text-text-faint">
            <span className="w-[150px] shrink-0" />
            <div className="relative h-4 flex-1 overflow-hidden">
              {Array.from({ length: 24 }).map((_, d) => (
                <span key={d} className="absolute" style={{ left: (d + off) * DAY }}>
                  {d % 7 === 0 ? `Oct ${d + 1}` : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="relative mt-1">
            {L_LANES.map((l, li) => (
              <div key={l.name} className="flex h-[44px] items-center border-b border-border">
                <span className="w-[150px] shrink-0 truncate pr-2 text-[11.5px] font-bold">{l.name}</span>
                <div className="relative h-full flex-1 overflow-hidden">
                  {l.segs.map(([k, a, b], si) => {
                    const at = L_VIEW + 300 + li * 250 + si * 120;
                    const w = (b - a) * DAY * ramp(t, at, 400);
                    return (
                      <span
                        key={si}
                        className="absolute top-1/2 h-[18px] -translate-y-1/2 rounded-[5px]"
                        style={{
                          left: (a + off) * DAY,
                          width: w,
                          background: k === "overdue" ? "var(--h-red-bg)" : `color-mix(in oklch, var(--h-${L_COLORS[k]}) 70%, var(--surface))`,
                          border: k === "overdue" ? "1.5px dashed var(--h-red)" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Today line */}
            <span className="absolute inset-y-0 w-[2px]" style={{ left: 150 + today * DAY, background: "var(--accent)", opacity: ramp(t, L_VIEW + 1600, 300) }} />
            {/* Shoot clash */}
            {t >= 4600 ? (
              <span
                className="absolute rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ left: 150 + (6 + off) * DAY - 30, top: -6, background: "var(--h-amber-bg)", color: "var(--h-amber)", ...arrive(t, 4600, 4) }}
              >
                2 shoots Oct 7
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-3 text-[10.5px] font-semibold text-text-muted">
            {[
              ["Pre-pro", "indigo"],
              ["Shoot", "amber"],
              ["Post", "blue"],
              ["Overdue", "red"],
            ].map(([k, h]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-[3px]" style={{ background: `var(--h-${h})` }} />
                {k}
              </span>
            ))}
            <span className="ml-auto flex gap-1">
              {["4 wk", "6 wk", "12 wk"].map((w, i) => (
                <span key={w} className="rounded-full px-2 py-0.5" style={{ background: i === 0 ? "var(--surface-2)" : undefined }}>
                  {w}
                </span>
              ))}
            </span>
          </div>
        </div>
      </Window>
      <ActionLabel t={t} at={L_VIEW} x={430} y={30} text="Board, list, or the slate" before={700} after={800} />
      <ActionLabel t={t} at={4600} x={330} y={60} text="Two shoots on one day" tone="amber" before={100} after={1600} />
      <ActionLabel t={t} at={6000} x={330} y={234} text="Overdue runs to today" tone="red" before={0} after={1400} />
      <ActionLabel t={t} at={L_PAGE} x={560} y={60} text="Page by the week" tone="muted" after={1000} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 500, x: 400, y: 120 },
          { t: L_VIEW, x: 592, y: 26, click: true },
          { t: 5900, x: 300, y: 230 },
          { t: L_PAGE, x: 560, y: 60, click: true },
          { t: L_PAGE + 1400, x: 560, y: 420 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- DOCS */

export const HB_DOCS_MS = 12500;

const D_FILE = 1800;
const D_DOCS = 3400;

export function HubDocsScene({ t }: { t: number }) {
  const docs = t >= D_DOCS;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={docs ? "Documents · Bright Water" : "Communication · Bright Water"} sub={docs ? "Paperwork that isn't creative work" : "Linked Gmail thread"} right={docs ? <Chip tone="muted" t={t}>Crew can see these</Chip> : undefined}>
        {!docs ? (
          <div className="absolute" style={{ left: 20, top: 70, right: 20 }}>
            <div className="flex items-center gap-2.5">
              <Avatar name="Sean Doe" hue="blue" size={30} />
              <div>
                <p className="text-[12.5px] font-extrabold">Sean Doe · Culver City permits</p>
                <p className="text-[11px] text-text-faint">Re: Porch permit, approved · Aug 14</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed">Hi, the permit for the porch shoot is approved. Attached is the signed copy for your records.</p>
            <div className="mt-3 flex w-[300px] items-center gap-2.5 rounded-[10px] border border-border p-2.5">
              <span className="grid h-9 w-8 place-items-center rounded-[5px] text-[8.5px] font-extrabold text-white" style={{ background: "var(--h-red)" }}>
                PDF
              </span>
              <div className="flex-1">
                <p className="text-[11.5px] font-bold">Scan_20260814.pdf</p>
                <p className="text-[10px] text-text-faint">412 KB</p>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              <Btn on={t >= D_FILE - 150}>Add to documents</Btn>
              <Btn>Add to assets</Btn>
              <Btn>Log as a cost</Btn>
            </div>
          </div>
        ) : (
          <div className="absolute space-y-2" style={{ left: 20, top: 70, right: 20 }}>
            {[
              { n: "Porch permit", src: "From Sean Doe, Aug 14, re: Porch permit, approved", v: 1, new: true },
              { n: "Certificate of insurance", src: "From Hartley Insurance, Aug 2", v: 2 },
              { n: "Delivery specs", src: "From Bright Water Co., Jul 28, re: Final delivery specs", v: 3 },
              { n: "Location agreement", src: "Uploaded by Kim Ade, Jul 20", v: 1 },
            ].map((d, i) => (
              <div
                key={d.n}
                className="flex items-center gap-3 rounded-[10px] border p-2"
                style={{
                  borderColor: d.new && t < D_DOCS + 1600 ? "var(--accent)" : "var(--border)",
                  ...arrive(t, D_DOCS + i * 200, 6),
                }}
              >
                <div className="relative h-[52px] w-[42px] shrink-0 overflow-hidden rounded-[5px] border border-border bg-surface">
                  <div className="space-y-1 p-1.5">
                    <span className="block h-1 w-5 rounded-full" style={{ background: "var(--text-faint)" }} />
                    {[80, 90, 60, 85].map((w, k) => (
                      <span key={k} className="block h-[3px] rounded-full bg-surface-2" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-extrabold">{d.n}</p>
                  <p className="truncate text-[10.5px] text-text-faint">{d.src}</p>
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold">{d.v > 1 ? `v${d.v}` : "v1"}</span>
                <Btn on={i === 0 && t >= 7000 && t < 7400}>Open</Btn>
              </div>
            ))}
          </div>
        )}
        {t >= 7400 ? (
          <div className="absolute inset-0 z-10 grid place-items-center" style={{ background: "color-mix(in oklch, var(--text) 18%, transparent)", opacity: ramp(t, 7400, 200) }}>
            <div className="w-[300px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_30px_60px_-20px_rgba(40,30,90,.5)]" style={arrive(t, 7400, 10)}>
              <p className="text-[12px] font-extrabold">Porch permit</p>
              <p className="text-[10px] text-text-faint">Viewed here, not downloaded</p>
              <div className="mt-2 space-y-1.5 rounded-[8px] bg-surface-2 p-3">
                <span className="block h-2 w-24 rounded-full" style={{ background: "var(--text-faint)" }} />
                {[90, 80, 95, 70, 85, 60, 88].map((w, k) => (
                  <span key={k} className="block h-1.5 rounded-full bg-surface" style={{ width: `${w}%` }} />
                ))}
                <span className="mt-2 block h-6 w-20 rounded-[4px]" style={{ border: "1.5px solid var(--h-green)" }} />
              </div>
            </div>
          </div>
        ) : null}
        <Toast t={t} at={D_FILE + 200} until={D_DOCS - 100}>Filed to Documents</Toast>
      </Window>
      <ActionLabel t={t} at={D_FILE} x={40} y={230} text="File it from the email" before={700} after={800} />
      <ActionLabel t={t} at={D_DOCS + 600} x={240} y={90} text="It remembers where it came from" tone="indigo" before={0} after={2400} />
      <ActionLabel t={t} at={7000} x={560} y={96} text="Open to view it" tone="muted" after={500} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 500, x: 320, y: 420 },
          { t: D_FILE, x: 76, y: 232, click: true },
          { t: 6000, x: 360, y: 300 },
          { t: 7000, x: 590, y: 98, click: true },
          { t: 9600, x: 560, y: 420 },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- SUMMARY */

export const HB_SUMMARY_MS = 12000;

const U_GEN = 1300;
const U_LEAD = 2600;
const U_GROUPS = [
  { at: 3600, k: "Done", hue: "green", items: ["Shot list approved by Maya", "Crew call sheet sent, 9 of 12 confirmed"] },
  { at: 4600, k: "Waiting on", hue: "amber", items: ["Storyboard v2 sign-off from the client"] },
  { at: 5400, k: "Next action", hue: "indigo", items: ["Chase the porch permit before Thursday"] },
  { at: 6200, k: "Watch", hue: "red", items: ["Art department is $1,100 over its line"] },
];
const U_FOLD = 8800;

export function HubSummaryScene({ t }: { t: number }) {
  const folded = t >= U_FOLD;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Bright Water · Hero spot" sub="Project hub" right={<Btn on={t >= U_GEN - 150 && t < U_GEN + 200}>{t >= U_LEAD ? "Refresh" : "Generate summary"}</Btn>}>
        <div className="absolute rounded-[14px] border border-border" style={{ left: 16, top: 66, right: 16, height: folded ? 76 : 330, transition: "height .45s cubic-bezier(.3,.8,.3,1)", overflow: "hidden" }}>
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="grid h-6 w-6 place-items-center rounded-[6px] text-[10px] font-extrabold text-white" style={{ background: "var(--accent)" }}>
              AI
            </span>
            <p className="text-[12.5px] font-extrabold">Project summary</p>
            <span className="ml-auto text-[11px] font-bold text-text-faint" style={{ transform: folded ? "rotate(-90deg)" : undefined, transition: "transform .3s" }}>
              ▾
            </span>
          </div>
          {t >= U_GEN && t < U_LEAD ? (
            <div className="space-y-2 px-4 pt-3">
              {[90, 70, 80].map((w, i) => (
                <span key={i} className="block h-2.5 rounded-full bg-surface-2" style={{ width: `${w}%`, opacity: 0.5 + 0.5 * Math.abs(Math.sin((t - U_GEN) / 300 + i)) }} />
              ))}
            </div>
          ) : null}
          {t >= U_LEAD ? (
            <p className={`px-4 pt-2 text-[13.5px] font-semibold leading-snug ${folded ? "truncate" : ""}`} style={arrive(t, U_LEAD, 4)}>
              On track for the Oct 4 shoot, with the client's storyboard sign-off the one thing holding up pre-production.
            </p>
          ) : null}
          <div className="mt-3 px-4">
            {U_GROUPS.map((g) =>
              t >= g.at ? (
                <div key={g.k} className="flex gap-3 border-t border-border py-2" style={arrive(t, g.at, 4)}>
                  <span className="w-[112px] shrink-0">
                    <Chip tone={g.hue as "green"} t={t} since={g.at}>
                      {g.k}
                    </Chip>
                  </span>
                  <div className="space-y-1 text-[12px]">
                    {g.items.map((it) => (
                      <p key={it}>{it}</p>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
        {folded ? (
          <div className="absolute grid grid-cols-3 gap-2.5" style={{ left: 16, top: 156, right: 16 }}>
            {["Brief", "Assets", "Storyboards", "Shot list", "Review", "Budget"].map((k, i) => (
              <div key={k} className="rounded-[10px] border border-border p-2.5 text-[12px] font-extrabold" style={arrive(t, U_FOLD + 200 + i * 100, 6)}>
                {k}
              </div>
            ))}
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={U_GEN} x={560} y={24} text="Where does this job stand?" before={700} after={900} />
      <ActionLabel t={t} at={U_GROUPS[0].at} x={150} y={170} text="Sorted into what matters" tone="green" before={0} after={3000} />
      <ActionLabel t={t} at={U_FOLD} x={560} y={80} text="Fold it to the one line" tone="muted" after={1200} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 300, x: 400, y: 200 },
          { t: U_GEN, x: 580, y: 28, click: true },
          { t: U_FOLD, x: 594, y: 86, click: true },
          { t: U_FOLD + 1600, x: 560, y: 420 },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- BINDER */

export const HB_BINDER_MS = 13500;

const N_SECTIONS = [
  { k: "Shot list", at: 1400 },
  { k: "Storyboard · Hero pour", at: 2300 },
  { k: "Moodboard · Look", at: 3200 },
  { k: "Call sheet · Day 1", at: 4100 },
  { k: "Schedule", at: -1 },
  { k: "Contacts", at: -1 },
];
const N_NOTES = 5400;
const N_SHARE = 7200;

export function HubBinderScene({ t }: { t: number }) {
  const on = N_SECTIONS.map((s) => s.at > 0 && t >= s.at);
  const count = on.filter(Boolean).length;
  const hide = t >= N_NOTES;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Client binder · Bright Water" sub="Everything the client asked to see, in one place" right={t >= N_SHARE ? <Chip tone="green" t={t} since={N_SHARE}>Shared</Chip> : <Chip tone="muted" t={t}>Not shared</Chip>}>
        <div className="absolute" style={{ left: 16, top: 66, width: 250 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">In the binder</p>
          <p className="text-[10.5px] text-text-faint">Everything starts off. Tick what goes in.</p>
          <div className="mt-2 space-y-1.5">
            {N_SECTIONS.map((s, i) => (
              <div key={s.k} className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ borderColor: on[i] ? "var(--accent)" : "var(--border)" }}>
                <span className="grid h-4 w-4 place-items-center rounded-[4px] text-white" style={{ background: on[i] ? "var(--accent)" : "var(--surface-2)" }}>
                  {on[i] ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  ) : null}
                </span>
                {s.k}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] font-semibold">
            <span className="relative h-4 w-7 rounded-full" style={{ background: hide ? "var(--accent)" : "var(--surface-2)", transition: "background .3s" }}>
              <span className="absolute top-0.5 h-3 w-3 rounded-full bg-surface" style={{ left: hide ? 14 : 2, transition: "left .3s" }} />
            </span>
            Hide internal notes
          </div>
          <div className="mt-3">
            <Btn tone="accent" on={t >= N_SHARE - 150 && t < N_SHARE + 200}>Share binder</Btn>
          </div>
        </div>
        {/* Preview */}
        <div className="absolute overflow-hidden rounded-[12px] border border-border" style={{ left: 280, top: 66, right: 16, height: 356 }}>
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ background: "var(--surface-2)" }}>
            Preview · {count} {count === 1 ? "section" : "sections"}
          </div>
          <div className="space-y-2 p-3">
            {on[0] ? (
              <div style={arrive(t, N_SECTIONS[0].at, 6)}>
                <p className="text-[11.5px] font-extrabold">Shot list</p>
                {[
                  ["1A", "Hero pour, top light", "Hold two beats on the fill"],
                  ["1B", "Bottle rotate", "Backup: use the turntable"],
                ].map(([c, d, n]) => (
                  <div key={c} className="flex gap-2 border-b border-border py-1 text-[10.5px]">
                    <b className="w-5">{c}</b>
                    <span className="flex-1">{d}</span>
                    <span className="w-[120px] truncate text-text-faint" style={{ opacity: hide ? 0 : 1, transition: "opacity .3s" }}>
                      {n}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {on[1] ? (
              <div style={arrive(t, N_SECTIONS[1].at, 6)}>
                <p className="text-[11.5px] font-extrabold">Storyboard · Hero pour</p>
                <div className="mt-1 flex gap-1.5">
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className="relative h-[34px] w-[58px] overflow-hidden rounded-[5px]">
                      <Art i={k} />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {on[2] ? (
              <div style={arrive(t, N_SECTIONS[2].at, 6)}>
                <p className="text-[11.5px] font-extrabold">Moodboard · Look</p>
                <div className="mt-1 flex gap-1.5">
                  {[4, 6, 5].map((k) => (
                    <span key={k} className="relative h-[34px] w-[44px] overflow-hidden rounded-[5px]">
                      <Art i={k} />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {on[3] ? (
              <div style={arrive(t, N_SECTIONS[3].at, 6)}>
                <p className="text-[11.5px] font-extrabold">Call sheet · Day 1</p>
                <p className="text-[10.5px] text-text-faint">Crew call 7:00 AM · Stage 2, Culver City</p>
              </div>
            ) : null}
          </div>
        </div>
        <Toast t={t} at={N_SHARE + 200} until={N_SHARE + 2400}>Link copied · studio-flows.com/bd/…</Toast>
      </Window>
      <ActionLabel t={t} at={N_SECTIONS[0].at} x={40} y={106} text="Choose what the client sees" before={700} after={2600} />
      <ActionLabel t={t} at={N_NOTES} x={150} y={282} text="Notes removed, not just hidden" tone="red" after={1400} />
      <ActionLabel t={t} at={N_SHARE} x={100} y={318} text="One link, all of it" tone="green" after={1400} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 600, x: 320, y: 420 },
          ...N_SECTIONS.filter((s) => s.at > 0).map((s) => ({ t: s.at, x: 38, y: 108 + N_SECTIONS.indexOf(s) * 30, click: true })),
          { t: N_NOTES, x: 40, y: 298, click: true },
          { t: N_SHARE, x: 60, y: 330, click: true },
          { t: N_SHARE + 1600, x: 300, y: 420 },
        ]}
      />
    </div>
  );
}
