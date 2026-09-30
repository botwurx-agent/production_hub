"use client";

import type { ReactNode } from "react";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, ramp, roll, typed, usd } from "./scene-kit";

/*
 * The estimates, proposals and invoices page's chapter scenes (640x440, pure
 * functions of t). As shipped (CLAUDE.md, "DECISION (2026-07): documents yes"):
 * three kinds with their own numbering, a document edited in place with
 * per-line tax, a style editor (three templates, accent, sans or serif, saved
 * as the studio default), a proposal signed on a no-login page with an audit
 * trail and then frozen, delivery by email, link or PDF with view tracking,
 * and an exported PDF read back in as a draft that keeps its printed number.
 * No payments are shown being taken in the app, because none are.
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

/** A small document page, used by the hero chain. */
function Page({ kind, no, total, hue, children }: { kind: string; no: string; total: string; hue: string; children?: ReactNode }) {
  return (
    <div className="relative h-[210px] w-[176px] rounded-[12px] border border-border bg-surface p-3 shadow-[0_18px_40px_-20px_rgba(40,30,90,.45)]">
      <div className="h-1.5 w-full rounded-full" style={{ background: `var(--h-${hue})` }} />
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: `var(--h-${hue})` }}>
        {kind}
      </p>
      <p className="font-display text-[15px] font-extrabold">{no}</p>
      <div className="mt-2 space-y-1.5">
        {[70, 88, 56].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-1.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-border pt-1.5">
        <span className="text-[10px] text-text-faint">Total</span>
        <span className="text-[13px] font-extrabold tabular-nums">{total}</span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ FLOW */

export const IV_FLOW_MS = 15000;

const F_EST = 800;
const F_EST_SENT = 2200;
const F_EST_SEEN = 3400;
const F_PROP = 4800;
const F_SIGN = 6200;
const F_SIGNED = 7800;
const F_INV = 9200;
const F_INV_SENT = 10600;
const F_MARGIN = 12000;

export function InvoiceFlowScene({ t }: { t: number }) {
  const sig = ramp(t, F_SIGN, 1400);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Documents · Bright Water" sub="Estimate, then proposal, then invoice" right={<Chip tone="green" t={t}>Hero spot</Chip>}>
        {/* The chain */}
        <div className="absolute flex items-start gap-[18px]" style={{ left: 22, top: 76 }}>
          {[
            { at: F_EST, kind: "Estimate", no: "EST-014", hue: "blue" },
            { at: F_PROP, kind: "Proposal", no: "PROP-006", hue: "purple" },
            { at: F_INV, kind: "Invoice", no: "INV-021", hue: "green" },
          ].map((d, i) =>
            t >= d.at ? (
              <div key={d.no} style={arrive(t, d.at, 14)}>
                <Page kind={d.kind} no={d.no} total="$24,800" hue={d.hue}>
                  {i === 1 && t >= F_SIGN ? (
                    <svg className="absolute" style={{ left: 14, bottom: 38 }} width="120" height="30" viewBox="0 0 120 30" aria-hidden="true">
                      <path
                        d="M4 22 C 14 4, 22 4, 20 20 S 34 24, 40 12 S 52 6, 56 20 S 72 22, 78 10 S 96 14, 116 18"
                        fill="none"
                        stroke="var(--text)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pathLength={1}
                        strokeDasharray={1}
                        strokeDashoffset={1 - sig}
                      />
                    </svg>
                  ) : null}
                </Page>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {i === 0 ? (
                    t >= F_EST_SEEN ? <Chip tone="blue" t={t} since={F_EST_SEEN}>Viewed</Chip> : t >= F_EST_SENT ? <Chip tone="indigo" t={t} since={F_EST_SENT}>Sent</Chip> : <Chip tone="muted" t={t}>Draft</Chip>
                  ) : null}
                  {i === 1 ? (t >= F_SIGNED ? <Chip tone="green" t={t} since={F_SIGNED}>Signed · Maya Chen</Chip> : <Chip tone="amber" t={t} since={F_PROP}>Awaiting signature</Chip>) : null}
                  {i === 2 ? (t >= F_INV_SENT ? <Chip tone="indigo" t={t} since={F_INV_SENT}>Sent</Chip> : <Chip tone="muted" t={t}>Draft</Chip>) : null}
                </div>
              </div>
            ) : (
              <div key={d.no} className="grid h-[210px] w-[176px] place-items-center rounded-[12px] border border-dashed border-border text-[11px] text-text-faint">
                {d.kind}
              </div>
            ),
          )}
        </div>
        {/* Arrows between them */}
        {[F_PROP, F_INV].map((at, i) => (
          <svg key={i} className="absolute" style={{ left: 200 + i * 194, top: 170, opacity: ramp(t, at - 300, 300) }} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}
        <Burst t={t} at={F_SIGNED} x={310} y={300} />
        {/* The budget's margin band, fed by the invoice */}
        {t >= F_MARGIN ? (
          <div className="absolute flex items-center gap-4 rounded-[12px] border border-border px-4 py-2.5" style={{ left: 22, right: 22, bottom: 18, ...arrive(t, F_MARGIN, 10) }}>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Budget</span>
            <span className="text-[12px]">
              Billed <b className="tabular-nums">{usd(Math.round(roll(0, 24800, t, F_MARGIN, 800)))}</b>
            </span>
            <span className="text-[12px]">
              Job cost <b className="tabular-nums">$17,900</b>
            </span>
            <span className="ml-auto text-[12px] font-extrabold" style={{ color: "var(--h-green)" }}>
              Margin {Math.round(roll(0, 28, t, F_MARGIN, 800))}%
            </span>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={F_EST_SENT} x={110} y={330} text="Send the estimate" after={900} />
      <ActionLabel t={t} at={F_SIGNED} x={300} y={330} text="The client signs online" tone="green" after={1200} />
      <ActionLabel t={t} at={F_INV_SENT} x={500} y={330} text="Then the invoice" after={900} />
      <ActionLabel t={t} at={F_MARGIN} x={430} y={360} text="Billed feeds the margin" tone="green" before={200} after={1800} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 1400, x: 320, y: 420 },
          { t: F_EST_SENT, x: 90, y: 318, click: true },
          { t: F_INV_SENT, x: 474, y: 318, click: true },
          { t: F_MARGIN + 600, x: 560, y: 400 },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- BUILD */

export const IV_BUILD_MS = 13500;

const B_FILL = 1400;
const B_LINES = [
  { at: 3000, d: "Production day, studio", q: 2, r: 6500 },
  { at: 4600, d: "Prop styling", q: 1, r: 2400 },
  { at: 6200, d: "Edit and color, 3 cutdowns", q: 1, r: 5200 },
];
const B_TAX = 7900;
const B_TAX_SET = 8900;

export function InvoiceBuildScene({ t }: { t: number }) {
  const shown = B_LINES.filter((l) => t >= l.at);
  const sub = shown.reduce((s, l) => s + l.q * l.r, 0);
  const tax = t >= B_TAX_SET ? Math.round(2400 * 0.0825) : 0;
  const popover = t >= B_TAX && t < B_TAX_SET + 500;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Estimate EST-014" sub="Bright Water · edited in place" right={<Chip tone="muted" t={t}>Draft · saved</Chip>}>
        <div className="absolute" style={{ left: 24, top: 70, right: 24 }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-[8px] text-[11px] font-extrabold text-white" style={{ background: "var(--accent)" }}>
                NS
              </span>
              <div>
                <p className="text-[12px] font-extrabold">Northline Studio</p>
                <p className="text-[10.5px] text-text-faint">From</p>
              </div>
            </div>
            <div className="w-[210px] rounded-[10px] border px-3 py-2" style={{ borderColor: t >= B_FILL && t < B_FILL + 900 ? "var(--accent)" : "var(--border)", transition: "border-color .3s" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Bill to</p>
              {t >= B_FILL ? (
                <div style={arrive(t, B_FILL, 4)}>
                  <p className="text-[12px] font-bold">Maya Chen</p>
                  <p className="text-[10.5px] text-text-faint">Bright Water Co. · maya@brightwater.co</p>
                </div>
              ) : (
                <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--accent)" }}>
                  Fill from a contact
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex border-b border-border pb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">
            <span className="flex-1">Item</span>
            <span className="w-[40px] text-right">Qty</span>
            <span className="w-[80px] text-right">Rate</span>
            <span className="w-[80px] text-right">Amount</span>
          </div>
          {B_LINES.map((l, i) =>
            t >= l.at ? (
              <div key={i} className="flex items-center border-b border-border py-2 text-[12px]" style={arrive(t, l.at, 4)}>
                <span className="flex-1 font-semibold">
                  {typed(l.d, t, l.at, 30)}
                  {i === 1 && t >= B_TAX_SET ? (
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: "var(--h-blue-bg)", color: "var(--h-blue)" }}>
                      Tax 8.25%
                    </span>
                  ) : i === 1 ? (
                    <span className="ml-2 text-[10.5px] font-bold text-text-faint">+ Tax</span>
                  ) : null}
                </span>
                <span className="w-[40px] text-right tabular-nums">{l.q}</span>
                <span className="w-[80px] text-right tabular-nums text-text-muted">{usd(l.r)}</span>
                <span className="w-[80px] text-right font-bold tabular-nums">{usd(l.q * l.r)}</span>
              </div>
            ) : null,
          )}
          {popover ? (
            <div className="absolute z-10 rounded-[10px] border border-border bg-surface p-2.5 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 170, top: 222, width: 150, ...arrive(t, B_TAX, 6) }}>
              <p className="text-[10.5px] font-bold text-text-faint">Tax on this line</p>
              <div className="mt-1 flex h-[28px] items-center rounded-[7px] border px-2 text-[12px] font-bold" style={{ borderColor: "var(--accent)" }}>
                {typed("8.25", t, B_TAX + 300, 90)}%
              </div>
            </div>
          ) : null}
          <div className="ml-auto mt-3 w-[230px] space-y-1 text-[12px]">
            <div className="flex justify-between">
              <span className="text-text-faint">Subtotal</span>
              <span className="tabular-nums">{usd(sub)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-faint">Tax</span>
              <span className="tabular-nums">{tax ? usd(tax) : "$0"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-[14px] font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{usd(sub + tax)}</span>
            </div>
          </div>
        </div>
      </Window>
      <ActionLabel t={t} at={B_FILL} x={400} y={80} text="Bill-To from the client's contacts" before={700} after={1000} />
      <ActionLabel t={t} at={B_LINES[0].at} x={60} y={200} text="Type straight onto the document" before={400} after={2400} />
      <ActionLabel t={t} at={B_TAX} x={210} y={212} text="Tax per line" tone="blue" after={1000} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 500, x: 330, y: 400 },
          { t: B_FILL, x: 440, y: 104, click: true },
          { t: B_LINES[0].at, x: 90, y: 196, click: true },
          { t: B_TAX, x: 214, y: 232, click: true },
          { t: B_TAX_SET + 400, x: 560, y: 380 },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- STYLE */

export const IV_STYLE_MS = 13000;

const S_MODERN = 1600;
const S_GREEN = 3400;
const S_BOLD = 5200;
const S_SERIF = 7000;
const S_PINK = 8800;
const S_SAVE = 10600;

export function InvoiceStyleScene({ t }: { t: number }) {
  const template = t >= S_BOLD ? "bold" : t >= S_MODERN ? "modern" : "classic";
  const accent = t >= S_PINK ? "pink" : t >= S_GREEN ? "green" : "indigo";
  const serif = t >= S_SERIF;
  const font = serif ? "Georgia, 'Times New Roman', serif" : undefined;
  const a = `var(--h-${accent})`;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Proposal PROP-006" sub="Customize style" right={<Chip tone="muted" t={t}>Draft</Chip>}>
        {/* The document */}
        <div className="absolute overflow-hidden rounded-[12px] border border-border bg-surface" style={{ left: 20, top: 70, width: 360, height: 350, fontFamily: font }}>
          {template === "modern" ? <div className="h-[46px] px-4 pt-3 text-[16px] font-extrabold text-white" style={{ background: a, transition: "background .3s" }}>Proposal</div> : null}
          <div className="p-4">
            {template === "classic" ? <p className="text-right text-[16px] font-extrabold">Proposal</p> : null}
            {template === "bold" ? (
              <p className="text-[30px] font-extrabold leading-none" style={{ color: a, transition: "color .3s" }}>
                Proposal
              </p>
            ) : null}
            <div className="mt-3 flex justify-between text-[10.5px]">
              <div>
                <p className="font-bold">Northline Studio</p>
                <p className="text-text-faint">PROP-006 · Oct 1</p>
              </div>
              <div className="text-right">
                <p className="font-bold">Bright Water Co.</p>
                <p className="text-text-faint">Maya Chen</p>
              </div>
            </div>
            <div className="mt-4 flex border-b pb-1 text-[9.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: a, borderColor: a, transition: "color .3s" }}>
              <span className="flex-1">Item</span>
              <span>Amount</span>
            </div>
            {[
              ["Production days, studio", "$13,000"],
              ["Prop styling", "$2,400"],
              ["Edit and color", "$5,200"],
              ["Usage, 12 months", "$4,200"],
            ].map(([d, v]) => (
              <div key={d} className="flex border-b border-border py-1.5 text-[11px]">
                <span className="flex-1">{d}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-end">
              <span className="rounded-[8px] px-3 py-1.5 text-[13px] font-extrabold" style={{ background: `color-mix(in oklch, ${a} 14%, var(--surface))`, color: a, transition: "all .3s" }}>
                Total $24,800
              </span>
            </div>
          </div>
        </div>
        {/* The panel */}
        <div className="absolute space-y-3" style={{ left: 396, top: 70, width: 226 }}>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Template</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {["classic", "modern", "bold"].map((k) => (
                <span
                  key={k}
                  className="rounded-[8px] border py-1.5 text-center text-[11px] font-bold capitalize"
                  style={{ borderColor: template === k ? "var(--accent)" : "var(--border)", background: template === k ? "color-mix(in oklch, var(--accent) 9%, var(--surface))" : undefined }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Theme color</p>
            <div className="mt-1.5 flex gap-2">
              {["indigo", "green", "blue", "amber", "pink", "red"].map((h) => (
                <span key={h} className="h-6 w-6 rounded-full" style={{ background: `var(--h-${h})`, boxShadow: accent === h ? "0 0 0 2px var(--surface), 0 0 0 4px var(--text)" : undefined }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Font</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {[
                ["Modern", false],
                ["Classic", true],
              ].map(([k, s]) => (
                <span
                  key={k as string}
                  className="rounded-[8px] border py-1.5 text-center text-[11px] font-bold"
                  style={{ fontFamily: s ? "Georgia, serif" : undefined, borderColor: serif === s ? "var(--accent)" : "var(--border)", background: serif === s ? "color-mix(in oklch, var(--accent) 9%, var(--surface))" : undefined }}
                >
                  {k as string}
                </span>
              ))}
            </div>
          </div>
          <div className="pt-1">
            <Btn on={t >= S_SAVE && t < S_SAVE + 300}>Save as default for new documents</Btn>
          </div>
        </div>
        <Toast t={t} at={S_SAVE + 200} until={S_SAVE + 2200}>Saved as your studio default</Toast>
      </Window>
      <ActionLabel t={t} at={S_MODERN} x={470} y={96} text="Pick a template" after={900} />
      <ActionLabel t={t} at={S_GREEN} x={440} y={156} text="Your color" tone="green" after={900} />
      <ActionLabel t={t} at={S_SERIF} x={560} y={210} text="Sans or serif" tone="muted" after={900} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 600, x: 500, y: 400 },
          { t: S_MODERN, x: 508, y: 100, click: true },
          { t: S_GREEN, x: 450, y: 160, click: true },
          { t: S_BOLD, x: 582, y: 100, click: true },
          { t: S_SERIF, x: 570, y: 214, click: true },
          { t: S_PINK, x: 546, y: 160, click: true },
          { t: S_SAVE, x: 470, y: 262, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ SIGN */

export const IV_SIGN_MS = 14000;

const G_FILE = 1500;
const G_NAME = 3200;
const G_DRAW = 5400;
const G_DRAW_START = 6000;
const G_ACCEPT = 8600;
const G_NOTIFY = 10400;

export function InvoiceSignScene({ t }: { t: number }) {
  const signed = t >= G_ACCEPT;
  const sig = ramp(t, G_DRAW_START, 1700);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="studio-flows.com/p/… · Proposal PROP-006"
        sub="Maya Chen at Bright Water · no login"
        right={signed ? <Chip tone="green" t={t} since={G_ACCEPT}>Signed</Chip> : <Chip tone="amber" t={t}>Awaiting signature</Chip>}
      >
        <div className="absolute" style={{ left: 20, top: 68, width: 280 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Northline Studio</p>
          <p className="font-display text-[18px] font-extrabold">Hero spot, Bright Water</p>
          <div className="mt-2 space-y-1 text-[11.5px]">
            {[
              ["Production days, studio", "$13,000"],
              ["Prop styling", "$2,400"],
              ["Edit and color", "$5,200"],
              ["Usage, 12 months", "$4,200"],
            ].map(([d, v]) => (
              <div key={d} className="flex border-b border-border py-1">
                <span className="flex-1">{d}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))}
            <div className="flex pt-1 text-[14px] font-extrabold">
              <span className="flex-1">Total</span>
              <span>$24,800</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Attached</p>
          {["Scope of work.pdf", "Usage terms.pdf"].map((f, i) => (
            <div
              key={f}
              className="mt-1.5 flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ borderColor: i === 0 && t >= G_FILE && t < G_FILE + 900 ? "var(--accent)" : "var(--border)", transition: "border-color .3s" }}
            >
              <span className="grid h-5 w-5 place-items-center rounded-[4px] text-[8px] font-extrabold text-white" style={{ background: "var(--h-red)" }}>
                PDF
              </span>
              {f}
            </div>
          ))}
        </div>
        {/* Signature panel */}
        <div className="absolute rounded-[14px] border border-border p-3.5" style={{ left: 318, top: 68, width: 302, height: 352 }}>
          {!signed ? (
            <>
              <p className="text-[12.5px] font-extrabold">Accept this proposal</p>
              <p className="mt-2 text-[10.5px] font-semibold text-text-faint">Your name</p>
              <div className="mt-0.5 flex h-[30px] items-center rounded-[8px] border px-2 text-[12px] font-semibold" style={{ borderColor: t >= G_NAME && t < G_DRAW ? "var(--accent)" : "var(--border)" }}>
                {typed("Maya Chen", t, G_NAME + 200, 70)}
              </div>
              <div className="mt-3 flex gap-1.5">
                <Btn on={t < G_DRAW}>Type</Btn>
                <Btn on={t >= G_DRAW}>Draw</Btn>
              </div>
              <div className="relative mt-2 h-[120px] rounded-[10px] border border-dashed border-border bg-surface-2/0">
                {t >= G_DRAW ? (
                  <svg className="absolute inset-0" width="272" height="120" viewBox="0 0 272 120" aria-hidden="true">
                    <path
                      d="M18 86 C 30 30, 52 24, 50 76 S 76 92, 90 50 S 116 30, 122 78 S 148 86, 162 46 S 196 58, 206 72 S 236 64, 254 60"
                      fill="none"
                      stroke="var(--text)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - sig}
                    />
                  </svg>
                ) : (
                  <p className="absolute inset-x-0 top-[48px] text-center text-[11px] text-text-faint">Typed or drawn, either counts</p>
                )}
                <span className="absolute inset-x-4 bottom-5 h-px bg-border" />
              </div>
              <div className="mt-3">
                <Btn tone="accent" on={t >= G_ACCEPT - 150}>Accept and sign</Btn>
              </div>
            </>
          ) : (
            <div style={arrive(t, G_ACCEPT, 8)}>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--h-green)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </span>
                <p className="text-[13px] font-extrabold">Signed and accepted</p>
              </div>
              <svg className="mt-2" width="200" height="70" viewBox="0 0 272 120" aria-hidden="true">
                <path d="M18 86 C 30 30, 52 24, 50 76 S 76 92, 90 50 S 116 30, 122 78 S 148 86, 162 46 S 196 58, 206 72 S 236 64, 254 60" fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className="mt-1 space-y-1.5 rounded-[10px] bg-surface-2 p-2.5 text-[11px]">
                {[
                  ["Signer", "Maya Chen"],
                  ["Email", "maya@brightwater.co"],
                  ["Signed", "Oct 2, 10:14 AM"],
                  ["IP", "recorded"],
                ].map(([k, v], i) => (
                  <div key={k} className="flex" style={arrive(t, G_ACCEPT + 300 + i * 250, 4)}>
                    <span className="w-[56px] text-text-faint">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-text-muted" style={arrive(t, G_ACCEPT + 1400, 4)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Frozen: it can't be edited after signing
              </p>
            </div>
          )}
        </div>
        <Burst t={t} at={G_ACCEPT} x={470} y={130} />
        {t >= G_NOTIFY ? (
          <div className="absolute flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 22, bottom: 16, ...arrive(t, G_NOTIFY, 10) }}>
            <Avatar name="Maya Chen" hue="green" size={24} />
            <div>
              <p className="text-[11.5px] font-bold">Your studio: proposal accepted</p>
              <p className="text-[10.5px] text-text-faint">PROP-006 signed by Maya Chen</p>
            </div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={G_FILE} x={180} y={292} text="Supporting files ride along" tone="muted" after={900} />
      <ActionLabel t={t} at={G_DRAW_START} x={400} y={230} text="Sign by drawing or typing" tone="green" before={300} after={1500} />
      <ActionLabel t={t} at={G_ACCEPT} x={420} y={370} text="Accept" tone="green" after={600} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 600, x: 300, y: 420 },
          { t: G_FILE, x: 150, y: 290, click: true },
          { t: G_NAME, x: 400, y: 132, click: true },
          { t: G_DRAW, x: 408, y: 178, click: true },
          { t: G_DRAW_START, x: 350, y: 272 },
          { t: G_DRAW_START + 1700, x: 570, y: 262 },
          { t: G_ACCEPT, x: 380, y: 360, click: true },
          { t: G_ACCEPT + 1200, x: 600, y: 420 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ SEND */

export const IV_SEND_MS = 14500;

const D_MENU = 1400;
const D_EMAIL = 2600;
const D_TYPE = 3400;
const D_SEND = 5800;
const D_MENU2 = 7400;
const D_LINK = 8600;
const D_MENU3 = 10000;
const D_PDF = 11200;
const D_VIEWED = 12600;

export function InvoiceSendScene({ t }: { t: number }) {
  const menuOpen = (t >= D_MENU && t < D_EMAIL + 100) || (t >= D_MENU2 && t < D_LINK + 100) || (t >= D_MENU3 && t < D_PDF + 100);
  const modal = t >= D_EMAIL && t < D_SEND + 300;
  const status = t >= D_VIEWED ? <Chip tone="blue" t={t} since={D_VIEWED}>Viewed</Chip> : t >= D_SEND ? <Chip tone="indigo" t={t} since={D_SEND}>Sent</Chip> : <Chip tone="muted" t={t}>Draft</Chip>;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Invoice INV-021" sub="Bright Water · $24,800 · due Nov 1" right={status}>
        <div className="absolute rounded-[12px] border border-border p-4" style={{ left: 20, top: 70, width: 380, height: 350 }}>
          <div className="h-1.5 w-full rounded-full" style={{ background: "var(--h-green)" }} />
          <p className="mt-3 text-[20px] font-extrabold" style={{ color: "var(--h-green)" }}>
            Invoice
          </p>
          <p className="text-[11px] text-text-faint">INV-021 · Northline Studio to Bright Water Co.</p>
          <div className="mt-4 space-y-1">
            {[
              ["Production days, studio", "$13,000"],
              ["Prop styling", "$2,400"],
              ["Edit and color", "$5,200"],
              ["Usage, 12 months", "$4,200"],
            ].map(([d, v]) => (
              <div key={d} className="flex border-b border-border py-1.5 text-[11.5px]">
                <span className="flex-1">{d}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-right text-[16px] font-extrabold">$24,800</p>
          <p className="mt-2 text-[10.5px] text-text-faint">Net 30. Thank you for the job.</p>
        </div>
        <div className="absolute" style={{ left: 416, top: 70, width: 204 }}>
          <Btn tone="accent" on={menuOpen}>Send ▾</Btn>
          {menuOpen ? (
            <div className="mt-1.5 overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={arrive(t, t >= D_MENU3 ? D_MENU3 : t >= D_MENU2 ? D_MENU2 : D_MENU, 6)}>
              {["Send by email", "Copy link", "Download PDF"].map((o, i) => {
                const hot = (i === 0 && t >= D_EMAIL - 400 && t < D_EMAIL + 100) || (i === 1 && t >= D_LINK - 400 && t < D_LINK + 100) || (i === 2 && t >= D_PDF - 400);
                return (
                  <div key={o} className="px-3 py-2 text-[12px] font-bold" style={{ background: hot ? "color-mix(in oklch, var(--accent) 10%, var(--surface))" : undefined }}>
                    {o}
                  </div>
                );
              })}
            </div>
          ) : null}
          {/* Delivery log */}
          <div className="mt-3 space-y-1.5" style={{ marginTop: menuOpen ? 12 : 120 }}>
            {t >= D_SEND ? (
              <p className="flex items-center gap-2 text-[11px] font-semibold" style={arrive(t, D_SEND, 4)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-indigo)" }} /> Emailed to Maya Chen
              </p>
            ) : null}
            {t >= D_LINK ? (
              <p className="flex items-center gap-2 text-[11px] font-semibold" style={arrive(t, D_LINK, 4)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-blue)" }} /> Share link copied
              </p>
            ) : null}
            {t >= D_PDF ? (
              <p className="flex items-center gap-2 text-[11px] font-semibold" style={arrive(t, D_PDF, 4)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-red)" }} /> INV-021.pdf downloaded
              </p>
            ) : null}
            {t >= D_VIEWED ? (
              <p className="flex items-center gap-2 text-[11px] font-extrabold" style={{ color: "var(--h-blue)", ...arrive(t, D_VIEWED, 4) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-blue)" }} /> Opened by the client
              </p>
            ) : null}
          </div>
        </div>
        {modal ? (
          <div className="absolute inset-0 z-10 grid place-items-center" style={{ background: "color-mix(in oklch, var(--text) 18%, transparent)", opacity: ramp(t, D_EMAIL, 200) }}>
            <div className="w-[380px] rounded-[14px] border border-border bg-surface p-4 shadow-[0_30px_60px_-20px_rgba(40,30,90,.5)]" style={arrive(t, D_EMAIL, 10)}>
              <p className="text-[13px] font-extrabold">Send Invoice INV-021</p>
              {[
                ["To", "maya@brightwater.co"],
                ["Subject", "Invoice INV-021 from Northline Studio"],
              ].map(([k, v]) => (
                <div key={k} className="mt-2">
                  <p className="text-[10.5px] font-semibold text-text-faint">{k}</p>
                  <div className="mt-0.5 flex h-[28px] items-center rounded-[7px] border border-border px-2 text-[11.5px]">{v}</div>
                </div>
              ))}
              <p className="mt-2 text-[10.5px] font-semibold text-text-faint">Message</p>
              <div className="mt-0.5 h-[58px] rounded-[7px] border px-2 py-1.5 text-[11.5px]" style={{ borderColor: "var(--accent)" }}>
                {typed("Hi Maya, here's the invoice for the hero spot. Thanks again!", t, D_TYPE, 32)}
              </div>
              <div className="mt-3 flex justify-end">
                <Btn tone="accent" on={t >= D_SEND - 150}>Send</Btn>
              </div>
            </div>
          </div>
        ) : null}
        <Toast t={t} at={D_SEND + 300} until={D_SEND + 1900}>Invoice emailed</Toast>
        <Toast t={t} at={D_LINK + 200} until={D_LINK + 1600}>Link copied</Toast>
      </Window>
      <ActionLabel t={t} at={D_EMAIL} x={190} y={40} text="By email, with your note" after={700} />
      <ActionLabel t={t} at={D_LINK} x={190} y={40} text="Or just the link" tone="blue" after={900} />
      <ActionLabel t={t} at={D_PDF} x={190} y={40} text="Or a PDF" tone="red" after={900} />
      <ActionLabel t={t} at={D_VIEWED} x={190} y={40} text="You see when they open it" tone="blue" before={200} after={1500} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 600, x: 520, y: 400 },
          { t: D_MENU, x: 450, y: 80, click: true },
          { t: D_EMAIL, x: 470, y: 116, click: true },
          { t: D_SEND, x: 482, y: 342, click: true },
          { t: D_MENU2, x: 450, y: 80, click: true },
          { t: D_LINK, x: 470, y: 152, click: true },
          { t: D_MENU3, x: 450, y: 80, click: true },
          { t: D_PDF, x: 470, y: 188, click: true },
          { t: D_PDF + 1000, x: 560, y: 410 },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- IMPORT */

export const IV_IMPORT_MS = 13000;

const I_DRAG = 1000;
const I_DROP = 2800;
const I_DONE = 5400;
const I_LINES = [
  ["Prop styling, 2 days", "$4,800"],
  ["Set build", "$7,250"],
  ["Location fee", "$3,500"],
  ["Crew meals", "$900"],
  ["Usage, 6 months", "$2,000"],
];

export function InvoiceImportScene({ t }: { t: number }) {
  const file = dragAt(t, I_DRAG, I_DROP - I_DRAG, { x: 470, y: 330 }, { x: 150, y: 214 });
  const reading = t >= I_DROP && t < I_DONE;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Documents · Hint Water" sub="Import a PDF exported from another tool" right={t >= I_DONE ? <Chip tone="muted" t={t} since={I_DONE}>Draft</Chip> : undefined}>
        {/* Left rail */}
        <div className="absolute space-y-1.5" style={{ left: 16, top: 68, width: 170 }}>
          {["New estimate", "New proposal", "New invoice"].map((b) => (
            <div key={b} className="rounded-[8px] border border-border px-2.5 py-1.5 text-[11.5px] font-bold">
              + {b}
            </div>
          ))}
          <div
            className="rounded-[8px] border px-2.5 py-3 text-[11.5px] font-bold"
            style={{
              borderStyle: "dashed",
              borderColor: t >= I_DRAG + 800 && t < I_DONE ? "var(--accent)" : "var(--border)",
              background: t >= I_DRAG + 800 && t < I_DROP ? "color-mix(in oklch, var(--accent) 8%, var(--surface))" : undefined,
              color: "var(--accent)",
            }}
          >
            Import a PDF
          </div>
          {t >= I_DONE ? (
            <div className="rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-bold" style={{ background: "color-mix(in oklch, var(--accent) 9%, var(--surface))", ...arrive(t, I_DONE, 4) }}>
              Estimate 1043
            </div>
          ) : null}
        </div>
        {/* The document */}
        <div className="absolute rounded-[12px] border border-border p-4" style={{ left: 202, top: 68, width: 420, height: 352 }}>
          {reading ? (
            <div className="grid h-full place-items-center">
              <div className="w-[240px] text-center">
                <p className="text-[12.5px] font-extrabold">Reading the document…</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full" style={{ width: `${ramp(t, I_DROP, I_DONE - I_DROP) * 100}%`, background: "var(--accent)" }} />
                </div>
                <p className="mt-2 text-[10.5px] text-text-faint">Lines, bill-to, dates, notes and terms</p>
              </div>
            </div>
          ) : t >= I_DONE ? (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[18px] font-extrabold" style={arrive(t, I_DONE, 4)}>
                  Estimate 1043
                </p>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: "var(--h-blue-bg)", color: "var(--h-blue)", ...arrive(t, I_DONE + 300, 4) }}>
                  Kept its printed number
                </span>
              </div>
              <p className="text-[11px] text-text-faint" style={arrive(t, I_DONE + 200, 4)}>
                Bill to Hint Water · Sep 12 · valid 30 days
              </p>
              <div className="mt-3">
                {I_LINES.map(([d, v], i) => (
                  <div key={d} className="flex border-b border-border py-1.5 text-[11.5px]" style={arrive(t, I_DONE + 500 + i * 300, 4)}>
                    <span className="flex-1">{d}</span>
                    <span className="tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-[16px] font-extrabold tabular-nums" style={arrive(t, I_DONE + 2100, 4)}>
                $18,450
              </p>
              <p className="mt-1 text-[10.5px] text-text-faint" style={arrive(t, I_DONE + 2400, 4)}>
                Terms: 50% to book, balance on delivery.
              </p>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-[11.5px] text-text-faint">Drop an estimate, proposal or invoice PDF</div>
          )}
        </div>
        {/* The dragged file */}
        {t >= I_DRAG - 400 && t < I_DROP + 200 ? (
          <div
            className="absolute z-20 flex items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-2 shadow-[0_18px_40px_-14px_rgba(40,30,90,.55)]"
            style={{ left: file.x - 20, top: file.y - 14, opacity: 1 - ramp(t, I_DROP, 200) }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-[5px] text-[8px] font-extrabold text-white" style={{ background: "var(--h-red)" }}>
              PDF
            </span>
            <span className="text-[11px] font-bold">Estimate_1043.pdf</span>
          </div>
        ) : null}
        <Toast t={t} at={I_DONE + 2800} until={I_DONE + 5200}>Created estimate 1043 as a draft</Toast>
      </Window>
      <ActionLabel t={t} at={I_DRAG + 400} x={430} y={290} text="The PDF you already made elsewhere" tone="muted" before={300} after={1200} />
      <ActionLabel t={t} at={I_DONE + 900} x={210} y={210} text="Back as a real document" tone="green" before={100} after={2000} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 400, x: 480, y: 420 },
          { t: I_DRAG, x: 470, y: 330, click: true },
          ...[1, 2, 3, 4, 5, 6].map((k) => {
            const at = I_DRAG + ((I_DROP - I_DRAG) * k) / 6;
            const p = dragAt(at, I_DRAG, I_DROP - I_DRAG, { x: 470, y: 330 }, { x: 150, y: 214 });
            return { t: at, x: p.x, y: p.y };
          }),
          { t: I_DROP + 900, x: 580, y: 420 },
        ]}
      />
    </div>
  );
}
