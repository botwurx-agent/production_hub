"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import {
  createStoryboard,
  renameStoryboard,
  deleteStoryboard,
  addFrame,
  updateFrame,
  deleteFrame,
  swapFrames,
  setFrameImage,
  setFrameAsset,
  clearFrameImage,
  restoreStoryboard,
} from "@/app/(app)/projects/[id]/storyboard-actions";
import { useHistory } from "@/lib/use-history";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { ImportDocModal } from "@/components/production/import-doc-modal";
import type { PickableAsset } from "@/components/production/shot-board-editor";
import { SendToReviewButton } from "@/components/projects/send-to-review-button";
import { ShareDocButton } from "@/components/review/share-doc-button";
import { EmailDocButton } from "@/components/review/email-doc-button";
import { DocReviewButton } from "@/components/review/doc-review-button";

export type StoryboardBoard = { id: string; name: string };
export type FrameView = {
  id: string;
  board_id: string;
  position: number;
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
  signedUrl: string | null;
  /** Resized copy for the frame grid. Null when there is nothing to resize. */
  thumbUrl?: string | null;
  image_name: string | null;
  // Persisted fields carried so a history snapshot can rebuild the frame on undo.
  storagePath: string | null;
  mimeType: string | null;
};

const cell =
  "w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-strong";

export function StoryboardEditor({
  projectId,
  boards,
  frames,
  assets,
  reviewedIds = [],
  commentCounts = {},
  emailEnabled = false,
  studioName = "",
}: {
  projectId: string;
  boards: StoryboardBoard[];
  frames: FrameView[];
  assets: PickableAsset[];
  reviewedIds?: string[];
  commentCounts?: Record<string, number>;
  emailEnabled?: boolean;
  studioName?: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [importing, setImporting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(boards[0]?.id ?? null);
  const refresh = () => router.refresh();
  const history = useHistory<FrameView[]>();
  const act = (fn: () => Promise<unknown>) => {
    if (active) history.capture(snapFrames());
    start(async () => {
      await fn();
      refresh();
    });
  };

  const active = boards.find((b) => b.id === activeId) ?? boards[0] ?? null;
  const activeFrames = active
    ? frames.filter((f) => f.board_id === active.id)
    : [];
  const snapFrames = () =>
    frames.filter((f) => active && f.board_id === active.id);

  function doUndo() {
    if (!active) return;
    const snap = history.undo(snapFrames());
    if (!snap) return;
    const boardId = active.id;
    start(async () => { await restoreStoryboard(projectId, boardId, snap); refresh(); });
    toast("Undone");
  }
  function doRedo() {
    if (!active) return;
    const snap = history.redo(snapFrames());
    if (!snap) return;
    const boardId = active.id;
    start(async () => { await restoreStoryboard(projectId, boardId, snap); refresh(); });
    toast("Redone");
  }

  // Reset history when switching storyboards (snapshots are per-board).
  useEffect(() => {
    history.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        doRedo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, frames]);

  function newStoryboard() {
    start(async () => {
      const res = await createStoryboard(projectId);
      if ("board" in res) setActiveId(res.board.id);
      refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      {/* Storyboards sidebar */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Storyboards
          </span>
          <span className="text-xs font-semibold text-text-faint">{boards.length}</span>
        </div>
        <div className="space-y-1">
          {boards.map((b) => {
            const count = frames.filter((f) => f.board_id === b.id).length;
            const isActive = active?.id === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-accent-soft font-semibold text-accent"
                    : "text-text-muted hover:bg-surface-2"
                }`}
              >
                <span className="truncate">{b.name || "Storyboard"}</span>
                <span
                  className="ml-auto shrink-0 rounded-pill px-1.5 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: isActive ? "var(--surface)" : "var(--surface-2)",
                    color: isActive ? "var(--accent)" : "var(--text-faint)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={newStoryboard}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-2 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          + New storyboard
        </button>
        {/* A director's board arrives as a PDF far more often than it gets
            built frame by frame in here, so the import sits alongside. */}
        <button
          onClick={() => setImporting(true)}
          disabled={busy}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-2 text-sm font-semibold text-text-muted transition hover:border-accent hover:text-accent"
        >
          Import from a PDF
        </button>
      </aside>

      {/* Active storyboard */}
      <div className="min-w-0">
        {!active ? (
          <EmptyState
            hue="purple"
            title="No storyboards yet"
            description="An ordered grid of frames: what happens, in what order, with the sound and notes that go with each beat."
            action={
              <button
                onClick={newStoryboard}
                disabled={busy}
                className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
              >
                + New storyboard
              </button>
            }
            steps={[
              {
                title: "Add frames",
                text: "Upload an image per frame or pick one from the project's assets.",
              },
              {
                title: "Describe the beat",
                text: "Scene, description, sound, and notes sit under each frame.",
              },
              {
                title: "Get it approved",
                text: "Send it to the client for pinned comments and a sign-off before you shoot.",
              },
            ]}
          />
        ) : (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <input
                key={active.id}
                defaultValue={active.name}
                onBlur={(e) => renameStoryboard(projectId, active.id, e.target.value)}
                placeholder="Storyboard name"
                className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 font-display text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
              />
              <span className="shrink-0 text-xs font-semibold text-text-faint">
                {activeFrames.length} {activeFrames.length === 1 ? "frame" : "frames"}
              </span>
              <button
                onClick={doUndo}
                disabled={!history.canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                aria-label="Undo"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-border bg-surface text-text-muted transition hover:text-text disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              </button>
              <button
                onClick={doRedo}
                disabled={!history.canRedo}
                title="Redo (Cmd/Ctrl+Shift+Z)"
                aria-label="Redo"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-border bg-surface text-text-muted transition hover:text-text disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
              </button>
              <DocReviewButton
                projectId={projectId}
                kind="storyboard"
                targetId={active.id}
                count={commentCounts[active.id] ?? 0}
              />
              <SendToReviewButton
                projectId={projectId}
                kind="storyboard"
                targetId={active.id}
                inReview={reviewedIds.includes(active.id)}
              />
              <ShareDocButton
                projectId={projectId}
                kind="storyboard"
                targetId={active.id}
                label="Share"
              />
              <EmailDocButton
                projectId={projectId}
                kind="storyboard"
                targetId={active.id}
                studioName={studioName}
                enabled={emailEnabled}
              />
              <a
                href={`/projects/${projectId}/storyboards/present?board=${active.id}&auto=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                PDF
              </a>
              <Link
                href={`/projects/${projectId}/storyboards/present`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-strong"
              >
                Present
              </Link>
              <button
                onClick={async () => {
                  // Asked because this one cannot be taken back. Undo restores
                  // FRAMES within a board, so it has nothing to restore them
                  // into once the board itself is gone.
                  const ok = await confirmAction({
                    title: `Delete "${active.name}"?`,
                    body: `This storyboard and its ${activeFrames.length} frame${
                      activeFrames.length === 1 ? "" : "s"
                    } will be removed. This cannot be undone.`,
                    confirmLabel: "Delete storyboard",
                  });
                  if (!ok) return;
                  act(() => deleteStoryboard(projectId, active.id));
                  setActiveId(null);
                }}
                className="shrink-0 text-text-faint transition hover:text-red"
                aria-label="Delete storyboard"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeFrames.map((f, i) => (
                <FrameCard
                  key={f.id}
                  projectId={projectId}
                  frame={f}
                  number={i + 1}
                  first={i === 0}
                  last={i === activeFrames.length - 1}
                  prev={activeFrames[i - 1]}
                  next={activeFrames[i + 1]}
                  assets={assets}
                  busy={busy}
                  onChange={refresh}
                  onStructural={act}
                  onCapture={() => history.capture(snapFrames())}
                />
              ))}
              <button
                onClick={() => act(() => addFrame(projectId, active.id))}
                disabled={busy}
                className="grid min-h-[260px] place-items-center rounded-[14px] border border-dashed border-border text-sm font-semibold text-text-faint transition hover:border-border-strong hover:text-text"
              >
                + Add frame
              </button>
            </div>
          </div>
        )}
      </div>

      <ImportDocModal
        projectId={projectId}
        studioId=""
        open={importing}
        onClose={() => setImporting(false)}
      />
    </div>
  );
}

function FrameCard({
  projectId,
  frame,
  number,
  first,
  last,
  prev,
  next,
  assets,
  busy,
  onChange,
  onStructural,
  onCapture,
}: {
  projectId: string;
  frame: FrameView;
  number: number;
  first: boolean;
  last: boolean;
  prev?: FrameView;
  next?: FrameView;
  assets: PickableAsset[];
  busy: boolean;
  onChange: () => void;
  onStructural: (fn: () => Promise<unknown>) => void;
  onCapture: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  function upload(files: FileList | null) {
    // Copy off the FileList before anything can clear the input: it is a live
    // view of the input's selection, not an array.
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      try {
        // Straight to storage through a server-minted signed URL. The previous
        // version sent the bytes through a Server Action, which put a 4.5MB
        // platform ceiling on a storyboard frame: a normal camera JPG died at
        // the edge, the promise never settled, and every button on the frame
        // stayed disabled. It read as the app freezing.
        // studioId is vestigial in this helper: the server picks the path so
        // the browser cannot choose which studio folder it writes into.
        const up = await uploadAssetFile({ studioId: "", projectId, file });
        const res = await setFrameImage(
          projectId,
          frame.id,
          up.storagePath,
          up.mimeType || null,
          file.name
        );
        if (res?.error) {
          toast(res.error, "error");
          return;
        }
        onChange();
      } catch (e) {
        // Anything that goes wrong now SAYS so. Swallowing this is what turned
        // a failed upload into a frozen page.
        toast(
          e instanceof Error ? e.message : "That image could not be uploaded.",
          "error"
        );
      }
    });
  }
  function chooseAsset(assetId: string) {
    setPickerOpen(false);
    startUpload(async () => {
      await setFrameAsset(projectId, frame.id, assetId);
      onChange();
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <input
          defaultValue={frame.scene ?? ""}
          onBlur={(e) => { if ((e.target.value || null) !== (frame.scene ?? null)) onCapture(); updateFrame(projectId, frame.id, { scene: e.target.value }); }}
          placeholder="Sc."
          className="w-12 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-text-muted outline-none hover:border-border focus:border-border-strong"
        />
        <span className="text-sm font-extrabold text-text">Frame {number}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() =>
              prev &&
              onStructural(() =>
                swapFrames(
                  projectId,
                  { id: frame.id, position: frame.position },
                  { id: prev.id, position: prev.position }
                )
              )
            }
            disabled={first || busy}
            className="px-1 text-text-faint hover:text-text disabled:opacity-30"
            aria-label="Move left"
          >
            ↑
          </button>
          <button
            onClick={() =>
              next &&
              onStructural(() =>
                swapFrames(
                  projectId,
                  { id: frame.id, position: frame.position },
                  { id: next.id, position: next.position }
                )
              )
            }
            disabled={last || busy}
            className="px-1 text-text-faint hover:text-text disabled:opacity-30"
            aria-label="Move right"
          >
            ↓
          </button>
          <button
            onClick={() => onStructural(() => deleteFrame(projectId, frame.id))}
            className="px-1 text-text-faint hover:text-red"
            aria-label="Delete frame"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="relative">
        <div className="grid aspect-[16/10] place-items-center overflow-hidden bg-surface-2/60">
          {frame.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.thumbUrl ?? frame.signedUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-text-faint">No image</span>
          )}
        </div>
        <div className="absolute bottom-1.5 right-1.5 flex gap-1.5">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={uploading}
            className="rounded-[8px] bg-black/60 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/80"
          >
            {uploading ? "..." : "Asset"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-[8px] bg-black/60 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/80"
          >
            {frame.signedUrl ? "Replace" : "Upload"}
          </button>
          {frame.signedUrl && (
            <button
              onClick={() => onStructural(() => clearFrameImage(projectId, frame.id))}
              className="rounded-[8px] bg-black/60 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/80"
              aria-label="Remove image"
            >
              &times;
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        {pickerOpen && (
          <div className="absolute bottom-10 right-1.5 z-20 max-h-56 w-60 overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-lg">
            {assets.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-text-faint">
                No project assets yet.
              </p>
            ) : (
              assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => chooseAsset(a.id)}
                  className="flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2"
                >
                  <span className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-surface-2/60">
                    {a.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.signedUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-text-faint">file</span>
                    )}
                  </span>
                  <span className="truncate text-xs font-semibold text-text">{a.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-1.5 p-3">
        <textarea
          defaultValue={frame.description ?? ""}
          onBlur={(e) => { if ((e.target.value || null) !== (frame.description ?? null)) onCapture(); updateFrame(projectId, frame.id, { description: e.target.value }); }}
          placeholder="Description…"
          className={`${cell} min-h-[46px]`}
        />
        <input
          defaultValue={frame.sound ?? ""}
          onBlur={(e) => { if ((e.target.value || null) !== (frame.sound ?? null)) onCapture(); updateFrame(projectId, frame.id, { sound: e.target.value }); }}
          placeholder="Sound / VO…"
          className={cell}
        />
        <input
          defaultValue={frame.notes ?? ""}
          onBlur={(e) => { if ((e.target.value || null) !== (frame.notes ?? null)) onCapture(); updateFrame(projectId, frame.id, { notes: e.target.value }); }}
          placeholder="Video / motion…"
          className={cell}
        />
      </div>
    </div>
  );
}
