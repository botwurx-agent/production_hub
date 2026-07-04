"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadFigmaFrames,
  importFigmaFrame,
  type FigmaFrameCard,
} from "@/app/(app)/projects/[id]/figma-actions";

function FigmaGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 0 0 0 8z" opacity=".7" />
      <path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" opacity=".55" />
      <path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" opacity=".85" />
      <path d="M12 0h4a4 4 0 0 1 0 8h-4z" opacity=".7" />
      <path d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

function FrameCard({
  projectId,
  fileKey,
  frame,
  onDone,
}: {
  projectId: string;
  fileKey: string;
  frame: FigmaFrameCard;
  onDone: () => void;
}) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function add() {
    setErr(null);
    start(async () => {
      const res = await importFigmaFrame(projectId, fileKey, frame.id, frame.name);
      if (res?.error) setErr(res.error);
      else {
        setDone(true);
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60">
        {frame.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame.thumb} alt={frame.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs font-bold text-text-muted">Frame</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-text" title={frame.name}>
            {frame.name}
          </div>
          <div className="mt-0.5 text-xs text-text-faint">{frame.page}</div>
        </div>
        {err && <div className="text-xs font-medium text-red">{err}</div>}
        <Button
          size="sm"
          variant={done ? "secondary" : "primary"}
          disabled={done || busy}
          onClick={add}
          className="mt-auto w-full"
        >
          {done ? "Added" : busy ? "Adding..." : "Add to assets"}
        </Button>
      </div>
    </div>
  );
}

export function FigmaImportButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [frames, setFrames] = useState<FigmaFrameCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function load() {
    setError(null);
    start(async () => {
      const res = await loadFigmaFrames(url);
      if ("error" in res) {
        setError(res.error);
        setFrames([]);
      } else {
        setFileKey(res.fileKey);
        setFileName(res.fileName);
        setFrames(res.frames);
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <FigmaGlyph /> Import from Figma
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-bold text-text">
                Import from Figma
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-border px-5 py-3">
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
              {fileName && frames && frames.length > 0 && (
                <p className="mt-2 text-xs text-text-faint">
                  {fileName} · pick frames to import
                </p>
              )}
              {error && (
                <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                  {error}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {frames === null ? (
                <p className="py-10 text-center text-sm text-text-faint">
                  Paste a link to a Figma file to see its frames.
                </p>
              ) : busy ? (
                <p className="py-10 text-center text-sm text-text-faint">
                  Loading frames...
                </p>
              ) : frames.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-faint">
                  No top-level frames found in that file.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {frames.map((f) => (
                    <FrameCard
                      key={f.id}
                      projectId={projectId}
                      fileKey={fileKey!}
                      frame={f}
                      onDone={() => router.refresh()}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border px-5 py-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
