"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveCallSheet,
  saveCallSheetLayout,
  saveCallSheetAccent,
  addCallSheetEntry,
  updateCallSheetEntry,
  deleteCallSheetEntry,
  type CallSheetPatch,
} from "@/app/(app)/projects/[id]/callsheet-actions";
import {
  normalizeLayout,
  FIXED_BLOCKS,
  type CallSheetBlock,
} from "@/lib/callsheet-blocks";
import type { CallSheet as CS, CallSheetEntry } from "@/lib/database.types";

const ACCENTS = ["indigo", "blue", "cyan", "green", "amber", "orange", "red", "purple", "pink"];

const line =
  "w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";
const labelCls = "text-[10px] font-bold uppercase tracking-wide text-text-faint";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

export function CallSheetBuilder({
  projectId,
  callSheetId,
  projectTitle,
  callSheet,
  entries,
}: {
  projectId: string;
  callSheetId: string;
  projectTitle: string;
  callSheet: CS | null;
  entries: CallSheetEntry[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  // Header / structured fields (local, saved on blur).
  const [f, setF] = useState({
    production_title: callSheet?.production_title ?? "",
    day_of: callSheet?.day_of ?? "",
    shoot_date: callSheet?.shoot_date ?? "",
    crew_call: callSheet?.crew_call ?? "",
    shoot_call: callSheet?.shoot_call ?? "",
    breakfast: callSheet?.breakfast ?? "",
    lunch: callSheet?.lunch ?? "",
    wrap: callSheet?.wrap ?? "",
    location: callSheet?.location ?? "",
    parking: callSheet?.parking ?? "",
    weather: callSheet?.weather ?? "",
    sunrise: callSheet?.sunrise ?? "",
    sunset: callSheet?.sunset ?? "",
    hospital: callSheet?.hospital ?? "",
    notes: callSheet?.notes ?? "",
    company_name: callSheet?.company_name ?? "",
    company_address: callSheet?.company_address ?? "",
    company_website: callSheet?.company_website ?? "",
    company_phone: callSheet?.company_phone ?? "",
    producer: callSheet?.producer ?? "",
    producer_phone: callSheet?.producer_phone ?? "",
    director: callSheet?.director ?? "",
    director_phone: callSheet?.director_phone ?? "",
    pm: callSheet?.pm ?? "",
    pm_phone: callSheet?.pm_phone ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = (k: string, v: string) =>
    void saveCallSheet(projectId, callSheetId, { [k]: v || null } as CallSheetPatch);

  // Cast / crew rows.
  const [rows, setRows] = useState<CallSheetEntry[]>(entries);
  const sig = entries.map((e) => e.id).join(",");
  useEffect(() => setRows(entries), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const editRow = (id: string, patch: Partial<CallSheetEntry>) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = (kind: "cast" | "crew") =>
    start(async () => {
      await addCallSheetEntry(projectId, callSheetId, kind);
      router.refresh();
    });
  const delRow = (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteCallSheetEntry(projectId, id);
      router.refresh();
    });
  };

  // Layout (block order / hidden / custom text).
  const [layout, setLayout] = useState<CallSheetBlock[]>(() =>
    normalizeLayout(callSheet?.layout)
  );
  const commit = (next: CallSheetBlock[]) => {
    setLayout(next);
    void saveCallSheetLayout(projectId, callSheetId, next);
  };
  const visible = layout.filter((b) => !b.hidden);

  function move(id: string, dir: -1 | 1) {
    const i = layout.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.length) return;
    const next = [...layout];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }
  function hideOrRemove(b: CallSheetBlock) {
    if (b.type === "text") commit(layout.filter((x) => x.id !== b.id));
    else commit(layout.map((x) => (x.id === b.id ? { ...x, hidden: true } : x)));
  }
  function addFixed(type: string) {
    const has = layout.find((b) => b.type === type);
    if (has) commit(layout.map((b) => (b.type === type ? { ...b, hidden: false } : b)));
    else commit([...layout, { id: type, type }]);
  }
  function addText() {
    commit([...layout, { id: uid(), type: "text", title: "", body: "" }]);
  }
  function updateText(id: string, patch: Partial<CallSheetBlock>) {
    commit(layout.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  // Accent.
  const [accent, setAccent] = useState<string | null>(callSheet?.accent ?? null);
  const accentVar = accent ? `var(--h-${accent})` : "var(--accent)";
  const accentBg = accent ? `var(--h-${accent}-bg)` : "var(--accent-soft)";
  function chooseAccent(a: string | null) {
    setAccent(a);
    void saveCallSheetAccent(projectId, callSheetId, a);
  }

  // Blocks that can be added (hidden fixed ones + custom text).
  const addable = FIXED_BLOCKS.filter((fb) => {
    const b = layout.find((x) => x.type === fb.type);
    return !b || b.hidden;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  const ctx: BlockCtx = {
    f, set, save, projectId, callSheetId, projectTitle,
    rows, editRow, addRow, delRow, busy, accentVar, accentBg,
    updateText,
  };

  return (
    <div>
      {/* Toolbar (not printed) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setPaletteOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add block
          </button>
          {paletteOpen && (
            <div className="absolute z-30 mt-1 w-56 rounded-[12px] border border-border bg-surface p-1 shadow-lg">
              {addable.map((fb) => (
                <button
                  key={fb.type}
                  onClick={() => { addFixed(fb.type); setPaletteOpen(false); }}
                  className="block w-full rounded-[9px] px-3 py-1.5 text-left text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  {fb.label}
                </button>
              ))}
              {addable.length > 0 && <div className="my-1 border-t border-border" />}
              <button
                onClick={() => { addText(); setPaletteOpen(false); }}
                className="block w-full rounded-[9px] px-3 py-1.5 text-left text-sm font-semibold text-accent transition hover:bg-accent-soft"
              >
                + Custom text block
              </button>
            </div>
          )}
        </div>

        {/* Accent */}
        <div className="flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2 py-1.5">
          <span className="text-[11px] font-semibold text-text-faint">Accent</span>
          <button
            onClick={() => chooseAccent(null)}
            className={`h-4 w-4 rounded-full border ${!accent ? "ring-2 ring-offset-1" : ""}`}
            style={{ backgroundColor: "var(--accent)", borderColor: "var(--border)" }}
            aria-label="Brand accent"
          />
          {ACCENTS.map((a) => (
            <button
              key={a}
              onClick={() => chooseAccent(a)}
              className={`h-4 w-4 rounded-full ${accent === a ? "ring-2 ring-offset-1" : ""}`}
              style={{ backgroundColor: `var(--h-${a})` }}
              aria-label={a}
            />
          ))}
        </div>

        <Link
          href={`/projects/${projectId}/production/callsheet?cs=${callSheetId}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
          Print / Export PDF
        </Link>
      </div>

      {/* The sheet (paper) */}
      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundColor: accentVar }} />
        <div className="space-y-1 p-5 sm:p-7">
          {visible.map((b, i) => (
            <BlockShell
              key={b.id}
              first={i === 0}
              last={i === visible.length - 1}
              onUp={() => move(b.id, -1)}
              onDown={() => move(b.id, 1)}
              onHide={() => hideOrRemove(b)}
              isText={b.type === "text"}
            >
              <BlockBody block={b} ctx={ctx} />
            </BlockShell>
          ))}
        </div>
      </div>
    </div>
  );
}

type BlockCtx = {
  f: Record<string, string>;
  set: (k: string, v: string) => void;
  save: (k: string, v: string) => void;
  projectId: string;
  callSheetId: string;
  projectTitle: string;
  rows: CallSheetEntry[];
  editRow: (id: string, patch: Partial<CallSheetEntry>) => void;
  addRow: (kind: "cast" | "crew") => void;
  delRow: (id: string) => void;
  busy: boolean;
  accentVar: string;
  accentBg: string;
  updateText: (id: string, patch: Partial<CallSheetBlock>) => void;
};

function BlockShell({
  children,
  first,
  last,
  onUp,
  onDown,
  onHide,
  isText,
}: {
  children: React.ReactNode;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onHide: () => void;
  isText: boolean;
}) {
  const ctrl =
    "grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text disabled:opacity-25";
  return (
    <div className="group relative rounded-[10px] px-2 py-3 transition hover:bg-surface-2/30">
      <div className="absolute -left-1 top-2 z-10 flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100 print:hidden">
        <button onClick={onUp} disabled={first} className={ctrl} aria-label="Move up">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
        </button>
        <button onClick={onDown} disabled={last} className={ctrl} aria-label="Move down">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <button onClick={onHide} className={ctrl} aria-label={isText ? "Remove block" : "Hide block"}>
          {isText ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-1 rounded-pill" style={{ backgroundColor: accent }} />
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{children}</span>
    </div>
  );
}

function BlockBody({ block, ctx }: { block: CallSheetBlock; ctx: BlockCtx }) {
  const { f, set, save, accentVar } = ctx;
  const F = (k: string, ph: string, cls = "") => (
    <input
      value={f[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
      onBlur={() => save(k, f[k] ?? "")}
      placeholder={ph}
      className={`${line} ${cls}`}
    />
  );

  switch (block.type) {
    case "header":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <input
              value={f.production_title}
              onChange={(e) => set("production_title", e.target.value)}
              onBlur={() => save("production_title", f.production_title)}
              placeholder={ctx.projectTitle}
              className={`${line} font-display text-2xl font-extrabold`}
            />
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: ctx.accentBg, color: accentVar }}>
                Call sheet
              </span>
              {F("day_of", "Day 1 of 3", "max-w-[140px] text-xs")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><div className={labelCls}>Date</div>
              <input type="date" value={f.shoot_date} onChange={(e) => set("shoot_date", e.target.value)} onBlur={() => save("shoot_date", f.shoot_date)} className={line} /></div>
            <div><div className={labelCls}>General call</div>{F("crew_call", "7:00 AM")}</div>
            <div className="col-span-2"><div className={labelCls}>Weather</div>{F("weather", "Sunny, high 72")}</div>
          </div>
        </div>
      );
    case "schedule":
      return (
        <div>
          <SectionLabel accent={accentVar}>Schedule &amp; times</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["crew_call","Crew call"],["shoot_call","Shooting call"],["breakfast","Breakfast"],["lunch","Lunch"],["wrap","Est. wrap"]].map(([k,l]) => (
              <div key={k}><div className={labelCls}>{l}</div>{F(k, "—")}</div>
            ))}
          </div>
        </div>
      );
    case "locations":
      return (
        <div>
          <SectionLabel accent={accentVar}>Locations &amp; safety</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><div className={labelCls}>Set location</div>{F("location", "Address or studio")}</div>
            <div><div className={labelCls}>Parking</div>{F("parking", "Where crew parks")}</div>
            <div><div className={labelCls}>Nearest hospital</div>{F("hospital", "Name & address")}</div>
            <div className="grid grid-cols-2 gap-2">
              <div><div className={labelCls}>Sunrise</div>{F("sunrise", "6:04 AM")}</div>
              <div><div className={labelCls}>Sunset</div>{F("sunset", "7:58 PM")}</div>
            </div>
          </div>
        </div>
      );
    case "contacts":
      return (
        <div>
          <SectionLabel accent={accentVar}>Key contacts</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[["producer","producer_phone","Producer"],["director","director_phone","Director"],["pm","pm_phone","Production mgr"]].map(([n,p,l]) => (
              <div key={n} className="rounded-[10px] border border-border p-2">
                <div className={labelCls}>{l}</div>
                {F(n, "Name")}
                {F(p, "Phone", "text-xs text-text-muted")}
              </div>
            ))}
          </div>
        </div>
      );
    case "company":
      return (
        <div>
          <SectionLabel accent={accentVar}>Production company</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><div className={labelCls}>Company</div>{F("company_name", "Studio name")}</div>
            <div><div className={labelCls}>Phone</div>{F("company_phone", "—")}</div>
            <div><div className={labelCls}>Website</div>{F("company_website", "—")}</div>
            <div><div className={labelCls}>Address</div>{F("company_address", "—")}</div>
          </div>
        </div>
      );
    case "cast":
      return <PeopleBlock ctx={ctx} kind="cast" title="Cast & talent" roleLabel="Character" />;
    case "crew":
      return <PeopleBlock ctx={ctx} kind="crew" title="Crew" roleLabel="Role" />;
    case "notes":
      return (
        <div>
          <SectionLabel accent={accentVar}>Notes</SectionLabel>
          <textarea
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            onBlur={() => save("notes", f.notes)}
            placeholder="Catering, wardrobe, safety notes, special instructions..."
            className={`${line} min-h-[64px]`}
          />
        </div>
      );
    case "text":
      return (
        <div>
          <input
            value={block.title ?? ""}
            onChange={(e) => ctx.updateText(block.id, { title: e.target.value })}
            placeholder="Section title"
            className={`${line} text-xs font-bold uppercase tracking-wide text-text-muted`}
          />
          <textarea
            value={block.body ?? ""}
            onChange={(e) => ctx.updateText(block.id, { body: e.target.value })}
            placeholder="Write anything: bulletins, COVID protocol, notes to crew..."
            className={`${line} mt-1 min-h-[56px]`}
          />
        </div>
      );
    default:
      return null;
  }
}

function PeopleBlock({
  ctx,
  kind,
  title,
  roleLabel,
}: {
  ctx: BlockCtx;
  kind: "cast" | "crew";
  title: string;
  roleLabel: string;
}) {
  const { rows, editRow, addRow, delRow, projectId, accentVar } = ctx;
  const people = rows.filter((r) => (kind === "cast" ? r.kind === "cast" : r.kind !== "cast"));
  const cell =
    "w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel accent={accentVar}>{title}</SectionLabel>
        <button
          onClick={() => addRow(kind)}
          className="rounded-[8px] border border-border px-2 py-0.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text print:hidden"
        >
          + Add
        </button>
      </div>
      {people.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border py-4 text-center text-xs text-text-faint">
          No one added yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] gap-2 border-b border-border bg-surface-2/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
            <span>Name</span><span>{roleLabel}</span><span>Call</span><span>Contact</span><span />
          </div>
          {people.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] items-center gap-2 border-b border-border px-2 py-0.5 last:border-0">
              <input value={r.name} onChange={(e) => editRow(r.id, { name: e.target.value })} onBlur={() => updateCallSheetEntry(projectId, r.id, { name: r.name })} placeholder="Name" className={cell} />
              <input value={r.role ?? ""} onChange={(e) => editRow(r.id, { role: e.target.value })} onBlur={() => updateCallSheetEntry(projectId, r.id, { role: r.role ?? "" })} placeholder={roleLabel} className={cell} />
              <input value={r.call_time ?? ""} onChange={(e) => editRow(r.id, { call_time: e.target.value })} onBlur={() => updateCallSheetEntry(projectId, r.id, { call_time: r.call_time ?? "" })} placeholder="Time" className={cell} />
              <input value={r.contact ?? ""} onChange={(e) => editRow(r.id, { contact: e.target.value })} onBlur={() => updateCallSheetEntry(projectId, r.id, { contact: r.contact ?? "" })} placeholder="Phone / email" className={cell} />
              <button onClick={() => delRow(r.id)} className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-red-bg hover:text-red print:hidden" aria-label="Remove">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
