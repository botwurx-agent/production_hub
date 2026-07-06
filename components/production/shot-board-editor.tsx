"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  saveBoard,
  addFlavor,
  updateFlavor,
  deleteFlavor,
  addGroup,
  updateGroup,
  deleteGroup,
  swapGroups,
  addCard,
  updateCard,
  deleteCard,
  uploadCardImage,
  setCardAsset,
  clearCardAsset,
} from "@/app/(app)/projects/[id]/production/board-actions";
import type {
  ShotBoard,
  ShotBoardFlavor,
  ShotGroup,
} from "@/lib/database.types";

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
};

export type PickableAsset = { id: string; name: string; signedUrl: string | null };

const HUES = ["green", "pink", "red", "orange", "yellow", "cyan", "blue", "purple", "indigo"];
const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

// Industry-standard presets, offered as suggestions while still allowing free
// text (via <datalist>). Mirrors the reference shot-list dropdowns.
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
  flavors,
  groups,
  cards,
  assets,
}: {
  projectId: string;
  projectTitle: string;
  board: ShotBoard | null;
  flavors: ShotBoardFlavor[];
  groups: ShotGroup[];
  cards: CardView[];
  assets: PickableAsset[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const refresh = () => router.refresh();
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); refresh(); });

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

  // Running shot number across the whole list, StudioBinder-style.
  let shotNo = 0;

  return (
    <div className="space-y-8">
      {/* Shared option lists for the shot fields. */}
      <datalist id="shot-sizes">
        {SHOT_SIZES.map((s) => <option key={s} value={s} />)}
      </datalist>
      <datalist id="shot-types">
        {SHOT_TYPES.map((s) => <option key={s} value={s} />)}
      </datalist>
      <datalist id="shot-movements">
        {MOVEMENTS.map((s) => <option key={s} value={s} />)}
      </datalist>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Build the shot list. It all saves automatically.
        </p>
        <Link
          href={`/projects/${projectId}/production/board`}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-strong"
        >
          Present / Export
        </Link>
      </div>

      {/* Cover header */}
      <div className="space-y-3 rounded-[14px] border border-border p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-text-faint">
          Cover
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label="Title">
            <input
              defaultValue={board?.title ?? ""}
              onBlur={(e) => saveBoard(projectId, { title: e.target.value || null })}
              placeholder={projectTitle}
              className={field}
            />
          </Labeled>
          <Labeled label="Subtitle">
            <input
              defaultValue={board?.subtitle ?? ""}
              onBlur={(e) => saveBoard(projectId, { subtitle: e.target.value || null })}
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
                onBlur={(e) => saveBoard(projectId, { [key]: e.target.value || null })}
                className={field}
              />
            </Labeled>
          ))}
        </div>

        {/* Flavor palette */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Flavor palette
            </div>
            <button
              onClick={() => act(() => addFlavor(projectId))}
              disabled={busy}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Flavor
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {flavors.map((fl) => (
              <div
                key={fl.id}
                className="flex items-center gap-1.5 rounded-[10px] border border-border p-1.5"
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-[7px]"
                  style={{
                    background: `linear-gradient(135deg, var(--h-${fl.hue}) 0%, var(--h-${fl.hue}-bg) 130%)`,
                  }}
                />
                <input
                  defaultValue={fl.name}
                  onBlur={(e) => updateFlavor(projectId, fl.id, { name: e.target.value })}
                  placeholder="Flavor"
                  className="w-24 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-xs text-text outline-none focus:border-border"
                />
                <select
                  defaultValue={fl.hue}
                  onChange={(e) => updateFlavor(projectId, fl.id, { hue: e.target.value })}
                  className="rounded-[6px] border border-border bg-surface px-1 py-0.5 text-[11px]"
                >
                  {HUES.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => act(() => deleteFlavor(projectId, fl.id))}
                  className="text-text-faint hover:text-red"
                  aria-label="Remove flavor"
                >
                  &times;
                </button>
              </div>
            ))}
            {flavors.length === 0 && (
              <span className="text-xs text-text-faint">No flavors yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Sections (groups) of shot rows */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Shots</h3>
          <Button size="sm" onClick={() => act(() => addGroup(projectId))} disabled={busy}>
            + Section
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
            No shots yet. Add your first section, then add shots to it.
          </p>
        ) : (
          groups.map((g, gi) => {
            const groupCards = cards.filter((c) => c.group_id === g.id);
            return (
              <div key={g.id} className="rounded-[14px] border border-border p-4">
                <div className="mb-3 flex items-start gap-2">
                  <span className="mt-1 shrink-0 rounded-[7px] bg-text px-2 py-0.5 text-[11px] font-bold text-bg">
                    {String(gi + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      defaultValue={g.title}
                      onBlur={(e) => updateGroup(projectId, g.id, { title: e.target.value })}
                      placeholder="Section title (e.g. Hero Spins)"
                      className="w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                    />
                    <input
                      defaultValue={g.subtitle ?? ""}
                      onBlur={(e) => updateGroup(projectId, g.id, { subtitle: e.target.value })}
                      placeholder="Label (e.g. HERO SPINS · 3 SHOTS)"
                      className={cell}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-center">
                    <button
                      onClick={() =>
                        gi > 0 &&
                        act(() =>
                          swapGroups(
                            projectId,
                            { id: g.id, position: g.position },
                            { id: groups[gi - 1].id, position: groups[gi - 1].position }
                          )
                        )
                      }
                      disabled={gi === 0 || busy}
                      className="text-text-faint hover:text-text disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() =>
                        gi < groups.length - 1 &&
                        act(() =>
                          swapGroups(
                            projectId,
                            { id: g.id, position: g.position },
                            { id: groups[gi + 1].id, position: groups[gi + 1].position }
                          )
                        )
                      }
                      disabled={gi === groups.length - 1 || busy}
                      className="text-text-faint hover:text-text disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => act(() => deleteGroup(projectId, g.id))}
                      className="mt-1 text-text-faint hover:text-red"
                      aria-label="Delete section"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Column header (desktop) */}
                {groupCards.length > 0 && (
                  <div className="mb-1 hidden gap-3 border-b border-border px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint lg:flex">
                    <span className="w-[150px] shrink-0">Image</span>
                    <span className="w-8 shrink-0 text-center">#</span>
                    <span className="flex-1">Description</span>
                    <span className="w-40 shrink-0">Shot size</span>
                    <span className="w-40 shrink-0">Shot type</span>
                    <span className="w-40 shrink-0">Camera movement</span>
                    <span className="w-6 shrink-0" />
                  </div>
                )}

                <div className="space-y-3">
                  {groupCards.map((c) => {
                    shotNo += 1;
                    return (
                      <ShotRow
                        key={c.id}
                        projectId={projectId}
                        card={c}
                        number={shotNo}
                        flavors={flavors}
                        assets={assets}
                        busy={busy}
                        onChange={refresh}
                        onStructural={act}
                      />
                    );
                  })}
                </div>

                <button
                  onClick={() => act(() => addCard(projectId, g.id))}
                  disabled={busy}
                  className="mt-3 w-full rounded-[10px] border border-dashed border-border py-2.5 text-sm font-semibold text-text-faint transition hover:border-border-strong hover:text-text"
                >
                  + Add shot
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ShotRow({
  projectId,
  card,
  number,
  flavors,
  assets,
  busy,
  onChange,
  onStructural,
}: {
  projectId: string;
  card: CardView;
  number: number;
  flavors: ShotBoardFlavor[];
  assets: PickableAsset[];
  busy: boolean;
  onChange: () => void;
  onStructural: (fn: () => Promise<unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

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
    <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-3 lg:flex-row lg:items-start">
      {/* Image / asset */}
      <div className="relative w-[150px] shrink-0">
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

      {/* Shot number */}
      <div className="hidden w-8 shrink-0 pt-2 text-center text-sm font-extrabold tabular-nums text-text lg:block">
        {number}
      </div>

      {/* Fields */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="lg:hidden text-xs font-bold text-text-faint">Shot {number}</div>
        <textarea
          defaultValue={card.description ?? ""}
          onBlur={(e) => updateCard(projectId, card.id, { description: e.target.value })}
          placeholder="Description..."
          className={`${field} min-h-[52px]`}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            list="shot-sizes"
            defaultValue={card.shot_size ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { shot_size: e.target.value })}
            placeholder="Shot size..."
            className={field}
          />
          <input
            list="shot-types"
            defaultValue={card.shot_type ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { shot_type: e.target.value })}
            placeholder="Shot type..."
            className={field}
          />
          <input
            list="shot-movements"
            defaultValue={card.movement ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { movement: e.target.value })}
            placeholder="Camera movement..."
            className={field}
          />
        </div>
        {/* Secondary details, kept compact so nothing from before is lost. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            defaultValue={card.code ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { code: e.target.value })}
            placeholder="Code (1A)"
            className={`${cell} w-20 border-border`}
          />
          <input
            defaultValue={card.day ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { day: e.target.value })}
            placeholder="Day"
            className={`${cell} w-20 border-border`}
          />
          <select
            defaultValue={card.flavor_name ?? ""}
            onChange={(e) => updateCard(projectId, card.id, { flavor_name: e.target.value })}
            className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs text-text-muted"
          >
            <option value="">Flavor…</option>
            {flavors.map((fl) => (
              <option key={fl.id} value={fl.name}>
                {fl.name}
              </option>
            ))}
          </select>
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
