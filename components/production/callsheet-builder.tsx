"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveCallSheet,
  saveCallSheetLayout,
  saveCallSheetAccent,
  saveCallSheetTemplate,
  deleteCallSheetTemplate,
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
import type {
  CallSheet as CS,
  CallSheetEntry,
  CallSheetTemplate,
} from "@/lib/database.types";

const ACCENTS = ["indigo", "blue", "cyan", "green", "amber", "orange", "red", "purple", "pink"];

// Inline, edit-in-place field: reads as document text, reveals a border on
// hover/focus.
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
  templates = [],
  logoUrl,
}: {
  projectId: string;
  callSheetId: string;
  projectTitle: string;
  callSheet: CS | null;
  entries: CallSheetEntry[];
  templates?: CallSheetTemplate[];
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

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

  // Reusable inline field bound to `f`.
  const F = (k: string, ph: string, cls = "") => (
    <input
      value={(f as Record<string, string>)[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
      onBlur={() => save(k, (f as Record<string, string>)[k] ?? "")}
      placeholder={ph}
      className={`${line} ${cls}`}
    />
  );

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

  const [layout, setLayout] = useState<CallSheetBlock[]>(() =>
    normalizeLayout(callSheet?.layout)
  );
  const commit = (next: CallSheetBlock[]) => {
    setLayout(next);
    void saveCallSheetLayout(projectId, callSheetId, next);
  };
  // Only body blocks are reorderable; ignore any legacy masthead block types.
  const BODY_TYPES = new Set([...FIXED_BLOCKS.map((b) => b.type), "text"]);
  const body = layout.filter((b) => BODY_TYPES.has(b.type));
  const visible = body.filter((b) => !b.hidden);

  function move(id: string, dir: -1 | 1) {
    const ids = body.map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    // reorder within the full layout, preserving non-body entries
    const reordered = [...body];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const others = layout.filter((b) => !BODY_TYPES.has(b.type));
    commit([...others, ...reordered]);
  }
  // Drag-and-drop: drop the dragged block at the target block's position.
  function moveBlockTo(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const arr = [...body];
    const from = arr.findIndex((b) => b.id === dragId);
    const to = arr.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    const others = layout.filter((b) => !BODY_TYPES.has(b.type));
    commit([...others, ...arr]);
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

  const [accent, setAccent] = useState<string | null>(callSheet?.accent ?? null);
  const accentVar = accent ? `var(--h-${accent})` : "var(--accent)";
  const accentBg = accent ? `var(--h-${accent}-bg)` : "var(--accent-soft)";
  function chooseAccent(a: string | null) {
    setAccent(a);
    void saveCallSheetAccent(projectId, callSheetId, a);
  }

  const addable = FIXED_BLOCKS.filter((fb) => {
    const b = layout.find((x) => x.type === fb.type);
    return !b || b.hidden;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  // Templates (studio-scoped layout + accent presets).
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  function applyTemplate(t: CallSheetTemplate) {
    const next = normalizeLayout(t.layout);
    setLayout(next);
    void saveCallSheetLayout(projectId, callSheetId, next);
    chooseAccent(t.accent ?? null);
    setTplOpen(false);
  }
  function saveTemplate() {
    const name = tplName.trim();
    if (!name) return;
    start(async () => {
      await saveCallSheetTemplate(projectId, name, layout, accent);
      setTplName("");
      setTplOpen(false);
      router.refresh();
    });
  }
  function removeTemplate(id: string) {
    start(async () => {
      await deleteCallSheetTemplate(projectId, id);
      router.refresh();
    });
  }

  const bodyCtx: BlockCtx = {
    F, rows, editRow, addRow, delRow, projectId, accentVar, updateText, notes: f.notes,
    setNotes: (v: string) => set("notes", v), saveNotes: () => save("notes", f.notes),
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

        {/* Templates */}
        <div className="relative">
          <button
            onClick={() => setTplOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            Templates
          </button>
          {tplOpen && (
            <div className="absolute z-30 mt-1 w-64 rounded-[12px] border border-border bg-surface p-2 shadow-lg">
              <div className="mb-1.5 flex gap-1.5">
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Save current as…"
                  className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
                <button
                  onClick={saveTemplate}
                  disabled={busy || !tplName.trim()}
                  className="rounded-[8px] bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-strong disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              {templates.length === 0 ? (
                <p className="px-2 py-2 text-xs text-text-faint">
                  No templates yet. Arrange the blocks + accent, then save this as a
                  reusable template.
                </p>
              ) : (
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 rounded-[9px] px-1 transition hover:bg-surface-2"
                    >
                      <button
                        onClick={() => applyTemplate(t)}
                        className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm font-medium text-text"
                        title={`Apply "${t.name}"`}
                      >
                        {t.name}
                      </button>
                      <button
                        onClick={() => removeTemplate(t.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-text-faint transition hover:bg-red-bg hover:text-red"
                        aria-label="Delete template"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Link
          href={`/projects/${projectId}/production/callsheet?cs=${callSheetId}&auto=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          Download PDF
        </Link>
      </div>

      {/* The sheet (paper) */}
      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundColor: accentVar }} />
        <div className="p-5 sm:p-7">
          {/* ---- Masthead: the real call sheet header ---- */}
          <div className="grid grid-cols-1 gap-5 border-b-2 pb-5 md:grid-cols-[1.1fr_1fr_1fr]" style={{ borderColor: accentVar }}>
            {/* Left: logo + company + contacts */}
            <div>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="mb-2 max-h-14 w-auto max-w-[180px] object-contain" />
              ) : (
                <Link
                  href="/settings"
                  className="mb-2 inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-border px-3 py-2 text-xs font-semibold text-text-faint transition hover:border-border-strong hover:text-text"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  Add logo
                </Link>
              )}
              {F("company_name", "Production company", "font-display text-base font-extrabold")}
              {F("company_phone", "Phone", "text-xs text-text-muted")}
              {F("company_address", "Address", "text-xs text-text-muted")}
              <div className="mt-2 space-y-1">
                {([
                  ["producer", "producer_phone", "Producer"],
                  ["director", "director_phone", "Director"],
                  ["pm", "pm_phone", "Prod. mgr"],
                ] as const).map(([n, p, l]) => (
                  <div key={n} className="flex items-center gap-1.5">
                    <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-faint">{l}</span>
                    {F(n, "Name", "flex-1 text-xs")}
                    {F(p, "Phone", "w-28 text-xs text-text-muted")}
                  </div>
                ))}
              </div>
            </div>

            {/* Center: title + call badge */}
            <div className="flex flex-col items-center justify-start text-center">
              <input
                value={f.production_title}
                onChange={(e) => set("production_title", e.target.value)}
                onBlur={() => save("production_title", f.production_title)}
                placeholder={projectTitle}
                className={`${line} text-center font-display text-xl font-extrabold`}
              />
              <div
                className="mt-2 w-full max-w-[220px] rounded-[16px] border-2 px-3 py-3"
                style={{ borderColor: accentVar, backgroundColor: accentBg }}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentVar }}>
                  General call
                </div>
                <input
                  value={f.crew_call}
                  onChange={(e) => set("crew_call", e.target.value)}
                  onBlur={() => save("crew_call", f.crew_call)}
                  placeholder="7:00 AM"
                  className="w-full bg-transparent text-center font-display text-3xl font-extrabold text-text outline-none"
                />
                <div className="mt-1 flex items-center justify-center gap-2">
                  <input
                    type="date"
                    value={f.shoot_date}
                    onChange={(e) => set("shoot_date", e.target.value)}
                    onBlur={() => save("shoot_date", f.shoot_date)}
                    className="rounded-[6px] bg-transparent px-1 py-0.5 text-center text-xs font-semibold text-text outline-none focus:bg-surface"
                  />
                </div>
              </div>
              <input
                value={f.day_of}
                onChange={(e) => set("day_of", e.target.value)}
                onBlur={() => save("day_of", f.day_of)}
                placeholder="Day 1 of 3"
                className={`${line} mt-1 max-w-[160px] text-center text-xs font-semibold`}
              />
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Shooting call</span>
                {F("shoot_call", "—", "w-24 text-xs")}
              </div>
            </div>

            {/* Right: info table */}
            <div className="overflow-hidden rounded-[10px] border border-border">
              {([
                ["breakfast", "Breakfast"],
                ["lunch", "Lunch"],
                ["wrap", "Est. wrap"],
                ["sunrise", "Sunrise"],
                ["sunset", "Sunset"],
                ["weather", "Weather"],
              ] as const).map(([k, l], i) => (
                <div key={k} className={`flex items-center gap-2 px-2.5 py-1 ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-faint">{l}</span>
                  {F(k, "—", "flex-1 text-sm")}
                </div>
              ))}
            </div>
          </div>

          {/* ---- Body blocks ---- */}
          <div className="mt-2 space-y-1">
            {visible.map((b, i) => (
              <BlockShell
                key={b.id}
                first={i === 0}
                last={i === visible.length - 1}
                onUp={() => move(b.id, -1)}
                onDown={() => move(b.id, 1)}
                onHide={() => hideOrRemove(b)}
                isText={b.type === "text"}
                dragging={dragId === b.id}
                onDragStart={() => setDragId(b.id)}
                onDragEnd={() => setDragId(null)}
                onDropBlock={() => {
                  if (dragId) moveBlockTo(dragId, b.id);
                  setDragId(null);
                }}
              >
                <BodyBlock block={b} ctx={bodyCtx} />
              </BlockShell>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type BlockCtx = {
  F: (k: string, ph: string, cls?: string) => React.ReactNode;
  rows: CallSheetEntry[];
  editRow: (id: string, patch: Partial<CallSheetEntry>) => void;
  addRow: (kind: "cast" | "crew") => void;
  delRow: (id: string) => void;
  projectId: string;
  accentVar: string;
  updateText: (id: string, patch: Partial<CallSheetBlock>) => void;
  notes: string;
  setNotes: (v: string) => void;
  saveNotes: () => void;
};

function BlockShell({
  children, first, last, onUp, onDown, onHide, isText,
  dragging, onDragStart, onDragEnd, onDropBlock,
}: {
  children: React.ReactNode;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onHide: () => void;
  isText: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropBlock?: () => void;
}) {
  const ctrl =
    "grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text disabled:opacity-25";
  return (
    <div
      onDragOver={(e) => {
        if (onDropBlock) e.preventDefault();
      }}
      onDrop={() => onDropBlock?.()}
      className={`group relative rounded-[10px] px-2 py-3 transition hover:bg-surface-2/30 ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="absolute -left-1 top-2 z-10 flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100 print:hidden">
        <button
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={`${ctrl} cursor-grab active:cursor-grabbing`}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
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

function BodyBlock({ block, ctx }: { block: CallSheetBlock; ctx: BlockCtx }) {
  const { F, accentVar } = ctx;
  switch (block.type) {
    case "locations":
      return (
        <div>
          <SectionLabel accent={accentVar}>Locations &amp; safety</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div><div className={labelCls}>Set location</div>{F("location", "Address or studio")}</div>
            <div><div className={labelCls}>Parking</div>{F("parking", "Where crew parks")}</div>
            <div><div className={labelCls}>Nearest hospital</div>{F("hospital", "Name & address")}</div>
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
            value={ctx.notes}
            onChange={(e) => ctx.setNotes(e.target.value)}
            onBlur={ctx.saveNotes}
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
  ctx, kind, title, roleLabel,
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
          <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] gap-2 border-b border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: accentVar }}>
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
