"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  HANDLE_PLATFORMS,
  PICKABLE_KINDS,
  displayHandle,
  handlesFor,
  kindMeta,
  lintPrompt,
  mentions,
  suggestedHandle,
  type CastReference,
} from "@/lib/cast";
import {
  promoteToReference,
  setShotReference,
} from "@/app/(app)/projects/[id]/cast-actions";

const STORE_KEY = "pipeline.targetPlatform";

export type LooseRef = {
  id: string;
  role: string | null;
  kind: string | null;
  src: string | null;
};

/**
 * Everything this shot is built from, in one place.
 *
 * The pipeline used to show two separate reference areas, which is one more
 * than the platform has and one more than anyone can hold in their head. The
 * split that DOES exist, and that this now mirrors, is Higgsfield's own:
 *
 *   ELEMENTS   named and saved, carry an @handle, reusable across shots and
 *              jobs. You call them by name in a prompt.
 *   REFERENCES a specific image fed into this shot, often destined to become a
 *              start or end frame. No name, no handle, this shot only.
 *
 * And the two are not really separate: a reference that turns out to be worth
 * keeping gets SAVED AS an element, which is why every loose reference here
 * carries a "Save as element" that names it, records its handle, and adds it to
 * this shot's elements without re-uploading anything.
 */
export function ShotReferences({
  projectId,
  shotId,
  library,
  used,
  loose,
  text,
  onInsert,
  onAddImage,
  onRemoveLoose,
}: {
  projectId: string;
  shotId: string;
  /** Every named element in the job. */
  library: CastReference[];
  /** The ones this shot uses. */
  used: CastReference[];
  /** Loose image references attached to this stage. */
  loose: LooseRef[];
  text: string;
  onInsert: (token: string) => void;
  onAddImage: () => void;
  onRemoveLoose: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [promoting, setPromoting] = useState<LooseRef | null>(null);

  const [platform, setPlatform] = useState(HANDLE_PLATFORMS[0]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE_KEY);
      if (saved) setPlatform(saved);
    } catch {}
  }, []);
  function pickPlatform(next: string) {
    setPlatform(next);
    try {
      window.localStorage.setItem(STORE_KEY, next);
    } catch {}
  }

  const chips = handlesFor(used, platform);
  const noHandle = used.filter((r) => !chips.some((c) => c.ref.id === r.id));
  const strays = lintPrompt(text, used, platform);

  function toggle(refId: string, on: boolean) {
    start(async () => {
      const res = await setShotReference(projectId, shotId, refId, on);
      if (res?.error) toast(res.error, "error");
      else router.refresh();
    });
  }

  return (
    <div className="mb-3 rounded-[12px] border border-border p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          Built from
        </p>
        <select
          value={platform}
          onChange={(e) => pickPlatform(e.target.value)}
          className="ml-auto rounded-[8px] border border-border bg-surface px-1.5 py-1 text-[11px] text-text-muted outline-none focus:border-accent"
          title="Which platform you are generating on"
        >
          {HANDLE_PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* ---------------------------------------------------------- elements */}
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
        Elements
        <span className="ml-1.5 font-normal normal-case">
          saved and named, called by handle in the prompt
        </span>
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {chips.map(({ ref, handle }) => {
          const inPrompt = mentions(text, handle);
          const meta = kindMeta(ref.kind);
          return (
            <button
              key={ref.id}
              type="button"
              onClick={() => onInsert(displayHandle(handle))}
              title={`Insert ${displayHandle(handle)}`}
              className={`inline-flex items-center gap-1.5 rounded-pill border py-1 pl-1 pr-2.5 text-[11.5px] font-semibold transition ${
                inPrompt
                  ? "border-transparent bg-accent-soft text-accent"
                  : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {ref.sheets[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ref.sheets[0].url}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `var(--h-${meta.hue})` }}
                />
              )}
              {ref.name}
              <span className="font-mono opacity-70">{displayHandle(handle)}</span>
              {inPrompt && <span aria-hidden>&#10003;</span>}
            </button>
          );
        })}

        {noHandle.map((r) => (
          <span
            key={r.id}
            title={`No ${platform} handle recorded, so a prompt can only describe this in words.`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-border-strong px-2.5 py-1 text-[11.5px] text-text-faint"
          >
            {r.name}
            <span>no handle</span>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          disabled={busy}
          className="rounded-pill border border-dashed border-border-strong px-2.5 py-1 text-[11.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
        >
          {picking ? "Done" : used.length ? "Edit" : "+ Element"}
        </button>
      </div>

      {picking && (
        <div className="mb-3 rounded-[11px] border border-border bg-surface-2 p-2.5">
          {library.length === 0 ? (
            <p className="text-[12px] text-text-faint">
              No elements saved yet. Add one on the Elements page, or save a
              reference below as an element.
            </p>
          ) : (
            <div className="grid gap-0.5 sm:grid-cols-2">
              {library.map((r) => {
                const on = used.some((u) => u.id === r.id);
                const meta = kindMeta(r.kind);
                return (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-[9px] border px-2 py-1.5 text-[12.5px] transition ${
                      on
                        ? "border-accent bg-accent-soft"
                        : "border-transparent hover:bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy}
                      onChange={() => toggle(r.id, !on)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--h-${meta.hue})` }}
                    />
                    <span className="min-w-0 truncate">{r.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- references */}
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
        References
        <span className="ml-1.5 font-normal normal-case">
          one-off images for this shot, no handle
        </span>
      </p>

      {loose.length === 0 ? (
        <button
          onClick={onAddImage}
          className="rounded-[9px] border border-dashed border-border-strong px-2.5 py-1.5 text-[11.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
        >
          + Image
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {loose.map((g) => (
            <div
              key={g.id}
              className="overflow-hidden rounded-[10px] border border-border"
            >
              <div className="relative" style={{ aspectRatio: "16/9", background: "var(--surface-2)" }}>
                {g.src &&
                  (g.kind === "video" ? (
                    <video
                      src={g.src}
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.src}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ))}
                <span className="absolute left-1 top-1 rounded-[4px] bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">
                  {g.role || "ref"}
                </span>
                <button
                  onClick={() => onRemoveLoose(g.id)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white transition hover:bg-red"
                  title="Remove reference"
                  aria-label="Remove reference"
                >
                  &times;
                </button>
              </div>
              <button
                onClick={() => setPromoting(g)}
                className="w-full border-t border-border px-2 py-1 text-[10.5px] font-semibold text-text-muted transition hover:text-accent"
                title="Name it, record its handle, and reuse it in any shot"
              >
                Save as element
              </button>
            </div>
          ))}
          <button
            onClick={onAddImage}
            className="grid place-items-center rounded-[10px] border border-dashed border-border-strong text-[11.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
            style={{ aspectRatio: "16/9" }}
          >
            + Image
          </button>
        </div>
      )}

      {strays.length > 0 && (
        <ul className="mt-2.5 grid gap-0.5 border-t border-border pt-2">
          {strays.map((s) => (
            <li key={s.handle} className="text-[11.5px] text-amber">
              <span className="font-mono">@{s.handle}</span> is not one of this
              shot&apos;s elements, so it will not resolve.
            </li>
          ))}
        </ul>
      )}

      {promoting && (
        <PromoteModal
          projectId={projectId}
          platform={platform}
          loose={promoting}
          onClose={() => setPromoting(null)}
          onDone={() => {
            setPromoting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PromoteModal({
  projectId,
  platform,
  loose,
  onClose,
  onDone,
}: {
  projectId: string;
  platform: string;
  loose: LooseRef;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>(PICKABLE_KINDS[0].key);
  const [handle, setHandle] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, start] = useTransition();

  const effective = touched ? handle : suggestedHandle(name);
  const field =
    "w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

  return (
    <Modal open onClose={onClose} title="Save as element" size="md">
      <div className="space-y-3">
        {loose.src && loose.kind !== "video" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={loose.src}
            alt=""
            className="max-h-40 w-full rounded-[10px] border border-border object-contain"
          />
        )}
        <p className="text-[12.5px] text-text-muted">
          Naming this makes it reusable: it gets a handle you can call in any
          prompt, and it joins the job&apos;s elements. The shot keeps using the
          image either way.
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
          placeholder="Enter name"
          autoFocus
        />

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text-muted">Category</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          >
            {PICKABLE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-muted">
            Handle on {platform}
          </span>
          <input
            value={effective}
            onChange={(e) => {
              setTouched(true);
              setHandle(e.target.value);
            }}
            className={`${field} font-mono`}
            placeholder="Maya"
          />
          <span className="mt-1 block text-[11.5px] text-text-faint">
            Follows the name. Change it if the platform called it something else.
          </span>
        </label>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button
            disabled={busy || !name.trim()}
            onClick={() =>
              start(async () => {
                const res = await promoteToReference(projectId, loose.id, {
                  name,
                  kind,
                  platform,
                  handle: effective,
                });
                if ("error" in res && res.error) {
                  toast(res.error, "error");
                  return;
                }
                if ("warning" in res && res.warning) toast(res.warning, "info");
                else toast("Saved as an element.", "success");
                onDone();
              })
            }
          >
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
