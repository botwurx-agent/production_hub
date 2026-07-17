"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveBoard,
  addGroup,
  updateGroup,
  deleteGroup,
  addCard,
  updateCard,
  deleteCard,
  duplicateCard,
  moveCard,
  uploadCardImage,
  setCardAsset,
  clearCardAsset,
  restoreShotBoard,
} from "@/app/(app)/projects/[id]/production/board-actions";
import { useHistory } from "@/lib/use-history";
import { toast } from "@/components/ui/toast";
import { DocReviewButton } from "@/components/review/doc-review-button";
import { SendToReviewButton } from "@/components/projects/send-to-review-button";
import { ShareDocButton } from "@/components/review/share-doc-button";
import { EmailDocButton } from "@/components/review/email-doc-button";
import type { ShotBoard, ShotGroup } from "@/lib/database.types";

export type CardView = {
  id: string;
  group_id: string;
  position: number;
  code: string | null;
  day: string | null;
  flavor_name: string | null;
  flavor_hue: string | null;
  description: string | null;
  vo: string | null;
  shot_size: string | null;
  shot_type: string | null;
  movement: string | null;
  asset_id: string | null;
  tags: string[];
  signedUrl: string | null;
  image_name: string | null;
  // Persisted fields carried so a history snapshot can rebuild the row on undo.
  storagePath: string | null;
  mimeType: string | null;
};

export type PickableAsset = { id: string; name: string; signedUrl: string | null };

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

const SHOT_SIZES = [
  "Extreme Close-up", "Close-up", "Medium Close-up", "Wide Close-up",
  "Medium Shot", "Medium Close Shot", "Close Shot",
  "Medium Full Shot", "Full Shot", "Wide Shot", "Extreme Wide Shot",
  "Long Shot", "Extreme Long Shot",
];
const SHOT_TYPES = [
  "Eye Level", "Low Angle", "High Angle", "Overhead", "Shoulder Level",
  "Hip Level", "Knee Level", "Ground Level", "Dutch (left)", "Dutch (right)",
  "Single", "Two Shot", "Three Shot", "Over-the-Shoulder", "Over-the-Hip",
  "Point of View", "Rack Focus", "Shallow Focus", "Deep Focus", "Tilt-Shift",
];
const MOVEMENTS = [
  "Static", "Pan", "Tilt", "Swish Pan", "Swish Tilt", "Tracking",
  "Push In", "Pull Out", "Dolly", "Crane", "Handheld", "Zoom",
  "Steadicam", "Gimbal",
];

// Fixed, learnable colors per shot column so the list scans at a glance.
const COL = { size: "blue", type: "purple", move: "green" } as const;

// Colored chip styling for a shot field once it has a value (else plain input).
function chipStyle(value: string, hue: string): React.CSSProperties | undefined {
  return value.trim()
    ? {
        backgroundColor: `var(--h-${hue}-bg)`,
        color: `var(--h-${hue})`,
        borderColor: "transparent",
        fontWeight: 600,
      }
    : undefined;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ShotBoardEditor({
  projectId,
  projectTitle,
  board,
  groups,
  cards,
  assets,
  commentCount = 0,
  inReview = false,
  emailEnabled = false,
  studioName = "",
}: {
  projectId: string;
  projectTitle: string;
  board: ShotBoard | null;
  groups: ShotGroup[];
  cards: CardView[];
  assets: PickableAsset[];
  commentCount?: number;
  inReview?: boolean;
  emailEnabled?: boolean;
  studioName?: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const refresh = () => router.refresh();
  const history = useHistory<{ groups: ShotGroup[]; cards: CardView[] }>();
  const act = (fn: () => Promise<unknown>) => {
    history.capture({ groups, cards });
    start(async () => { await fn(); refresh(); });
  };

  function doUndo() {
    const snap = history.undo({ groups, cards });
    if (!snap) return;
    start(async () => { await restoreShotBoard(projectId, snap.groups, snap.cards); refresh(); });
    toast("Undone");
  }
  function doRedo() {
    const snap = history.redo({ groups, cards });
    if (!snap) return;
    start(async () => { await restoreShotBoard(projectId, snap.groups, snap.cards); refresh(); });
    toast("Redone");
  }

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
  }, [groups, cards]);

  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [coverOpen, setCoverOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;
  const activeCards = active ? cards.filter((c) => c.group_id === active.id) : [];

  function selectList(id: string) {
    setActiveId(id);
    setSelected(new Set());
    setMoveOpen(false);
  }

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === activeCards.length
        ? new Set()
        : new Set(activeCards.map((c) => c.id))
    );
  }

  function bulk(fn: (id: string) => Promise<unknown>) {
    history.capture({ groups, cards });
    const ids = [...selected];
    start(async () => {
      for (const id of ids) await fn(id);
      setSelected(new Set());
      setMoveOpen(false);
      refresh();
    });
  }

  const headerFields: [keyof ShotBoard, string][] = [
    ["client", "Client"],
    ["agency", "Agency"],
    ["production_co", "Production Co."],
    ["deliverables", "Deliverables"],
    ["director", "Director"],
    ["dp", "DP"],
    ["location", "Location"],
    ["job_no", "Job No."],
    ["shoot_days", "Shoot days"],
    ["rev_date", "Revision"],
  ];

  return (
    <div className="space-y-5">
      <datalist id="shot-sizes">
        {SHOT_SIZES.map((s) => <option key={s} value={s} />)}
      </datalist>
      <datalist id="shot-types">
        {SHOT_TYPES.map((s) => <option key={s} value={s} />)}
      </datalist>
      <datalist id="shot-movements">
        {MOVEMENTS.map((s) => <option key={s} value={s} />)}
      </datalist>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCoverOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${coverOpen ? "rotate-90" : ""}`}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Cover
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={doUndo}
              disabled={!history.canUndo}
              title="Undo (Cmd/Ctrl+Z)"
              aria-label="Undo"
              className="grid h-8 w-8 place-items-center rounded-[8px] border border-border bg-surface text-text-muted transition hover:text-text disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            </button>
            <button
              onClick={doRedo}
              disabled={!history.canRedo}
              title="Redo (Cmd/Ctrl+Shift+Z)"
              aria-label="Redo"
              className="grid h-8 w-8 place-items-center rounded-[8px] border border-border bg-surface text-text-muted transition hover:text-text disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DocReviewButton
            projectId={projectId}
            kind="shot_list"
            targetId={projectId}
            count={commentCount}
          />
          <SendToReviewButton
            projectId={projectId}
            kind="shot_list"
            targetId={projectId}
            inReview={inReview}
          />
          <ShareDocButton projectId={projectId} kind="shot_list" targetId={projectId} label="Share" />
          <EmailDocButton
            projectId={projectId}
            kind="shot_list"
            targetId={projectId}
            studioName={studioName}
            enabled={emailEnabled}
          />
          <a
            href={`/projects/${projectId}/production/board?auto=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            PDF
          </a>
          <Link
            href={`/projects/${projectId}/production/board`}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-strong"
          >
            Present
          </Link>
        </div>
      </div>

      {/* Cover header (collapsible) */}
      {coverOpen && (
        <div className="space-y-3 rounded-[14px] border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Labeled label="Title">
              <input
                defaultValue={board?.title ?? ""}
                onBlur={(e) => { if ((e.target.value || null) !== (board?.title ?? null)) history.capture({ groups, cards }); saveBoard(projectId, { title: e.target.value || null }); }}
                placeholder={projectTitle}
                className={field}
              />
            </Labeled>
            <Labeled label="Subtitle">
              <input
                defaultValue={board?.subtitle ?? ""}
                onBlur={(e) => { if ((e.target.value || null) !== (board?.subtitle ?? null)) history.capture({ groups, cards }); saveBoard(projectId, { subtitle: e.target.value || null }); }}
                placeholder="Shot list & visual reference"
                className={field}
              />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {headerFields.map(([key, label]) => (
              <Labeled key={key} label={label}>
                <input
                  defaultValue={(board?.[key] as string) ?? ""}
                  onBlur={(e) => { if ((e.target.value || null) !== ((board?.[key] as string | null | undefined) ?? null)) history.capture({ groups, cards }); saveBoard(projectId, { [key]: e.target.value || null }); }}
                  className={field}
                />
              </Labeled>
            ))}
          </div>
        </div>
      )}

      {/* Two-pane: lists sidebar + active list rows */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[232px_1fr]">
        {/* Lists sidebar */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
              Shot lists
            </span>
            <span className="text-xs font-semibold text-text-faint">{groups.length}</span>
          </div>
          <div className="space-y-1">
            {groups.map((g) => {
              const count = cards.filter((c) => c.group_id === g.id).length;
              const isActive = active?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => selectList(g.id)}
                  className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-accent-soft font-semibold text-accent"
                      : "text-text-muted hover:bg-surface-2"
                  }`}
                >
                  <span className="truncate">{g.title?.trim() || "Untitled list"}</span>
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
            onClick={() => act(() => addGroup(projectId))}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-2 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
          >
            + New shot list
          </button>
        </aside>

        {/* Active list */}
        <div className="min-w-0">
          {!active ? (
            <div className="rounded-[14px] border border-dashed border-border py-16 text-center">
              <p className="text-sm text-text-faint">
                No shot lists yet. Create your first one.
              </p>
              <button
                onClick={() => act(() => addGroup(projectId))}
                disabled={busy}
                className="mt-4 rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
              >
                + New shot list
              </button>
            </div>
          ) : (
            <div className="rounded-[14px] border border-border p-4">
              {/* List header */}
              <div className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    key={active.id}
                    defaultValue={active.title}
                    onBlur={(e) => { if ((e.target.value || null) !== (active.title ?? null)) history.capture({ groups, cards }); updateGroup(projectId, active.id, { title: e.target.value }); }}
                    placeholder="Untitled list"
                    className="w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                  />
                  <input
                    key={`${active.id}-sub`}
                    defaultValue={active.subtitle ?? ""}
                    onBlur={(e) => { if ((e.target.value || null) !== (active.subtitle ?? null)) history.capture({ groups, cards }); updateGroup(projectId, active.id, { subtitle: e.target.value }); }}
                    placeholder="Label (optional)"
                    className={cell}
                  />
                </div>
                <span className="shrink-0 pt-2 text-xs font-semibold text-text-faint">
                  {activeCards.length} {activeCards.length === 1 ? "shot" : "shots"}
                </span>
                <button
                  onClick={() => {
                    act(() => deleteGroup(projectId, active.id));
                    setActiveId(null);
                  }}
                  className="shrink-0 pt-1.5 text-text-faint hover:text-red"
                  aria-label="Delete list"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Selection toolbar */}
              {selected.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2">
                  <span className="text-sm font-semibold text-text">
                    {selected.size} selected
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => bulk((id) => duplicateCard(projectId, id))}
                      disabled={busy}
                      className="rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text"
                    >
                      Duplicate
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setMoveOpen((v) => !v)}
                        disabled={busy || groups.length < 2}
                        className="rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-40"
                      >
                        Move to ▾
                      </button>
                      {moveOpen && (
                        <div className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-[10px] border border-border bg-surface p-1 shadow-lg">
                          {groups
                            .filter((g) => g.id !== active.id)
                            .map((g) => (
                              <button
                                key={g.id}
                                onClick={() =>
                                  bulk((id) => moveCard(projectId, id, g.id))
                                }
                                className="block w-full truncate rounded-[8px] px-2 py-1.5 text-left text-sm transition hover:bg-surface-2"
                              >
                                {g.title?.trim() || "Untitled list"}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => bulk((id) => deleteCard(projectId, id))}
                      disabled={busy}
                      className="rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-red transition hover:bg-red/10"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="text-text-faint hover:text-text"
                      aria-label="Clear selection"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Column header */}
              {activeCards.length > 0 && (
                <div className="mb-1 hidden items-center gap-3 border-b border-border px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint lg:flex">
                  <span className="w-5 shrink-0">
                    <input
                      type="checkbox"
                      checked={selected.size === activeCards.length && activeCards.length > 0}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                  </span>
                  <span className="w-[130px] shrink-0">Image</span>
                  <span className="w-7 shrink-0 text-center">#</span>
                  <span className="flex-1">Description</span>
                  <span className="w-36 shrink-0" style={{ color: `var(--h-${COL.size})` }}>Shot size</span>
                  <span className="w-36 shrink-0" style={{ color: `var(--h-${COL.type})` }}>Shot type</span>
                  <span className="w-36 shrink-0" style={{ color: `var(--h-${COL.move})` }}>Movement</span>
                  <span className="w-6 shrink-0" />
                </div>
              )}

              <div className="space-y-3">
                {activeCards.map((c, i) => (
                  <ShotRow
                    key={c.id}
                    projectId={projectId}
                    card={c}
                    number={i + 1}
                    assets={assets}
                    busy={busy}
                    selected={selected.has(c.id)}
                    onToggleSelect={() => toggleCard(c.id)}
                    onChange={refresh}
                    onStructural={act}
                    onCapture={() => history.capture({ groups, cards })}
                  />
                ))}
              </div>

              <button
                onClick={() => act(() => addCard(projectId, active.id))}
                disabled={busy}
                className="mt-3 w-full rounded-[10px] border border-dashed border-border py-2.5 text-sm font-semibold text-text-faint transition hover:border-border-strong hover:text-text"
              >
                + Add shot
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShotRow({
  projectId,
  card,
  number,
  assets,
  busy,
  selected,
  onToggleSelect,
  onChange,
  onStructural,
  onCapture,
}: {
  projectId: string;
  card: CardView;
  number: number;
  assets: PickableAsset[];
  busy: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: () => void;
  onStructural: (fn: () => Promise<unknown>) => void;
  onCapture: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Local mirrors so the colored chips update live as you type.
  const [size, setSize] = useState(card.shot_size ?? "");
  const [stype, setSType] = useState(card.shot_type ?? "");
  const [move, setMove] = useState(card.movement ?? "");
  // Calm identity color for the row accent + number badge.
  const rowHue = "indigo";

  function upload(files: FileList | null) {
    if (!files?.[0]) return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("cardId", card.id);
    fd.set("file", files[0]);
    startUpload(async () => {
      await uploadCardImage(fd);
      onChange();
    });
  }

  function chooseAsset(assetId: string) {
    setPickerOpen(false);
    startUpload(async () => {
      await setCardAsset(projectId, card.id, assetId);
      onChange();
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-[12px] border bg-surface p-3 transition lg:flex-row lg:items-start ${
        selected ? "ring-2 ring-accent" : ""
      }`}
      style={{
        borderColor: "var(--border)",
        borderLeftColor: `var(--h-${rowHue})`,
        borderLeftWidth: "4px",
      }}
    >
      <div className="flex items-start gap-3 lg:contents">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)] lg:mt-2"
          aria-label={`Select shot ${number}`}
        />

        {/* Image / asset */}
        <div className="relative w-[130px] shrink-0">
          <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-[10px] border border-border bg-surface-2/60">
            {card.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.signedUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-text-faint">No image</span>
            )}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              disabled={uploading}
              className="flex-1 rounded-[8px] border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:text-text"
            >
              {uploading ? "..." : "Asset"}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 rounded-[8px] border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:text-text"
            >
              Upload
            </button>
            {card.signedUrl && (
              <button
                onClick={() => onStructural(() => clearCardAsset(projectId, card.id))}
                className="rounded-[8px] border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-text-faint transition hover:text-red"
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
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-lg">
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
                    <span className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-surface-2/60">
                      {a.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.signedUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-text-faint">file</span>
                      )}
                    </span>
                    <span className="truncate text-xs font-semibold text-text">
                      {a.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="hidden shrink-0 pt-1.5 lg:block">
          <span
            className="grid h-7 w-7 place-items-center rounded-[8px] text-xs font-extrabold tabular-nums text-white"
            style={{ backgroundColor: `var(--h-${rowHue})` }}
          >
            {number}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="min-w-0 flex-1 space-y-2">
        <div
          className="text-xs font-bold lg:hidden"
          style={{ color: `var(--h-${rowHue})` }}
        >
          Shot {number}
        </div>
        <textarea
          defaultValue={card.description ?? ""}
          onBlur={(e) => { if ((e.target.value || null) !== (card.description ?? null)) onCapture(); updateCard(projectId, card.id, { description: e.target.value }); }}
          placeholder="Description..."
          className={`${field} min-h-[52px]`}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            list="shot-sizes"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onBlur={(e) => { if ((e.target.value || null) !== (card.shot_size ?? null)) onCapture(); updateCard(projectId, card.id, { shot_size: e.target.value }); }}
            placeholder="Shot size..."
            className={field}
            style={chipStyle(size, COL.size)}
          />
          <input
            list="shot-types"
            value={stype}
            onChange={(e) => setSType(e.target.value)}
            onBlur={(e) => { if ((e.target.value || null) !== (card.shot_type ?? null)) onCapture(); updateCard(projectId, card.id, { shot_type: e.target.value }); }}
            placeholder="Shot type..."
            className={field}
            style={chipStyle(stype, COL.type)}
          />
          <input
            list="shot-movements"
            value={move}
            onChange={(e) => setMove(e.target.value)}
            onBlur={(e) => { if ((e.target.value || null) !== (card.movement ?? null)) onCapture(); updateCard(projectId, card.id, { movement: e.target.value }); }}
            placeholder="Camera movement..."
            className={field}
            style={chipStyle(move, COL.move)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            defaultValue={card.code ?? ""}
            onBlur={(e) => { if ((e.target.value || null) !== (card.code ?? null)) onCapture(); updateCard(projectId, card.id, { code: e.target.value }); }}
            placeholder="Code (1A)"
            className={`${cell} w-20 border-border`}
          />
          <input
            defaultValue={card.day ?? ""}
            onBlur={(e) => { if ((e.target.value || null) !== (card.day ?? null)) onCapture(); updateCard(projectId, card.id, { day: e.target.value }); }}
            placeholder="Day"
            className={`${cell} w-20 border-border`}
          />
          <button
            onClick={() => onStructural(() => deleteCard(projectId, card.id))}
            className="ml-auto text-text-faint hover:text-red"
            aria-label="Delete shot"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
