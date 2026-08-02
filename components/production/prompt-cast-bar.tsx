"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HANDLE_PLATFORMS,
  displayHandle,
  kindMeta,
  lintPrompt,
  type ShotCastMember,
} from "@/lib/cast";

const STORE_KEY = "pipeline.targetPlatform";

/**
 * The cast of this shot, sitting above the working prompt.
 *
 * Two jobs. Clicking a chip inserts the platform's real handle at the caret, so
 * nobody types `@maya` from memory; a handle one character off silently stops
 * resolving and the model improvises, which is invisible until the client
 * notices the jacket changed.
 *
 * And it lints, which is where it earns its place. The continuity grid answers
 * these questions for the whole job; this answers them for the thing you are
 * about to spend credits on.
 */
export function PromptCastBar({
  members,
  text,
  onInsert,
}: {
  members: ShotCastMember[];
  text: string;
  onInsert: (token: string) => void;
}) {
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

  const issues = useMemo(
    () => lintPrompt(text, members, platform),
    [text, members, platform]
  );

  if (members.length === 0) {
    return (
      <p className="text-[11.5px] text-text-faint">
        Nobody is assigned to this shot yet. Assign the cast and their handles
        drop in here.
      </p>
    );
  }

  const noHandle = issues.filter((i) => i.kind === "no-handle");
  const unused = issues.filter((i) => i.kind === "unused");
  const unknown = issues.filter((i) => i.kind === "unknown");

  return (
    <div className="rounded-[11px] border border-border bg-surface-2 p-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          In this shot
        </span>
        <select
          value={platform}
          onChange={(e) => pickPlatform(e.target.value)}
          className="ml-auto rounded-[8px] border border-border bg-surface px-1.5 py-0.5 text-[11px] outline-none focus:border-accent"
          aria-label="Platform you are generating on"
        >
          {HANDLE_PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {members.map(({ entity, look }) => {
          const meta = kindMeta(entity.kind);
          const eh = entity.handles.find((h) => h.platform === platform);
          const lh = look?.handles.find((h) => h.platform === platform);
          return (
            <span key={entity.id} className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onInsert(eh ? displayHandle(eh.handle) : entity.description || entity.name)
                }
                title={
                  eh
                    ? `Insert ${displayHandle(eh.handle)}`
                    : `No ${platform} handle. Inserts the written description instead, which is the weaker path.`
                }
                className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition ${
                  eh
                    ? "text-accent-fg hover:opacity-90"
                    : "border border-dashed border-border-strong text-text-muted hover:border-accent"
                }`}
                style={eh ? { backgroundColor: `var(--h-${meta.hue})` } : undefined}
              >
                {entity.name}
                {eh && (
                  <span className="font-mono opacity-80">{displayHandle(eh.handle)}</span>
                )}
              </button>

              {look && (
                <button
                  type="button"
                  onClick={() =>
                    onInsert(lh ? displayHandle(lh.handle) : look.description || look.name)
                  }
                  title={lh ? `Insert ${displayHandle(lh.handle)}` : `No ${platform} handle for this look.`}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] transition ${
                    lh
                      ? "bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg"
                      : "border border-dashed border-border-strong text-text-faint hover:border-accent"
                  }`}
                >
                  {look.name}
                  {lh && <span className="font-mono">{displayHandle(lh.handle)}</span>}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {issues.length > 0 && (
        <ul className="mt-2.5 grid gap-1 border-t border-border pt-2">
          {/* The silent one first: the prompt reads perfectly and the model
              improvises what was never uploaded. */}
          {noHandle.map((i, n) => (
            <li key={`n${n}`} className="flex gap-1.5 text-[11.5px] text-red">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-red" />
              <span>
                <strong className="font-semibold">{i.label}</strong> has no {platform}{" "}
                handle, so this will be generated from words and will drift.
              </span>
            </li>
          ))}
          {unknown.map((i, n) => (
            <li key={`u${n}`} className="flex gap-1.5 text-[11.5px] text-amber">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber" />
              <span>
                <span className="font-mono">{displayHandle(i.handle)}</span> is not in
                this shot. Left over from another prompt?
              </span>
            </li>
          ))}
          {unused.map((i, n) => (
            <li key={`s${n}`} className="flex gap-1.5 text-[11.5px] text-text-muted">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-border-strong" />
              <span>
                <strong className="font-medium">{i.label}</strong> is in this shot but
                the prompt never mentions{" "}
                <span className="font-mono">{displayHandle(i.handle)}</span>.
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
