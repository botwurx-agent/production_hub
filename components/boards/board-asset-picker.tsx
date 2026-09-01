"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProjectAssetsForBoard,
  addAssetItems,
  type PickableAsset,
} from "@/app/(app)/boards/actions";

type Proj = { id: string; title: string; assets: PickableAsset[] };

/**
 * Pick assets to put on a board.
 *
 * TWO THINGS THIS USED TO GET WRONG, both reported from real use.
 *
 * It offered EVERY PROJECT'S assets. The loader took no arguments and selected
 * the whole studio, so a moodboard belonging to one job listed the assets of
 * every other job. Not just noise: a straightforward way to put another
 * client's frame on this client's board. It is scoped to the board's project
 * now, and only a studio-wide board (under /boards, belonging to no project)
 * still sees everything, grouped, because there is no job to scope it to.
 *
 * And it was A LIST OF FILENAMES. Choosing a reference by its filename is not
 * choosing it by eye, which is the entire job of a moodboard. Every asset now
 * shows the picture, at a size you can actually judge.
 */
export function BoardAssetPicker({
  boardId,
  open,
  onClose,
  onAdded,
}: {
  boardId: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [projects, setProjects] = useState<Proj[] | null>(null);
  const [scopedTo, setScopedTo] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setProjects(null);
    setQ("");
    setError(null);
    getProjectAssetsForBoard(boardId).then((res) => {
      setProjects(res.projects);
      setScopedTo(res.scopedTo);
    });
  }, [open, boardId]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (projects ?? [])
      .map((p) => ({
        ...p,
        assets: needle
          ? p.assets.filter((a) => a.name.toLowerCase().includes(needle))
          : p.assets,
      }))
      .filter((p) => p.assets.length > 0);
  }, [projects, q]);

  const total = groups.reduce((n, p) => n + p.assets.length, 0);

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function add() {
    if (picked.size === 0) return;
    setError(null);
    start(async () => {
      const res = await addAssetItems(boardId, [...picked]);
      if (res?.error) setError(res.error);
      else onAdded();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={scopedTo ? `Add from ${scopedTo}` : "Add from project assets"}
    >
      <div className="space-y-4">
        {projects !== null && total > 8 && (
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name..."
            autoFocus
          />
        )}

        <div className="max-h-[58vh] space-y-5 overflow-y-auto">
          {projects === null ? (
            <p className="text-sm text-text-faint">Loading assets...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-text-faint">
              {q.trim()
                ? `Nothing matching "${q.trim()}".`
                : scopedTo
                  ? "This project has no assets yet. Upload some on its Assets page and they will show up here."
                  : "No assets in your projects yet."}
            </p>
          ) : (
            groups.map((p) => (
              <div key={p.id}>
                {/* Only worth a heading when there is more than one project in
                    play, which now only happens on a studio-wide board. */}
                {!scopedTo && (
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
                    {p.title}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {p.assets.map((a) => {
                    const on = picked.has(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggle(a.id)}
                        title={a.name}
                        className={`group overflow-hidden rounded-[12px] border text-left transition ${
                          on
                            ? "border-accent ring-2 ring-accent"
                            : "border-border hover:border-border-strong"
                        }`}
                      >
                        <span className="relative block aspect-[4/3] bg-surface-2">
                          {a.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.thumbUrl}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center text-[11px] font-bold uppercase tracking-wide text-text-faint">
                              {a.type ?? "file"}
                            </span>
                          )}
                          {on && (
                            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg">
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                                <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </span>
                        <span className="block truncate px-2 py-1.5 text-[11.5px] font-semibold text-text">
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={busy || picked.size === 0}>
            {busy ? "Adding..." : `Add ${picked.size || ""}`.trim()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
