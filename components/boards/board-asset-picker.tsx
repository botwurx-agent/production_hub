"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  getProjectAssetsForBoard,
  addAssetItems,
} from "@/app/(app)/boards/actions";

type Proj = { id: string; title: string; assets: { id: string; name: string }[] };

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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setProjects(null);
    getProjectAssetsForBoard().then((res) => setProjects(res.projects));
  }, [open]);

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
    <Modal open={open} onClose={onClose} title="Add from project assets">
      <div className="space-y-4">
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          {projects === null ? (
            <p className="text-sm text-text-faint">Loading assets...</p>
          ) : projects.filter((p) => p.assets.length > 0).length === 0 ? (
            <p className="text-sm text-text-faint">
              No assets in your projects yet.
            </p>
          ) : (
            projects
              .filter((p) => p.assets.length > 0)
              .map((p) => (
                <div key={p.id}>
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-faint">
                    {p.title}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.assets.map((a) => {
                      const on = picked.has(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggle(a.id)}
                          className={`rounded-pill border px-2.5 py-1 text-xs font-semibold transition ${
                            on
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-border text-text-muted hover:border-border-strong"
                          }`}
                        >
                          {a.name}
                          {on ? " ✓" : ""}
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
