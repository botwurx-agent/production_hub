"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { kindMeta, type CastAssignment, type CastEntity, type CastShot } from "@/lib/cast";
import { setShotCast } from "@/app/(app)/projects/[id]/cast-actions";

/**
 * Entities down the side, shots across the top, the look in each cell.
 *
 * This is the wardrobe continuity board live action has always kept, and it is
 * the reason to open this page at all. A flat list of characters is data entry;
 * the grid is the thing that answers "what is she wearing in shot 4" and shows
 * you the wardrobe change you did not intend.
 *
 * The cell control is a native select rather than a custom popover. It is the
 * honest control for "pick one look", it is keyboard navigable for free, and a
 * grid of them cannot develop the positioning bugs a hand-rolled menu would.
 */
export function ContinuityGrid({
  projectId,
  entities,
  shots,
  assignments,
  changedShotIds,
}: {
  projectId: string;
  entities: CastEntity[];
  shots: CastShot[];
  assignments: CastAssignment[];
  /** shot ids where a look changed from the entity's previous appearance */
  changedShotIds: Map<string, Set<string>>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const byCell = new Map(
    assignments.map((a) => [`${a.shot_id}:${a.entity_id}`, a])
  );

  /**
   * An element that belongs to a look gets NO row of its own.
   *
   * The wardrobe is in the shot exactly when the look is, so a second row for
   * it is not extra control, it is a second place to state the same fact, and
   * two places that can disagree. "Maya in LK-01" and "LK-01 wardrobe: not in
   * shot" is a contradiction the grid should not be able to express.
   *
   * A prop that is in no look keeps its row, because nothing else speaks for
   * it.
   */
  const inSomeLook = new Set<string>();
  for (const e of entities) {
    for (const l of e.looks) for (const id of l.itemIds) inSomeLook.add(id);
  }
  const rows = entities.filter(
    (e) => !(e.kind === "element" && inSomeLook.has(e.id))
  );
  const covered = entities.length - rows.length;

  function change(shotId: string, entity: CastEntity, value: string) {
    const key = `${shotId}:${entity.id}`;
    setBusy(key);
    start(async () => {
      const present = value !== "out";
      const lookId = present && value !== "in" ? value : null;
      const res = await setShotCast(projectId, shotId, entity.id, lookId, present);
      setBusy(null);
      if (res?.error) toast(res.error, "error");
      else router.refresh();
    });
  }

  if (shots.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Add shots in the pipeline and they will appear here as columns.
      </p>
    );
  }

  return (
    // The grid is the one thing on this page that legitimately scrolls
    // sideways, so it does so inside its own container and the page body never
    // moves.
    <div className="overflow-x-auto rounded-[13px] border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[190px] border-b border-r border-border bg-surface-2 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-faint">
              Cast
            </th>
            {shots.map((s, i) => (
              <th
                key={s.id}
                className="min-w-[150px] border-b border-border bg-surface-2 px-3 py-2.5 text-left"
                title={s.title || `Shot ${i + 1}`}
              >
                <span className="block text-xs font-semibold">{i + 1}</span>
                <span className="block truncate text-[11px] font-normal text-text-faint">
                  {s.title || "Untitled"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const meta = kindMeta(e.kind);
            return (
              <tr key={e.id}>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-2 text-left align-middle">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--h-${meta.hue})` }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {e.name}
                      </span>
                      <span className="block truncate text-[11px] text-text-faint">
                        {meta.label}
                      </span>
                    </span>
                  </span>
                </th>

                {shots.map((s) => {
                  const key = `${s.id}:${e.id}`;
                  const a = byCell.get(key);
                  const value = !a ? "out" : a.look_id ?? "in";
                  const changed = changedShotIds.get(e.id)?.has(s.id) ?? false;
                  const missingLook = Boolean(a) && !a?.look_id && e.looks.length > 0;

                  return (
                    <td
                      key={s.id}
                      className="border-b border-border px-2 py-1.5 align-middle"
                      style={
                        changed
                          ? { backgroundColor: "var(--h-amber-bg)" }
                          : undefined
                      }
                    >
                      <select
                        value={value}
                        disabled={busy === key}
                        onChange={(ev) => change(s.id, e, ev.target.value)}
                        aria-label={`${e.name} in shot ${s.title || s.position + 1}`}
                        className={`w-full rounded-[8px] border bg-surface px-1.5 py-1 text-[12px] outline-none transition focus:border-accent ${
                          a ? "border-border-strong text-text" : "border-transparent text-text-faint"
                        } ${missingLook ? "border-amber" : ""}`}
                      >
                        <option value="out">Not in this shot</option>
                        <option value="in">
                          {e.looks.length ? "In shot, no look" : "In shot"}
                        </option>
                        {e.looks.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {changed && (
                        <span className="mt-0.5 block text-[10px] font-medium text-amber">
                          look changes here
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {covered > 0 && (
        <p className="border-t border-border px-3 py-2 text-[11.5px] text-text-faint">
          {covered === 1 ? "One element is" : `${covered} elements are`} part of a
          look, so {covered === 1 ? "it follows" : "they follow"} whoever is
          wearing {covered === 1 ? "it" : "them"} and {covered === 1 ? "does" : "do"} not
          need a row here.
        </p>
      )}
    </div>
  );
}
