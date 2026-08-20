"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import {
  createBinder,
  deleteBinder,
  renameBinder,
  revokeBinder,
  saveBinderSections,
  shareBinder,
} from "@/app/(app)/projects/[id]/binder-actions";
import { buildChecklist, reorderChoices, type BinderSection } from "@/lib/binder";

export type BinderRow = {
  id: string;
  title: string | null;
  token: string;
  sections: unknown;
  shared_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
};

/**
 * Assembling a binder.
 *
 * The whole feature is one producer's four to six hours a job, and the thing
 * that makes it worth those hours is not compiling: it is LEAVING THINGS OUT.
 * His examples were a director's notes column and a backup plan for a stunt.
 * So this page is a checklist, not a wizard, and the shape of it is "here is
 * everything this job holds, tick what they may see".
 */
export function BinderBuilder({
  projectId,
  origin,
  binders,
  available,
}: {
  projectId: string;
  origin: string;
  binders: BinderRow[];
  available: BinderSection[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(binders[0]?.id ?? null);

  const active = binders.find((b) => b.id === activeId) ?? binders[0] ?? null;
  const checklist = active
    ? buildChecklist(available, parse(active.sections))
    : [];
  const includedCount = checklist.filter((r) => r.include).length;
  const shared = Boolean(active?.shared_at && !active?.revoked_at);
  const link = active ? `${origin}/bd/${active.token}` : "";

  function parse(raw: unknown) {
    return Array.isArray(raw)
      ? (raw as { key: string; include?: boolean; hideNotes?: boolean }[]).map(
          (r) => ({
            key: String(r.key),
            include: r.include !== false,
            hideNotes: r.hideNotes === true,
          })
        )
      : [];
  }

  function save(next: ReturnType<typeof buildChecklist>) {
    if (!active) return;
    const rows = next.map((r) => ({
      key: r.section.key,
      include: r.include,
      hideNotes: r.hideNotes,
    }));
    start(async () => {
      const res = await saveBinderSections(projectId, active.id, rows);
      if ("error" in res) toast(res.error, "error");
      router.refresh();
    });
  }

  function toggle(key: string, field: "include" | "hideNotes") {
    save(
      checklist.map((r) =>
        r.section.key === key ? { ...r, [field]: !r[field] } : r
      )
    );
  }

  function move(key: string, direction: -1 | 1) {
    if (!active) return;
    const rows = reorderChoices(checklist, key, direction);
    start(async () => {
      const res = await saveBinderSections(projectId, active.id, rows);
      if ("error" in res) toast(res.error, "error");
      router.refresh();
    });
  }

  function setAll(include: boolean) {
    save(checklist.map((r) => ({ ...r, include })));
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Binders
          </span>
          <span className="text-xs font-semibold text-text-faint">
            {binders.length}
          </span>
        </div>
        <div className="space-y-1">
          {binders.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveId(b.id)}
              className={`w-full rounded-[10px] px-3 py-2 text-left text-sm transition ${
                active?.id === b.id
                  ? "bg-accent-soft font-semibold text-accent"
                  : "text-text-muted hover:bg-surface-2"
              }`}
            >
              <span className="block truncate">{b.title || "Untitled binder"}</span>
              <span className="text-[11px] font-normal text-text-faint">
                {b.shared_at && !b.revoked_at
                  ? `Shared · ${b.view_count} view${b.view_count === 1 ? "" : "s"}`
                  : b.revoked_at
                    ? "Turned off"
                    : "Not shared"}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            start(async () => {
              const res = await createBinder(projectId);
              if ("error" in res) toast(res.error, "error");
              else setActiveId(res.id);
              router.refresh();
            })
          }
          disabled={busy}
          className="flex w-full items-center justify-center rounded-[10px] border border-dashed border-border py-2 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          + New binder
        </button>
      </aside>

      <div className="min-w-0">
        {!active ? (
          <div className="rounded-[14px] border border-dashed border-border py-16 text-center">
            <p className="mx-auto max-w-md text-sm text-text-muted">
              A binder is everything about this job in one place, assembled from
              what is already here, and shared as a link or printed. You choose
              what goes in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                key={active.id}
                defaultValue={active.title ?? ""}
                onBlur={(e) =>
                  start(async () => {
                    await renameBinder(projectId, active.id, e.target.value);
                    router.refresh();
                  })
                }
                placeholder="Binder name"
                className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 font-display text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
              />
              <a
                href={`/projects/${projectId}/binder/print?b=${active.id}&auto=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                Download PDF
              </a>
              <a
                href={`/projects/${projectId}/binder/print?b=${active.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                Preview
              </a>
            </div>

            {/* Sharing */}
            <div className="rounded-[12px] border border-border p-3">
              {shared ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-[9px] border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-text-muted outline-none"
                  />
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(link);
                      toast("Link copied.", "success");
                    }}
                    className="rounded-[9px] bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg transition hover:bg-accent-strong"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: "Turn off this link?",
                        body: "Anyone holding it will stop being able to open the binder. You can share it again later.",
                        confirmLabel: "Turn it off",
                      });
                      if (!ok) return;
                      start(async () => {
                        await revokeBinder(projectId, active.id);
                        router.refresh();
                      });
                    }}
                    className="rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-red"
                  >
                    Turn off
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await shareBinder(projectId, active.id);
                        if ("error" in res) toast(res.error, "error");
                        else {
                          void navigator.clipboard.writeText(
                            `${origin}/bd/${res.token}`
                          );
                          toast("Link copied.", "success");
                        }
                        router.refresh();
                      })
                    }
                    disabled={busy || includedCount === 0}
                    className="rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
                  >
                    {active.revoked_at ? "Share again" : "Share this binder"}
                  </button>
                  <span className="text-[12px] text-text-faint">
                    {includedCount === 0
                      ? "Tick at least one section first."
                      : "No login needed. It shows the current state of what you tick, so later edits reach them too."}
                  </span>
                </div>
              )}
            </div>

            {/* The checklist */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-text">
                  What goes in
                </span>
                <span className="text-[12px] text-text-faint">
                  {includedCount} of {checklist.length}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => setAll(true)}
                    className="rounded-[8px] border border-border px-2 py-1 text-[11.5px] font-semibold text-text-muted transition hover:text-text"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAll(false)}
                    className="rounded-[8px] border border-border px-2 py-1 text-[11.5px] font-semibold text-text-muted transition hover:text-text"
                  >
                    None
                  </button>
                </span>
              </div>

              {checklist.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border py-8 text-center text-[13px] text-text-faint">
                  This project has nothing to put in a binder yet. Add a call
                  sheet, a shot list or a storyboard first.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {checklist.map((row, i) => (
                    <div
                      key={row.section.key}
                      className={`flex flex-wrap items-center gap-3 rounded-[11px] border p-2.5 transition ${
                        row.include ? "border-border bg-surface" : "border-border bg-surface-2 opacity-70"
                      }`}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={() => toggle(row.section.key, "include")}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-text">
                            {row.section.label}
                          </span>
                          <span className="block truncate text-[11.5px] text-text-faint">
                            {row.section.hint}
                          </span>
                        </span>
                      </label>

                      {row.section.hasNotes && row.include && (
                        <label
                          className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-text-muted"
                          title="Leave the internal notes column out of the shared copy"
                        >
                          <input
                            type="checkbox"
                            checked={row.hideNotes}
                            onChange={() => toggle(row.section.key, "hideNotes")}
                          />
                          Hide notes
                        </label>
                      )}

                      <span className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => move(row.section.key, -1)}
                          disabled={i === 0 || busy}
                          aria-label="Move up"
                          className="px-1 text-text-faint transition hover:text-text disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(row.section.key, 1)}
                          disabled={i === checklist.length - 1 || busy}
                          aria-label="Move down"
                          className="px-1 text-text-faint transition hover:text-text disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <button
                onClick={async () => {
                  const ok = await confirmAction({
                    title: `Delete "${active.title || "this binder"}"?`,
                    body: "The binder and its link go. Nothing in the project is touched. This cannot be undone.",
                    confirmLabel: "Delete binder",
                  });
                  if (!ok) return;
                  start(async () => {
                    await deleteBinder(projectId, active.id);
                    setActiveId(null);
                    router.refresh();
                  });
                }}
                className="text-[12px] font-semibold text-text-faint transition hover:text-red"
              >
                Delete this binder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
