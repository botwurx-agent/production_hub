"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import {
  HANDLE_PLATFORMS,
  displayHandle,
  handlesFor,
  kindMeta,
  lintPrompt,
  mentions,
  type CastReference,
} from "@/lib/cast";
import { setShotReference } from "@/app/(app)/projects/[id]/cast-actions";

const STORE_KEY = "pipeline.targetPlatform";

/**
 * The references this shot uses, sitting above its prompt.
 *
 * Three jobs, in order of how often they matter:
 *
 * 1. Insert the handle. Nobody should type "@Maya-LK01" from memory: one
 *    character off and it silently resolves to nothing while the prompt still
 *    reads correctly.
 * 2. Say which references this shot uses, HERE, next to the prompt you are
 *    writing, rather than on a separate page you have to visit first. That
 *    ordering was the single biggest thing wrong with the previous design.
 * 3. Flag a handle in the prompt that none of this shot's references owns,
 *    which is the one failure that is invisible without us.
 *
 * A chip already in the prompt shows a tick. That is feedback, not a warning:
 * leaving a reference out is a choice, not a mistake. An earlier version
 * scolded about it, along with three other things, and the warnings fired on
 * correct setups often enough to be worth ignoring, which is the worst state a
 * check can reach.
 */
export function PromptCastBar({
  projectId,
  shotId,
  all,
  used,
  text,
  onInsert,
}: {
  projectId: string;
  shotId: string;
  /** Every reference in the job. */
  all: CastReference[];
  /** The ones this shot uses. */
  used: CastReference[];
  text: string;
  onInsert: (token: string) => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [picking, setPicking] = useState(false);

  // Which platform you are generating on is a per-person working preference,
  // not studio state, so it lives in localStorage rather than a column.
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
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(({ ref, handle }) => {
          const inPrompt = mentions(text, handle);
          const meta = kindMeta(ref.kind);
          return (
            <button
              key={ref.id}
              type="button"
              onClick={() => onInsert(displayHandle(handle))}
              title={`Insert ${displayHandle(handle)}`}
              className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                inPrompt
                  ? "border-transparent bg-accent-soft text-accent"
                  : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: `var(--h-${meta.hue})` }}
              />
              {ref.name}
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
          {picking ? "Done" : used.length ? "Edit references" : "+ References"}
        </button>

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

      {picking && (
        <div className="mt-2 rounded-[11px] border border-border bg-surface-2 p-2.5">
          {all.length === 0 ? (
            <p className="text-[12px] text-text-faint">
              No references in this job yet. Add them on the Cast page.
            </p>
          ) : (
            <div className="grid gap-0.5 sm:grid-cols-2">
              {all.map((r) => {
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

      {strays.length > 0 && (
        <ul className="mt-1.5 grid gap-0.5">
          {strays.map((s) => (
            <li key={s.handle} className="text-[11.5px] text-amber">
              <span className="font-mono">@{s.handle}</span> is not one of this
              shot&apos;s references, so it will not resolve.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
