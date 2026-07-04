"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadFigmaFrames, type FigmaFrameCard } from "@/app/(app)/projects/[id]/figma-actions";
import { addFigmaItems } from "@/app/(app)/boards/actions";

export function BoardFigmaModal({
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
  const [url, setUrl] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [frames, setFrames] = useState<FigmaFrameCard[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function load() {
    setError(null);
    setPicked(new Set());
    start(async () => {
      const res = await loadFigmaFrames(url);
      if ("error" in res) {
        setError(res.error);
        setFrames([]);
      } else {
        setFileKey(res.fileKey);
        setFrames(res.frames);
      }
    });
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function add() {
    if (!fileKey || picked.size === 0) return;
    const chosen = (frames ?? [])
      .filter((f) => picked.has(f.id))
      .map((f) => ({ id: f.id, name: f.name }));
    setError(null);
    start(async () => {
      const res = await addFigmaItems(boardId, fileKey, chosen);
      if (res?.error) setError(res.error);
      else onAdded();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add from Figma">
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex gap-2"
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a Figma file link"
            autoFocus
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            {busy ? "..." : "Load"}
          </Button>
        </form>

        {frames && frames.length > 0 && (
          <div className="grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {frames.map((f) => {
              const on = picked.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className={`overflow-hidden rounded-[12px] border text-left transition ${
                    on ? "border-accent ring-2 ring-accent" : "border-border"
                  }`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-surface-2/60">
                    {f.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.thumb} alt={f.name} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs font-bold text-text-muted">Frame</span>
                    )}
                  </div>
                  <div className="truncate px-2 py-1 text-xs font-semibold text-text">
                    {on ? "✓ " : ""}
                    {f.name}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {frames && frames.length === 0 && !busy && (
          <p className="text-sm text-text-faint">No frames found.</p>
        )}
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
