"use client";

import { useRef, useTransition } from "react";
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
  swapCards,
  uploadCardImage,
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
  tags: string[];
  signedUrl: string | null;
  image_name: string | null;
};

const HUES = ["green", "pink", "red", "orange", "yellow", "cyan", "blue", "purple", "indigo"];
const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

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
}: {
  projectId: string;
  projectTitle: string;
  board: ShotBoard | null;
  flavors: ShotBoardFlavor[];
  groups: ShotGroup[];
  cards: CardView[];
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Build the shot board. It all saves automatically.
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
              placeholder="Shot board & visual reference"
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

      {/* Shots (groups) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Shots</h3>
          <Button size="sm" onClick={() => act(() => addGroup(projectId))} disabled={busy}>
            + Shot
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
            No shots yet. Add your first shot group.
          </p>
        ) : (
          groups.map((g, gi) => (
            <div key={g.id} className="rounded-[14px] border border-border p-4">
              <div className="mb-3 flex items-start gap-2">
                <span className="mt-1 shrink-0 rounded-[7px] bg-text px-2 py-0.5 text-[11px] font-bold text-bg">
                  Shot {String(gi + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    defaultValue={g.title}
                    onBlur={(e) => updateGroup(projectId, g.id, { title: e.target.value })}
                    placeholder="Shot title (e.g. Spinning Cans)"
                    className="w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                  />
                  <input
                    defaultValue={g.subtitle ?? ""}
                    onBlur={(e) => updateGroup(projectId, g.id, { subtitle: e.target.value })}
                    placeholder="Label (e.g. HERO SPINS · 3 SHOTS)"
                    className={cell}
                  />
                  <textarea
                    defaultValue={g.description ?? ""}
                    onBlur={(e) => updateGroup(projectId, g.id, { description: e.target.value })}
                    placeholder="Describe this shot..."
                    className={`${cell} min-h-[52px]`}
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
                    aria-label="Delete shot"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards
                  .filter((c) => c.group_id === g.id)
                  .map((c) => (
                    <CardEditor
                      key={c.id}
                      projectId={projectId}
                      card={c}
                      busy={busy}
                      onChange={refresh}
                      onStructural={act}
                    />
                  ))}
                <button
                  onClick={() => act(() => addCard(projectId, g.id))}
                  disabled={busy}
                  className="grid min-h-[160px] place-items-center rounded-[12px] border border-dashed border-border text-sm font-semibold text-text-faint transition hover:border-border-strong hover:text-text"
                >
                  + Add card
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CardEditor({
  projectId,
  card,
  busy,
  onChange,
  onStructural,
}: {
  projectId: string;
  card: CardView;
  busy: boolean;
  onChange: () => void;
  onStructural: (fn: () => Promise<unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

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

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60">
        {card.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.signedUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-text-faint">No image</span>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-1.5 right-1.5 rounded-[8px] bg-black/60 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/80"
        >
          {uploading ? "..." : card.signedUrl ? "Replace" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="flex gap-1.5">
          <input
            defaultValue={card.code ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { code: e.target.value })}
            placeholder="Code (1A)"
            className={`${cell} w-16 font-bold`}
          />
          <input
            defaultValue={card.day ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { day: e.target.value })}
            placeholder="Day 1"
            className={`${cell} w-20`}
          />
          <button
            onClick={() => onStructural(() => deleteCard(projectId, card.id))}
            className="ml-auto text-text-faint hover:text-red"
            aria-label="Delete card"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            defaultValue={card.flavor_name ?? ""}
            onBlur={(e) => updateCard(projectId, card.id, { flavor_name: e.target.value })}
            placeholder="Flavor"
            className={cell}
          />
          <select
            defaultValue={card.flavor_hue ?? "green"}
            onChange={(e) => updateCard(projectId, card.id, { flavor_hue: e.target.value })}
            className="rounded-[6px] border border-border bg-surface px-1 py-0.5 text-[11px]"
          >
            {HUES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <textarea
          defaultValue={card.description ?? ""}
          onBlur={(e) => updateCard(projectId, card.id, { description: e.target.value })}
          placeholder="Description"
          className={`${cell} min-h-[56px]`}
        />
        <input
          defaultValue={card.vo ?? ""}
          onBlur={(e) => updateCard(projectId, card.id, { vo: e.target.value })}
          placeholder="VO / OST"
          className={cell}
        />
        <input
          defaultValue={card.tags.join(", ")}
          onBlur={(e) =>
            updateCard(projectId, card.id, {
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="Tags (comma separated)"
          className={cell}
        />
      </div>
    </div>
  );
}
