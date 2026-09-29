"use client";

import type { ReactNode } from "react";
import { GmailGlyph } from "@/components/communication/comms-ui";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, easeOut, ramp, roll, spring, typed, usd } from "./scene-kit";

/*
 * The budget page's chapter scenes. Same contract as every scene: 640x440, a
 * pure function of t, actions about a second apart with a label beside the
 * pointer. Every behaviour shown here is the real one (see CLAUDE.md, "Budget"
 * slices 1 to 5): a line's actual is the sum of its costs, a typed actual
 * still works when none are filed, the invoice reader fills a draft and the
 * producer saves it, and a split builds a deposit and a balance.
 */

const TITLE = "Budget · Bright Water";

function Tile({ k, v, hue, live }: { k: string; v: string; hue: string; live?: boolean }) {
  return (
    <div
      className="rounded-[12px] border border-border px-3 py-2"
      style={{ borderTop: `3px solid var(--h-${hue})`, background: live ? `color-mix(in oklch, var(--h-${hue}) 8%, var(--surface))` : "var(--surface)", transition: "background .3s" }}
    >
      <p className="text-[10.5px] font-semibold text-text-faint">{k}</p>
      <p className="font-display text-[19px] font-extrabold tabular-nums leading-tight">{v}</p>
    </div>
  );
}

function Field({ label, value, lit, w = "100%", children }: { label: string; value?: ReactNode; lit?: boolean; w?: string | number; children?: ReactNode }) {
  return (
    <div style={{ width: w }}>
      <p className="text-[10.5px] font-semibold text-text-faint">{label}</p>
      <div
        className="mt-0.5 flex h-[30px] items-center rounded-[8px] border px-2 text-[12px] font-semibold"
        style={{
          borderColor: lit ? "var(--accent)" : "var(--border)",
          background: lit ? "color-mix(in oklch, var(--accent) 6%, var(--surface))" : "var(--surface)",
          transition: "border-color .3s, background .3s",
        }}
      >
        {value}
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- BID V ACTUAL */

export const BG_LINES_MS = 12000;

const LINES = [
  { name: "Crew", bid: 12000, actual: 8000, to: 9800, at: 2600, src: "3 invoices" },
  { name: "Camera & grip", bid: 8500, actual: 8500, to: 9100, at: 7200, src: "2 invoices" },
  { name: "Art department", bid: 6000, actual: 5200, src: "2 invoices" },
  { name: "Catering", bid: 2400, actual: 1900, src: "1 invoice" },
  { name: "Post", bid: 7000, actual: 0, to: 3600, at: 5000, src: "Typed" },
];

export function BudgetLinesScene({ t }: { t: number }) {
  const actuals = LINES.map((l) => (l.to !== undefined && l.at !== undefined ? roll(l.actual, l.to, t, l.at, 800) : l.actual));
  const total = actuals.reduce((s, a) => s + a, 0);
  const bid = LINES.reduce((s, l) => s + l.bid, 0);
  const over = total - bid;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={TITLE} sub="Bid against actual, line by line" right={t >= 7600 ? <Chip tone="amber" t={t} since={7600}>1 line over</Chip> : <Chip tone="blue" t={t}>On track</Chip>}>
        <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 66, width: 608 }}>
          <Tile k="Bid" v={usd(bid)} hue="indigo" />
          <Tile k="Actual so far" v={usd(total)} hue="amber" live={LINES.some((l) => l.at !== undefined && t >= l.at && t < l.at + 900)} />
          <Tile k="Left in the bid" v={usd(bid - total)} hue={over > 0 ? "red" : "green"} />
        </div>
        <div className="absolute flex text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint" style={{ left: 24, top: 142, width: 592 }}>
          <span className="w-[124px]">Line</span>
          <span className="w-[70px] text-right">Bid</span>
          <span className="flex-1" />
          <span className="w-[70px] text-right">Actual</span>
          <span className="w-[98px] pl-3">From</span>
        </div>
        {LINES.map((l, i) => {
          const a = actuals[i];
          const lit = l.at !== undefined && t >= l.at - 200 && t < l.at + 1100;
          const ledger = l.src !== "Typed";
          const showSrc = !l.at || t >= l.at;
          const redBar = a > l.bid;
          return (
            <div
              key={l.name}
              className="absolute flex h-[44px] items-center rounded-[8px] px-2"
              style={{ left: 16, top: 160 + i * 48, width: 608, background: lit ? "color-mix(in oklch, var(--accent) 7%, transparent)" : undefined, transition: "background .3s" }}
            >
              <span className="w-[124px] text-[13px] font-bold">{l.name}</span>
              <span className="w-[70px] text-right text-[11.5px] tabular-nums text-text-faint">{usd(l.bid)}</span>
              <div className="relative mx-3 h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (a / l.bid) * 100)}%`, background: redBar ? "var(--h-red)" : "var(--h-blue)", transition: "background .3s" }} />
              </div>
              <span className="w-[70px] text-right text-[13px] font-bold tabular-nums" style={{ color: redBar ? "var(--h-red)" : undefined }}>
                {a ? usd(a) : "—"}
              </span>
              <span className="w-[98px] pl-3">
                {showSrc && a ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ background: ledger ? "var(--h-blue-bg)" : "var(--surface-2)", color: ledger ? "var(--h-blue)" : "var(--text-muted)", ...(l.at ? arrive(t, l.at, 4) : {}) }}
                  >
                    {ledger ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 3h9l4 4v14H6z M9 12h7 M9 16h5" />
                      </svg>
                    ) : null}
                    {l.src}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
        {/* The cost that just landed */}
        {t >= 2200 && t < 4400 ? (
          <div className="absolute flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 20, top: 104, ...arrive(t, 2200, -10) }}>
            <Avatar name="Priya Shah" hue="blue" size={24} />
            <div>
              <p className="text-[11.5px] font-bold">Cost logged · Priya Shah, DP</p>
              <p className="text-[10.5px] text-text-faint">$1,800 filed to Crew</p>
            </div>
          </div>
        ) : null}
        <Burst t={t} at={LINES[0].at!} x={500} y={182} />
      </Window>
      <ActionLabel t={t} at={LINES[0].at!} x={420} y={170} text="A cost lands on its line" tone="blue" after={1200} />
      <ActionLabel t={t} at={LINES[4].at!} x={430} y={362} text="Or type a quick actual" tone="muted" after={1200} />
      <ActionLabel t={t} at={LINES[1].at!} x={430} y={218} text="Over the bid turns red" tone="red" after={1400} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 3800, x: 320, y: 400 },
          { t: LINES[4].at! - 200, x: 560, y: 374, click: true },
          { t: 6400, x: 360, y: 300 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------- LOG A COST */

export const BG_LEDGER_MS = 13000;

const PICK_OPEN = 900;
const PICK_AT = 1900;
const DAYS_AT = 3300;
const AMOUNT_AT = 4500;
const CHECK_AT = 5600;
const FILE_AT = 6800;
const SAVE_AT = 8000;
const STATUS = [
  { at: 9500, s: "Approved", tone: "blue" as const },
  { at: 10800, s: "Paid", tone: "green" as const },
];

export function BudgetLedgerScene({ t }: { t: number }) {
  const saved = t >= SAVE_AT;
  const status = [...STATUS].reverse().find((x) => t >= x.at);
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={TITLE} sub="Cost ledger · every actual backed by an invoice" right={<Chip tone="muted" t={t}>{saved ? "4 costs" : "3 costs"}</Chip>}>
        {/* The ledger behind the modal */}
        <div className="absolute" style={{ left: 16, top: 66, width: 608 }}>
          {[
            ["Priya Shah", "DP · Crew", "$3,600", "Paid"],
            ["Northline Grip", "Camera & grip", "$2,400", "Approved"],
            ["Fresh Kitchen", "Catering", "$1,900", "Received"],
          ].map(([v, line, amt, s], i) => (
            <div key={v} className="flex h-[42px] items-center gap-3 border-b border-border px-2">
              <Avatar name={v} hue={["blue", "purple", "orange"][i]} size={24} />
              <span className="w-[140px] text-[12.5px] font-bold">{v}</span>
              <span className="flex-1 text-[11.5px] text-text-muted">{line}</span>
              <span className="w-[70px] text-right text-[12.5px] font-bold tabular-nums">{amt}</span>
              <span className="w-[86px] text-right">
                <Chip tone={s === "Paid" ? "green" : s === "Approved" ? "blue" : "muted"} t={t}>{s}</Chip>
              </span>
            </div>
          ))}
          {saved ? (
            <div className="flex h-[42px] items-center gap-3 border-b border-border px-2" style={{ ...arrive(t, SAVE_AT + 200, -8), background: t < SAVE_AT + 1200 ? "color-mix(in oklch, var(--accent) 7%, transparent)" : undefined }}>
              <Avatar name="Leo Park" hue="amber" size={24} />
              <span className="w-[140px] text-[12.5px] font-bold">Leo Park</span>
              <span className="flex flex-1 items-center gap-2 text-[11.5px] text-text-muted">
                Gaffer · Camera & grip
                <Chip tone="amber" t={t}>over rate</Chip>
              </span>
              <span className="w-[70px] text-right text-[12.5px] font-bold tabular-nums">$2,900</span>
              <span className="w-[86px] text-right">
                <Chip tone={status?.tone ?? "muted"} t={t} since={status?.at}>{status?.s ?? "Received"}</Chip>
              </span>
            </div>
          ) : null}
        </div>

        {/* The add-cost modal */}
        {!saved ? (
          <div className="absolute rounded-[16px] border border-border bg-surface p-4 shadow-[0_28px_70px_-24px_rgba(40,30,90,.6)]" style={{ left: 70, top: 76, width: 500, ...arrive(t, 200, 12) }}>
            <p className="font-display text-[15px] font-extrabold">Log a cost</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field
                label="Vendor (from this job's roster)"
                lit={t >= PICK_OPEN && t < PICK_AT + 300}
                value={
                  t >= PICK_AT ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar name="Leo Park" hue="amber" size={18} /> Leo Park
                    </span>
                  ) : (
                    <span className="text-text-faint">Pick a person or company</span>
                  )
                }
              />
              <Field label="Budget line" value={t >= PICK_AT + 400 ? "Camera & grip" : <span className="text-text-faint">Choose a line</span>} lit={t >= PICK_AT + 400 && t < PICK_AT + 1000} />
              <Field label="Days" value={typed("3", t, DAYS_AT, 60)} lit={t >= DAYS_AT - 200 && t < DAYS_AT + 600} />
              <Field label="Amount invoiced" value={t >= AMOUNT_AT ? `$${typed("2,900", t, AMOUNT_AT, 90)}` : ""} lit={t >= AMOUNT_AT - 200 && t < AMOUNT_AT + 700} />
            </div>
            {t >= PICK_AT ? (
              <p className="mt-2 text-[11px] font-semibold text-text-muted" style={arrive(t, PICK_AT + 150, 4)}>
                Agreed rate on the roster: <b className="text-text">$900/day</b>
              </p>
            ) : null}
            {t >= CHECK_AT ? (
              <div className="mt-2 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)", ...arrive(t, CHECK_AT, 6) }}>
                Over rate: 3 days × $900 = $2,700, invoiced $2,900 (+$200)
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              {t >= FILE_AT ? (
                <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold" style={arrive(t, FILE_AT, 4)}>
                  <span className="text-[8.5px] font-black" style={{ color: "var(--h-red)" }}>PDF</span> LeoPark_INV-0412.pdf
                </span>
              ) : (
                <span className="rounded-[8px] border border-dashed border-border px-2 py-1 text-[11px] text-text-faint">Attach the invoice</span>
              )}
              <span className="ml-auto rounded-[9px] px-4 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "var(--accent)", transform: `scale(${t >= SAVE_AT - 80 && t < SAVE_AT + 60 ? 0.93 : 1})` }}>
                Save cost
              </span>
            </div>
            {/* The roster picker */}
            {t >= PICK_OPEN && t < PICK_AT + 150 ? (
              <div className="absolute rounded-[12px] border border-border bg-surface p-1.5 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 16, top: 86, width: 232, ...arrive(t, PICK_OPEN, 6) }}>
                {[
                  ["Priya Shah", "DP", "$1,200/day", "blue"],
                  ["Leo Park", "Gaffer", "$900/day", "amber"],
                  ["Northline Grip", "Vendor", "", "purple"],
                ].map(([n, r, rate, h]) => (
                  <div key={n} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11.5px]" style={{ background: n === "Leo Park" && t >= PICK_AT - 400 ? "var(--accent-soft)" : undefined }}>
                    <Avatar name={n} hue={h} size={20} />
                    <span className="font-bold">{n}</span>
                    <span className="text-text-faint">{r}</span>
                    <span className="ml-auto font-semibold text-text-muted">{rate}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <Burst t={t} at={STATUS[1].at} x={580} y={214} />
      </Window>
      <ActionLabel t={t} at={PICK_OPEN} x={200} y={130} text="Vendor from the job's roster" />
      <ActionLabel t={t} at={CHECK_AT} x={350} y={260} text="It checks the agreed rate" tone="amber" after={1000} />
      <ActionLabel t={t} at={FILE_AT} x={260} y={330} text="The invoice rides on the cost" tone="muted" />
      <ActionLabel t={t} at={STATUS[0].at} x={560} y={200} text="Click to advance: approved, then paid" tone="green" after={1800} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 500, x: 320, y: 360 },
          { t: PICK_OPEN, x: 200, y: 142, click: true },
          { t: PICK_AT, x: 150, y: 214, click: true },
          { t: DAYS_AT, x: 160, y: 196, click: true },
          { t: AMOUNT_AT, x: 400, y: 196, click: true },
          { t: FILE_AT, x: 180, y: 318, click: true },
          { t: SAVE_AT, x: 510, y: 318, click: true },
          { t: STATUS[0].at, x: 574, y: 213, click: true },
          { t: STATUS[1].at, x: 574, y: 213, click: true },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------- READ INVOICE */

export const BG_READ_MS = 13500;

const DROP_AT = 1600;
const READ_END = 3200;
const FIELDS = [
  { label: "Vendor", v: "Northline Grip", note: "matched to the roster", at: 3400 },
  { label: "Invoice number", v: "INV-2231", at: 3800 },
  { label: "Invoice date", v: "Oct 2", at: 4200 },
  { label: "Due", v: "Oct 20", at: 4600 },
  { label: "Amount", v: "$2,400", at: 5000 },
  { label: "Budget line", v: "Camera & grip", at: 5400 },
];
const BANNER_AT = 6000;
const SAVE2_AT = 7600;
const MAIL_AT = 8600;
const MAIL_CLICK = 10000;

export function BudgetReadScene({ t }: { t: number }) {
  const fileP = easeOut(ramp(t, 600, DROP_AT - 600));
  const reading = t >= DROP_AT && t < READ_END;
  const mail = t >= MAIL_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={TITLE} sub="Attach an invoice and the form fills itself" right={<Chip tone="purple" t={t}>AI reads, you confirm</Chip>}>
        <div className="absolute rounded-[16px] border border-border bg-surface p-4" style={{ left: 16, top: 66, width: 608, height: 358, opacity: mail ? 0.35 : 1, transition: "opacity .4s" }}>
          <div className="flex items-center justify-between">
            <p className="font-display text-[15px] font-extrabold">Log a cost</p>
            {t >= SAVE2_AT ? <Chip tone="green" t={t} since={SAVE2_AT}>Saved to the ledger</Chip> : null}
          </div>
          {/* Drop zone / file */}
          <div
            className="mt-3 flex h-[52px] items-center justify-center gap-2 rounded-[10px] border border-dashed text-[12px] font-semibold"
            style={{ borderColor: t >= DROP_AT ? "var(--accent)" : "var(--border-strong)", background: reading ? "color-mix(in oklch, var(--accent) 6%, var(--surface))" : undefined }}
          >
            {t >= DROP_AT ? (
              <>
                <span className="text-[9px] font-black" style={{ color: "var(--h-red)" }}>PDF</span>
                Northline_INV-2231.pdf
                {reading ? (
                  <span className="ml-2 font-bold" style={{ color: "var(--accent)" }}>
                    Reading the invoice{".".repeat(1 + (Math.floor(t / 300) % 3))}
                  </span>
                ) : (
                  <span className="ml-2 font-bold" style={{ color: "var(--h-green)" }}>Read ✓</span>
                )}
              </>
            ) : (
              <span className="text-text-faint">Drop the invoice here, PDF or photo</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
            {FIELDS.map((f) => (
              <Field
                key={f.label}
                label={f.label}
                lit={t >= f.at && t < f.at + 700}
                value={t >= f.at ? <span style={arrive(t, f.at, 3)}>{f.v}</span> : <span className="text-text-faint">…</span>}
              />
            ))}
          </div>
          {t >= FIELDS[0].at + 200 ? (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--h-green)", ...arrive(t, FIELDS[0].at + 200, 4) }}>
              ✓ Vendor matched to Northline Grip on this job's roster
            </p>
          ) : null}
          {t >= BANNER_AT ? (
            <div className="mt-2.5 flex items-center gap-3 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)", ...arrive(t, BANNER_AT, 6) }}>
              <span className="flex-1">Filled 6 fields from the invoice. Check the amount against the document before saving.</span>
              <span className="rounded-[7px] bg-surface px-2 py-0.5 text-[11px] font-bold text-text">Undo</span>
            </div>
          ) : null}
          <span className="absolute bottom-4 right-4 rounded-[9px] px-4 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "var(--accent)", transform: `scale(${t >= SAVE2_AT - 80 && t < SAVE2_AT + 60 ? 0.93 : 1})` }}>
            Save cost
          </span>
        </div>

        {/* The file being dragged in */}
        {t >= 400 && t < DROP_AT + 150 ? (
          <div className="absolute flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 shadow-[0_18px_40px_-14px_rgba(40,30,90,.55)]" style={{ left: 660 - fileP * 420, top: 120 + fileP * 16, transform: "rotate(-3deg)" }}>
            <span className="grid h-8 w-7 place-items-center rounded-[4px] text-[8px] font-black text-white" style={{ background: "var(--h-red)" }}>PDF</span>
            <span className="text-[11.5px] font-bold">Northline_INV-2231.pdf</span>
          </div>
        ) : null}

        {/* Or straight from the email it arrived in */}
        {mail ? (
          <div className="absolute rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 90, top: 150, width: 460, ...arrive(t, MAIL_AT, 14) }}>
            <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">
              <GmailGlyph size={12} /> Or from the email it came in
            </p>
            <div className="mt-2 flex items-start gap-2.5">
              <Avatar name="Fresh Kitchen" hue="orange" size={28} />
              <div className="flex-1">
                <p className="text-[12.5px] font-bold">Fresh Kitchen Catering</p>
                <p className="text-[11.5px] text-text-muted">Invoice for Thursday's lunch attached. Thanks!</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold">
                    <span className="text-[8.5px] font-black" style={{ color: "var(--h-red)" }}>PDF</span> FK-1187.pdf
                  </span>
                  <span className="rounded-[8px] px-2 py-1 text-[11px] font-bold" style={{ color: "var(--accent)", background: "var(--accent-soft)", transform: `scale(${t >= MAIL_CLICK - 60 && t < MAIL_CLICK + 100 ? 0.93 : 1})` }}>
                    Log as a cost
                  </span>
                  {t >= MAIL_CLICK + 900 ? <Chip tone="green" t={t} since={MAIL_CLICK + 900}>Draft ready to check</Chip> : t >= MAIL_CLICK ? <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>Reading…</span> : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={DROP_AT} x={300} y={120} text="Drop in the PDF" after={900} />
      <ActionLabel t={t} at={4400} x={330} y={200} text="It fills the form for you" tone="purple" after={1100} />
      <ActionLabel t={t} at={BANNER_AT} x={300} y={330} text="You check it, then save" tone="amber" after={1100} />
      <ActionLabel t={t} at={MAIL_CLICK} x={330} y={236} text="Works on emailed invoices too" tone="blue" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 600, y: 140 },
          { t: DROP_AT, x: 300, y: 150, click: true },
          { t: SAVE2_AT, x: 580, y: 402, click: true },
          { t: MAIL_CLICK, x: 380, y: 234, click: true },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------- DEPOSIT SPLIT */

export const BG_SCHED_MS = 13000;

const SPLIT_AT = 1000;
const PCT_AT = 2000;
const SENT_AT = 3300;
const MAKE_AT = 4500;
const DASH_AT = 7000;

export function BudgetScheduleScene({ t }: { t: number }) {
  const made = t >= MAKE_AT;
  const owed = made ? roll(8000, 6000, t, MAKE_AT + 300, 700) : 8000;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={TITLE} sub="A cost is a commitment, payments are what happened" right={<Chip tone="amber" t={t}>Still owed {usd(owed + 5100)}</Chip>}>
        <div className="absolute rounded-[14px] border border-border bg-surface p-3" style={{ left: 16, top: 66, width: 608 }}>
          <div className="flex items-center gap-3">
            <Avatar name="Aurora CGI" hue="purple" size={30} />
            <div className="flex-1">
              <p className="text-[13px] font-bold">Aurora CGI · Hero pack shot render</p>
              <p className="text-[11px] text-text-faint">Post · committed on the vendor's estimate</p>
            </div>
            <span className="font-display text-[18px] font-extrabold tabular-nums">$8,000</span>
            {made ? <Chip tone="blue" t={t} since={MAKE_AT + 300}>Part paid</Chip> : <Chip tone="muted" t={t}>Received</Chip>}
            <span className="rounded-[8px] border border-border px-2 py-1 text-[11px] font-bold" style={{ background: t >= SPLIT_AT && !made ? "var(--accent-soft)" : undefined, color: t >= SPLIT_AT && !made ? "var(--accent)" : undefined }}>
              {made ? "1/2" : "Split"}
            </span>
          </div>
          {/* The deposit + balance builder */}
          {t >= SPLIT_AT && !made ? (
            <div className="mt-3 flex items-end gap-3 rounded-[10px] bg-surface-2 p-3" style={arrive(t, SPLIT_AT, 6)}>
              <Field label="Deposit" w={80} value={t >= PCT_AT ? `${typed("25", t, PCT_AT, 120)}%` : ""} lit={t >= PCT_AT - 200 && t < PCT_AT + 700} />
              <Field label="Deposit due" w={96} value="Oct 1" />
              <Field label="Balance due" w={96} value="Oct 30" />
              <label className="flex items-center gap-1.5 pb-2 text-[11.5px] font-semibold">
                <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: t >= SENT_AT ? "var(--h-green)" : "transparent", borderColor: t >= SENT_AT ? "var(--h-green)" : "var(--border-strong)" }}>
                  {t >= SENT_AT ? "✓" : ""}
                </span>
                Deposit already sent
              </label>
              <span className="ml-auto mb-0.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-extrabold text-white" style={{ background: "var(--accent)" }}>
                Create schedule
              </span>
            </div>
          ) : null}
          {made ? (
            <div className="mt-3 space-y-1.5">
              {[
                { l: "Deposit · 25%", a: "$2,000", d: "Paid Oct 1", tone: "green" as const, at: MAKE_AT + 150 },
                { l: "Balance", a: "$6,000", d: "Due Oct 30", tone: "amber" as const, at: MAKE_AT + 450 },
              ].map((r) => (
                <div key={r.l} className="flex items-center gap-3 rounded-[9px] bg-surface-2 px-3 py-2" style={arrive(t, r.at, 6)}>
                  <span className="flex-1 text-[12px] font-bold">{r.l}</span>
                  <span className="text-[12.5px] font-bold tabular-nums">{r.a}</span>
                  <Chip tone={r.tone} t={t} since={r.at}>{r.d}</Chip>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-text-faint">The balance is the remainder, so the two always add back to $8,000.</p>
            </div>
          ) : null}
        </div>

        {/* The dashboard widget: every unpaid cost across live jobs */}
        {t >= DASH_AT ? (
          <div className="absolute rounded-[14px] border border-border bg-surface p-3 shadow-[0_20px_50px_-20px_rgba(40,30,90,.5)]" style={{ left: 16, top: 262, width: 608, ...arrive(t, DASH_AT, 14) }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-faint">On your dashboard · Unpaid invoices</p>
              <p className="text-[12px] font-bold">
                {usd(owed + 5100)} owed · <span style={{ color: "var(--h-red)" }}>1 overdue</span>
              </p>
            </div>
            <div className="mt-2 space-y-1">
              {[
                ["Northline Grip", "Bright Water", "$2,400", "Overdue Oct 20", "red"],
                ["Leo Park", "Bright Water", "$2,700", "Due Oct 25", "amber"],
                ["Aurora CGI", "Bright Water · balance", "$6,000", "Due Oct 30", "amber"],
              ].map(([v, j, a, d, tone], i) => (
                <div key={v} className="flex items-center gap-3 px-1 py-1" style={arrive(t, DASH_AT + 250 + i * 200, 4)}>
                  <span className="w-[120px] text-[12px] font-bold">{v}</span>
                  <span className="flex-1 text-[11px] text-text-faint">{j}</span>
                  <span className="text-[12px] font-bold tabular-nums">{a}</span>
                  <Chip tone={tone as "red" | "amber"} t={t} className="w-[112px] justify-center">{d}</Chip>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={SPLIT_AT} x={560} y={78} text="Split it into deposit and balance" />
      <ActionLabel t={t} at={SENT_AT} x={430} y={148} text="Mark the deposit as sent" tone="green" />
      <ActionLabel t={t} at={MAKE_AT + 400} x={440} y={130} text="Only the remainder stays owed" tone="amber" after={1300} />
      <ActionLabel t={t} at={DASH_AT + 400} x={380} y={300} text="Every job's unpaid bills, in one list" tone="red" after={2000} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 380 },
          { t: SPLIT_AT, x: 588, y: 90, click: true },
          { t: PCT_AT, x: 70, y: 168, click: true },
          { t: SENT_AT, x: 404, y: 162, click: true },
          { t: MAKE_AT, x: 556, y: 164, click: true },
          { t: DASH_AT + 400, x: 360, y: 330 },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- MARGIN */

export const BG_MARGIN_MS = 12500;

const INV = [
  { n: "INV-101 · Deposit", a: 21000, s: "Paid", at: 700 },
  { n: "INV-102 · Balance", a: 21000, s: "Sent", at: 1400 },
];
const COST_AT = 2400;
const BAND_AT = 3800;
const CREW_AT = 7200;
const BACK_AT = 10200;

export function BudgetMarginScene({ t }: { t: number }) {
  const billed = INV.filter((i) => t >= i.at).reduce((s, i) => s + i.a, 0);
  const cost = roll(0, 29000, t, COST_AT, 900);
  const margin = billed ? ((billed - cost) / billed) * 100 : 0;
  const crew = t >= CREW_AT && t < BACK_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title={crew ? "Bright Water · as crew see it" : TITLE}
        sub={crew ? "Signed in as Leo Park, Gaffer (collaborator)" : "Billed against cost, from real documents on both sides"}
        right={crew ? <Chip tone="muted" t={t} since={CREW_AT}>Crew view</Chip> : t >= BAND_AT + 900 ? <Chip tone="green" t={t} since={BAND_AT + 900}>31% margin</Chip> : <Chip tone="blue" t={t}>Margin</Chip>}
      >
        {!crew ? (
          <>
            <div className="absolute grid grid-cols-2 gap-3" style={{ left: 16, top: 66, width: 608 }}>
              <div className="rounded-[14px] border border-border p-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Billed · from your invoices</p>
                <p className="font-display text-[26px] font-extrabold tabular-nums">{usd(billed)}</p>
                {INV.map((i) =>
                  t >= i.at ? (
                    <div key={i.n} className="mt-1.5 flex items-center justify-between text-[11.5px]" style={arrive(t, i.at, 4)}>
                      <span className="font-semibold">{i.n}</span>
                      <span className="flex items-center gap-2 font-bold tabular-nums">
                        {usd(i.a)} <Chip tone={i.s === "Paid" ? "green" : "blue"} t={t} since={i.at}>{i.s}</Chip>
                      </span>
                    </div>
                  ) : null,
                )}
                <p className="mt-2 text-[10.5px] text-text-faint">Estimates and proposals do not count. Only what you invoiced.</p>
              </div>
              <div className="rounded-[14px] border border-border p-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Job cost · from the ledger</p>
                <p className="font-display text-[26px] font-extrabold tabular-nums">{usd(cost)}</p>
                {t >= COST_AT
                  ? [
                      ["Crew", 11400],
                      ["Camera & grip", 8500],
                      ["Art & catering", 7100],
                      ["Post", 2000],
                    ].map(([k, v], i) => (
                      <div key={k as string} className="mt-1 flex items-center justify-between text-[11.5px]" style={arrive(t, COST_AT + i * 150, 4)}>
                        <span className="font-semibold">{k}</span>
                        <span className="font-bold tabular-nums">{usd(v as number)}</span>
                      </div>
                    ))
                  : null}
              </div>
            </div>
            {t >= BAND_AT ? (
              <div className="absolute rounded-[14px] px-4 py-3" style={{ left: 16, top: 300, width: 608, background: "linear-gradient(120deg, var(--h-green-bg), var(--surface-2))", ...arrive(t, BAND_AT, 12) }}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-bold">What the job made</p>
                  <p className="font-display text-[22px] font-extrabold tabular-nums" style={{ color: "var(--h-green)" }}>
                    {usd(billed - cost)} · {margin.toFixed(0)}%
                  </p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full" style={{ width: `${(cost / billed) * 100 * easeOut(ramp(t, BAND_AT + 150, 800))}%`, background: "var(--h-amber)" }} />
                </div>
                <p className="mt-1.5 text-[10.5px] text-text-faint">Cost as a share of what you billed. The bar turns red if the job loses money.</p>
              </div>
            ) : null}
            <Burst t={t} at={BAND_AT + 900} x={560} y={26} />
          </>
        ) : (
          <div className="absolute" style={{ left: 16, top: 66, width: 608, ...arrive(t, CREW_AT, 10) }}>
            <div className="grid grid-cols-3 gap-3">
              {["Call sheet", "Shot list", "Storyboards"].map((k, i) => (
                <div key={k} className="rounded-[12px] border border-border p-3" style={{ borderTop: `3px solid var(--h-${["amber", "blue", "purple"][i]})` }}>
                  <p className="text-[12.5px] font-bold">{k}</p>
                  <p className="text-[11px] text-text-faint">Open</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid place-items-center rounded-[14px] border border-dashed border-border py-10 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)", transform: `scale(${spring(ramp(t, CREW_AT + 300, 420))})` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <p className="mt-2 text-[13.5px] font-extrabold">No budget, no costs, no day rates</p>
              <p className="mt-1 max-w-[360px] text-[11.5px] text-text-muted">Crew invited to a project see the work, never what anyone else charged. The database enforces it, not just the screen.</p>
            </div>
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={INV[0].at + 200} x={60} y={130} text="Billed comes from your invoices" tone="indigo" after={1000} />
      <ActionLabel t={t} at={COST_AT + 300} x={380} y={130} text="Cost comes from the ledger" tone="amber" after={900} />
      <ActionLabel t={t} at={BAND_AT + 500} x={420} y={330} text="The margin, worked out for you" tone="green" after={1600} />
      <ActionLabel t={t} at={CREW_AT + 400} x={200} y={200} text="And your crew never see it" tone="muted" before={150} after={2000} />
    </div>
  );
}
