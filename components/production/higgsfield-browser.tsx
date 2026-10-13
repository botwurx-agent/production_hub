"use client";

// "From Higgsfield": the caller's own Higgsfield generations, newest first,
// ticked and brought onto a shot as candidates. Reads over their MCP
// connection; nothing here generates or spends credits.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { actionError } from "@/lib/action-result";
import { modelLabel, type HfGeneration } from "@/lib/higgsfield-history";
import {
  higgsfieldIdsOnShot,
  importHiggsfieldGenerations,
  listHiggsfieldGenerations,
} from "@/app/(app)/projects/[id]/higgsfield-import-actions";

const MAX_PICK = 12;

export function HiggsfieldBrowser({
  projectId,
  shotId,
  stage,
  onClose,
}: {
  projectId: string;
  shotId: string;
  stage: "image" | "video";
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<HfGeneration[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [onShot, setOnShot] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (from: string | null) => {
      setLoading(true);
      setError(null);
      const res = await listHiggsfieldGenerations(projectId, { kind: stage, cursor: from }).catch(() => undefined);
      if (!alive.current) return;
      setLoading(false);
      const err = actionError(res);
      if (err || !res || "error" in res) {
        setError(err ?? "Could not load your Higgsfield generations.");
        if (res && "notConnected" in res && res.notConnected) setNotConnected(true);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((g) => g.id));
        return [...prev, ...res.items.filter((g) => !seen.has(g.id))];
      });
      setCursor(res.items.length ? res.nextCursor : null);
    },
    [projectId, stage],
  );

  useEffect(() => {
    void loadPage(null);
    higgsfieldIdsOnShot(projectId, shotId)
      .then((ids) => alive.current && setOnShot(new Set(ids ?? [])))
      .catch(() => {});
  }, [loadPage, projectId, shotId]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PICK ? p : [...p, id]));

  const doImport = async () => {
    const chosen = items.filter((g) => picked.includes(g.id));
    if (!chosen.length) return;
    setImporting(true);
    setError(null);
    setNote(null);
    const res = await importHiggsfieldGenerations(projectId, { shotId, stage, picked: chosen }).catch(() => undefined);
    if (!alive.current) return;
    setImporting(false);
    const err = actionError(res);
    if (err || !res || "error" in res) {
      setError(err ?? "The import did not go through.");
      return;
    }
    router.refresh();
    if (res.failed.length === 0) {
      onClose();
      return;
    }
    // Keep the window open on the ones that failed so they can be tried again.
    const failedIds = new Set(res.failed.map((f) => f.id));
    setOnShot((s) => new Set([...Array.from(s), ...chosen.filter((g) => !failedIds.has(g.id)).map((g) => g.id)]));
    setPicked(chosen.filter((g) => failedIds.has(g.id)).map((g) => g.id));
    setNote(
      `${res.imported} brought in${res.skipped ? `, ${res.skipped} already here` : ""}. ` +
        `${res.failed.length} could not be copied: ${res.failed[0].reason}`,
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={stage === "image" ? "Images from your Higgsfield" : "Videos from your Higgsfield"}
    >
      <HiggsfieldBrowserBody
        stage={stage}
        items={items}
        onShot={onShot}
        picked={picked}
        loading={loading}
        importing={importing}
        error={error}
        notConnected={notConnected}
        note={note}
        canLoadMore={!!cursor && !loading}
        onToggle={toggle}
        onLoadMore={() => void loadPage(cursor)}
        onImport={() => void doImport()}
        onCancel={onClose}
      />
    </Modal>
  );
}

function when(ms: number | null): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Presentational, so a fixture can mount it without Higgsfield. */
export function HiggsfieldBrowserBody({
  stage,
  items,
  onShot,
  picked,
  loading,
  importing,
  error,
  notConnected,
  note,
  canLoadMore,
  onToggle,
  onLoadMore,
  onImport,
  onCancel,
}: {
  stage: "image" | "video";
  items: HfGeneration[];
  onShot: Set<string>;
  picked: string[];
  loading: boolean;
  importing: boolean;
  error: string | null;
  notConnected: boolean;
  note: string | null;
  canLoadMore: boolean;
  onToggle: (id: string) => void;
  onLoadMore: () => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const full = picked.length >= MAX_PICK;
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Your latest {stage === "image" ? "images" : "videos"} on Higgsfield, newest first. Tick the ones that belong on
        this shot and they come in as {stage === "image" ? "references" : "takes"}, with the model and prompt they were
        made with. Bringing them in costs no credits.
      </p>

      {error && (
        <div className="rounded-[10px] border border-border bg-red-bg px-3 py-2 text-sm text-text">
          {error}
          {notConnected && (
            <>
              {" "}
              <a href="/settings" className="font-semibold text-accent underline">
                Open Settings
              </a>
            </>
          )}
        </div>
      )}
      {note && <div className="rounded-[10px] border border-border bg-amber-bg px-3 py-2 text-sm text-text">{note}</div>}

      {items.length === 0 && loading ? (
        <p className="py-10 text-center text-sm text-text-muted">Reading your Higgsfield history…</p>
      ) : items.length === 0 && !error ? (
        <p className="py-10 text-center text-sm text-text-muted">
          No finished {stage === "image" ? "images" : "videos"} on your Higgsfield yet.
        </p>
      ) : (
        <div className="grid max-h-[58dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((g) => {
            const here = onShot.has(g.id);
            const sel = picked.includes(g.id);
            const meta = [modelLabel(g.model), g.durationSec ? `${g.durationSec}s` : null, g.aspect, when(g.createdAt)]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={g.id}
                type="button"
                disabled={here || (full && !sel)}
                onClick={() => onToggle(g.id)}
                title={g.prompt ?? undefined}
                aria-pressed={sel}
                className={`group relative overflow-hidden rounded-[10px] border text-left transition ${
                  sel ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent"
                } ${here ? "cursor-default opacity-60" : ""} disabled:cursor-default`}
              >
                <div className="relative aspect-video bg-surface-2">
                  {g.kind === "video" ? (
                    <video
                      src={`${g.url}#t=0.1`}
                      preload="metadata"
                      muted
                      playsInline
                      loop
                      className="absolute inset-0 h-full w-full object-cover"
                      onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => e.currentTarget.pause()}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.thumb ?? g.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-[6px] border text-[11px] font-bold ${
                      sel ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {here && (
                    <span className="absolute right-1.5 top-1.5 rounded-[6px] border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text">
                      On this shot
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 px-2 py-1.5">
                  <div className="truncate text-[11px] font-semibold text-text">{meta || "Higgsfield"}</div>
                  {g.prompt && <div className="line-clamp-2 text-[11px] leading-snug text-text-muted">{g.prompt}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          {canLoadMore && (
            <Button size="sm" variant="secondary" onClick={onLoadMore}>
              Show older
            </Button>
          )}
          {loading && items.length > 0 && <span className="text-xs text-text-muted">Loading…</span>}
          <span className="text-xs text-text-muted">
            {picked.length ? `${picked.length} picked` : "Nothing picked"}
            {full ? ` (${MAX_PICK} at a time)` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onImport} disabled={!picked.length || importing}>
            {importing ? "Bringing them in…" : `Bring in ${picked.length || ""}`.trim()}
          </Button>
        </div>
      </div>
    </div>
  );
}
