"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  setGenerationStatus,
  setGenerationStarred,
  setGenerationRole,
} from "@/app/(app)/projects/[id]/pipeline-actions";
import type { AiGeneration } from "@/lib/database.types";

// The fan-out fast lane. A batch of candidates for ONE shot + stage, judged big
// on a stable neutral stage (asset-review surfaces stay neutral regardless of
// theme, per the product principle) with keyboard-first decisions:
//   ← →      move          x   reject / restore
//   s        star finalist  1/2 tag Start / End (image)
//   enter    pick take (video)   c  add to compare
//   esc      close (or leave compare)
// Decisions are optimistic (instant), persisted in the background, and reconciled
// when the server payload refreshes. Star is a shortlist tier between "kept" and
// the final pick, so you narrow 100 -> a few -> the one.

type Filter = "all" | "kept" | "starred" | "rejected";
type Override = { status?: string; starred?: boolean; role?: string | null };

const stageBg = "#0b0b0d";

export function TriageView({
  projectId,
  stage,
  shotId,
  items,
  media,
  onClose,
}: {
  projectId: string;
  stage: "image" | "video";
  shotId: string;
  items: AiGeneration[];
  media: Record<string, string>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [, run] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [compare, setCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [spec, setSpec] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  // Optimistic view of an item (local override merged over the server row).
  const view = useCallback(
    (g: AiGeneration): AiGeneration => ({ ...g, ...overrides[g.id] }),
    [overrides],
  );

  // Drop overrides the server payload has caught up on, so the map stays small.
  useEffect(() => {
    setOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, Override> = {};
      for (const g of items) {
        const o = prev[g.id];
        if (!o) continue;
        const settled =
          (o.status === undefined || o.status === g.status) &&
          (o.starred === undefined || o.starred === g.starred) &&
          (o.role === undefined || o.role === g.role);
        if (!settled) next[g.id] = o;
      }
      return next;
    });
  }, [items]);

  const models = useMemo(() => {
    const s = new Set<string>();
    for (const g of items) if (g.model) s.add(g.model);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .map(view)
      .filter((g) => {
        if (modelFilter && g.model !== modelFilter) return false;
        if (filter === "kept") return g.status !== "rejected";
        if (filter === "starred") return g.starred;
        if (filter === "rejected") return g.status === "rejected";
        return true;
      });
  }, [items, view, filter, modelFilter]);

  // Keep the focus index in range as the list shifts under filters/decisions.
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, filtered.length - 1))));
  }, [filtered.length]);

  const focused = filtered[index] ?? null;
  const keptCount = items.map(view).filter((g) => g.status !== "rejected").length;
  const starCount = items.map(view).filter((g) => g.starred).length;

  const srcOf = (g: AiGeneration | null) =>
    g ? media[g.id] ?? g.external_url ?? null : null;

  // ---- decisions (optimistic) ----------------------------------------------
  function patch(id: string, o: Override) {
    setOverrides((p) => ({ ...p, [id]: { ...p[id], ...o } }));
  }
  function reject(g: AiGeneration, advance = true) {
    const next = g.status === "rejected" ? "candidate" : "rejected";
    patch(g.id, { status: next });
    run(() => setGenerationStatus(projectId, g.id, next as "candidate" | "rejected"));
    // In "all" the item stays visible (dimmed), so step forward past it. In
    // "kept" it drops out of the list, so the index already lands on the next
    // one — don't also advance (that would skip one). The clamp effect handles
    // range.
    if (advance && next === "rejected" && filter === "all") {
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
  }
  function star(g: AiGeneration) {
    patch(g.id, { starred: !g.starred });
    run(() => setGenerationStarred(projectId, g.id, !g.starred));
  }
  function tagRole(g: AiGeneration, role: "start" | "end" | "take") {
    const clearing = g.role === role;
    setOverrides((prev) => {
      const next = { ...prev };
      if (!clearing) {
        // Exclusive: clear any other item currently holding this role.
        for (const it of items) {
          const cur = { ...it, ...next[it.id] };
          if (cur.id !== g.id && cur.role === role) next[it.id] = { ...next[it.id], role: null };
        }
      }
      next[g.id] = {
        ...next[g.id],
        role: clearing ? null : role,
        ...(clearing ? {} : { status: "approved" }),
      };
      return next;
    });
    run(() => setGenerationRole(projectId, shotId, g.id, clearing ? null : role));
  }
  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
    setCompare(true);
  }

  // ---- keyboard -------------------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") {
        if (compare) { setCompare(false); return; }
        onClose();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
        e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)); return;
      }
      if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") {
        e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); return;
      }
      if (!focused) return;
      if (e.key === "x" || e.key === "X") { e.preventDefault(); reject(focused); return; }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); star(focused); return; }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); toggleCompare(focused.id); return; }
      if (stage === "image") {
        if (e.key === "1") { e.preventDefault(); tagRole(focused, "start"); return; }
        if (e.key === "2") { e.preventDefault(); tagRole(focused, "end"); return; }
      } else if (e.key === "Enter") {
        e.preventDefault(); tagRole(focused, "take"); return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, filtered.length, compare, stage, items, overrides]);

  // Lock scroll while open; keep the focused thumb in view.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-ix="${index}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  if (!mounted) return null;

  const roleColor = (role: string | null | undefined) =>
    role === "start" ? "var(--h-cyan)" : role === "end" ? "var(--h-pink)"
      : role === "take" || role === "final" ? "var(--h-green)" : null;
  const roleLabel = (role: string | null | undefined) =>
    role === "start" ? "START" : role === "end" ? "END"
      : role === "take" || role === "final" ? "TAKE" : null;

  const compareItems = compareIds
    .map((id) => filtered.find((g) => g.id === id) ?? items.map(view).find((g) => g.id === id))
    .filter(Boolean) as AiGeneration[];

  function Media({ g, big }: { g: AiGeneration; big?: boolean }) {
    const src = srcOf(g);
    const isVideo = g.kind === "video";
    if (!src) {
      return (
        <div className="grid h-full w-full place-items-center px-6 text-center text-sm text-white/50">
          No previewable media for this candidate.
        </div>
      );
    }
    return isVideo ? (
      <video src={src} controls={big} autoPlay={big} muted={!big} loop={!big} playsInline
        className="h-full w-full object-contain" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full object-contain" />
    );
  }

  const filterChips: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "All", n: items.length },
    { k: "kept", label: "Kept", n: keptCount },
    { k: "starred", label: "Starred", n: starCount },
    { k: "rejected", label: "Rejected", n: items.length - keptCount },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col text-white" style={{ background: stageBg }}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="text-sm font-bold">
          Triage <span className="text-white/40">·</span>{" "}
          <span className="uppercase tracking-wide text-white/60">{stage === "image" ? "images" : "takes"}</span>
        </span>
        <span className="text-xs text-white/40">
          {keptCount} kept · {starCount} starred · {items.length} total
        </span>
        <div className="mx-1 flex items-center gap-1">
          {filterChips.map((c) => (
            <button key={c.k} onClick={() => { setFilter(c.k); setIndex(0); }}
              className={`rounded-[7px] px-2.5 py-1 text-xs font-bold transition ${
                filter === c.k ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}>
              {c.label} <span className="opacity-60">{c.n}</span>
            </button>
          ))}
        </div>
        {models.length > 1 && (
          <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setIndex(0); }}
            className="rounded-[7px] border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white outline-none">
            <option value="" className="text-black">All models</option>
            {models.map((m) => <option key={m} value={m} className="text-black">{m}</option>)}
          </select>
        )}
        <span className="flex-1" />
        <button onClick={() => setCompare((v) => !v)}
          className={`rounded-[7px] px-2.5 py-1 text-xs font-bold transition ${
            compare ? "bg-accent text-accent-fg" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}>
          Compare{compareIds.length ? ` (${compareIds.length})` : ""}
        </button>
        {compareIds.length > 0 && (
          <button onClick={() => { setCompareIds([]); setCompare(false); }}
            className="rounded-[7px] bg-white/10 px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/20">Clear</button>
        )}
        <button onClick={() => setSpec((v) => !v)}
          className="rounded-[7px] bg-white/10 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/20">
          {spec ? "Hide info" : "Info"}
        </button>
        <button onClick={onClose} aria-label="Close triage"
          className="grid h-7 w-7 place-items-center rounded-[7px] bg-white/10 text-white/80 hover:bg-white/20">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Stage */}
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 items-center justify-center p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-white/40">Nothing here. Adjust the filter.</p>
          ) : compare && compareItems.length > 0 ? (
            <div className={`grid h-full w-full gap-3 ${compareItems.length <= 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`}>
              {compareItems.map((g) => (
                <div key={g.id} className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-black">
                  <Media g={g} big />
                  <div className="absolute left-2 top-2 flex items-center gap-1.5">
                    {g.model && <span className="rounded-[5px] bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">{g.model}</span>}
                    {roleLabel(g.role) && (
                      <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold text-black" style={{ background: roleColor(g.role)! }}>{roleLabel(g.role)}</span>
                    )}
                    {g.starred && <span className="text-sm text-amber-300">★</span>}
                  </div>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {stage === "image" ? (
                      <>
                        <MiniBtn onClick={() => tagRole(g, "start")} active={g.role === "start"} color="var(--h-cyan)">Start</MiniBtn>
                        <MiniBtn onClick={() => tagRole(g, "end")} active={g.role === "end"} color="var(--h-pink)">End</MiniBtn>
                      </>
                    ) : (
                      <MiniBtn onClick={() => tagRole(g, "take")} active={g.role === "take" || g.role === "final"} color="var(--h-green)">Pick</MiniBtn>
                    )}
                    <MiniBtn onClick={() => star(g)} active={g.starred} color="#fbbf24">★</MiniBtn>
                    <MiniBtn onClick={() => toggleCompare(g.id)}>Remove</MiniBtn>
                  </div>
                </div>
              ))}
            </div>
          ) : focused ? (
            <>
              {/* nav zones */}
              <button aria-label="Previous" onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                className="group absolute left-0 top-0 z-10 flex h-full w-16 items-center justify-start pl-3 text-white/30 hover:text-white/80" disabled={index === 0}>
                <span className="text-3xl">‹</span>
              </button>
              <button aria-label="Next" onClick={() => setIndex((i) => Math.min(i + 1, filtered.length - 1))}
                className="group absolute right-0 top-0 z-10 flex h-full w-16 items-center justify-end pr-3 text-white/30 hover:text-white/80" disabled={index >= filtered.length - 1}>
                <span className="text-3xl">›</span>
              </button>
              <div className="relative flex h-full w-full items-center justify-center">
                <div className={`relative flex max-h-full max-w-full items-center justify-center ${focused.status === "rejected" ? "opacity-40" : ""}`}
                  style={{ aspectRatio: "16/9", width: "min(100%, 1400px)" }}>
                  <Media g={focused} big />
                  <div className="absolute left-2 top-2 flex items-center gap-1.5">
                    {focused.model && <span className="rounded-[5px] bg-black/70 px-2 py-0.5 text-[11px] font-bold">{focused.model}</span>}
                    {roleLabel(focused.role) && (
                      <span className="rounded-[5px] px-2 py-0.5 text-[11px] font-extrabold text-black" style={{ background: roleColor(focused.role)! }}>{roleLabel(focused.role)}</span>
                    )}
                    {focused.starred && <span className="text-lg text-amber-300">★</span>}
                    {focused.status === "rejected" && <span className="rounded-[5px] bg-red px-2 py-0.5 text-[11px] font-bold">Rejected</span>}
                  </div>
                  <span className="absolute right-2 top-2 rounded-[5px] bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                    {index + 1} / {filtered.length}
                  </span>
                </div>
              </div>
              {/* decision bar */}
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-[12px] border border-white/10 bg-black/60 p-1.5 backdrop-blur">
                {stage === "image" ? (
                  <>
                    <DecBtn onClick={() => tagRole(focused, "start")} active={focused.role === "start"} color="var(--h-cyan)" k="1">Start</DecBtn>
                    <DecBtn onClick={() => tagRole(focused, "end")} active={focused.role === "end"} color="var(--h-pink)" k="2">End</DecBtn>
                  </>
                ) : (
                  <DecBtn onClick={() => tagRole(focused, "take")} active={focused.role === "take" || focused.role === "final"} color="var(--h-green)" k="↵">Pick take</DecBtn>
                )}
                <DecBtn onClick={() => star(focused)} active={focused.starred} color="#fbbf24" k="s">★ Star</DecBtn>
                <DecBtn onClick={() => reject(focused)} active={focused.status === "rejected"} color="var(--h-red)" k="x">
                  {focused.status === "rejected" ? "Restore" : "Reject"}
                </DecBtn>
                <DecBtn onClick={() => toggleCompare(focused.id)} active={compareIds.includes(focused.id)} color="var(--accent)" k="c">Compare</DecBtn>
              </div>
            </>
          ) : null}

          {/* Spec sidebar */}
          {spec && focused && !compare && (
            <div className="absolute right-3 top-3 z-10 w-64 rounded-[12px] border border-white/10 bg-black/70 p-3 text-xs backdrop-blur">
              {focused.prompt && (
                <p className="mb-2 max-h-24 overflow-y-auto border-b border-white/10 pb-2 italic text-white/70">&ldquo;{focused.prompt}&rdquo;</p>
              )}
              {([
                ["Platform", focused.platform],
                ["Model", [focused.model, focused.model_version].filter(Boolean).join(" ") || null],
                ["Seed", focused.seed],
                ["Aspect", focused.aspect],
                ["Resolution", focused.resolution],
                ["FPS", focused.fps],
                ["Duration", focused.duration_sec ? `${focused.duration_sec}s` : null],
                ["Cost", focused.cost],
                ["By", focused.generated_by_name],
              ] as [string, string | number | null][])
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-white/5 py-0.5 last:border-0">
                    <span className="text-white/40">{k}</span>
                    <span className="font-semibold">{String(v)}</span>
                  </div>
                ))}
              {focused.external_url && (
                <a href={focused.external_url} target="_blank" rel="noreferrer"
                  className="mt-2 inline-block text-[11px] font-bold text-accent hover:underline">Open original ↗</a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <div className="border-t border-white/10 px-3 py-2">
        <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-1">
          {filtered.map((g, i) => {
            const src = srcOf(g);
            const rl = roleLabel(g.role);
            const inCompare = compareIds.includes(g.id);
            return (
              <button key={g.id} data-ix={i}
                onClick={() => (compare ? toggleCompare(g.id) : setIndex(i))}
                className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                  i === index ? "border-white" : inCompare ? "border-accent" : "border-transparent hover:border-white/40"
                } ${g.status === "rejected" ? "opacity-35" : ""}`}
                style={{ background: "#18181b" }}>
                {src && (g.kind === "video" ? (
                  <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ))}
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-bold">{i + 1}</span>
                {g.starred && <span className="absolute right-1 top-1 text-[11px] text-amber-300">★</span>}
                {rl && (
                  <span className="absolute bottom-1 left-1 rounded px-1 text-[9px] font-extrabold text-black" style={{ background: roleColor(g.role)! }}>{rl}</span>
                )}
              </button>
            );
          })}
        </div>
        {/* legend */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-white/40">
          <span><b className="text-white/70">← →</b> move</span>
          <span><b className="text-white/70">x</b> reject</span>
          <span><b className="text-white/70">s</b> star</span>
          {stage === "image"
            ? <span><b className="text-white/70">1 / 2</b> start / end</span>
            : <span><b className="text-white/70">enter</b> pick take</span>}
          <span><b className="text-white/70">c</b> compare</span>
          <span><b className="text-white/70">esc</b> close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DecBtn({
  children, onClick, active, color, k,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; color: string; k: string;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-bold transition"
      style={active
        ? { background: color, color: "#0b0b0d" }
        : { background: "rgba(255,255,255,.1)", color: "#fff" }}>
      {children}
      <kbd className="rounded bg-black/25 px-1 text-[10px] font-bold" style={active ? { color: "#0b0b0d" } : {}}>{k}</kbd>
    </button>
  );
}

function MiniBtn({
  children, onClick, active, color,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; color?: string;
}) {
  return (
    <button onClick={onClick}
      className="rounded-[7px] px-2 py-1 text-[11px] font-bold transition"
      style={active && color
        ? { background: color, color: "#0b0b0d" }
        : { background: "rgba(0,0,0,.6)", color: "#fff" }}>
      {children}
    </button>
  );
}
