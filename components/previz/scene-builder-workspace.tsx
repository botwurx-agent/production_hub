"use client";

// Scene builder on a project: a slim bar naming the project and listing its
// setups as tabs, over the full-height 3D builder. A job usually has several
// setups (the kitchen, the hero product table, the bedroom), each holding the
// several camera positions shot from it, so a setup is the unit a tab opens.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import { PrevizPrototype, type SceneStore } from "@/components/previz/previz-prototype";
import {
  bathroomSetup, bedroomSetup, blankSetup, kitchenSetup, studioSetup, type Setup,
} from "@/components/previz/setup";
import {
  createSceneSetup, deleteSceneSetup, saveSceneSetup,
} from "@/app/(app)/projects/[id]/scene-actions";

const PRESETS: { l: string; d: string; make: () => Setup }[] = [
  { l: "Empty room", d: "5 x 6 m with one window. Build it to your location.", make: () => blankSetup(5, 6, 2.8) },
  { l: "Talent on seamless", d: "Paper backdrop, one person, one camera.", make: studioSetup },
  { l: "Kitchen", d: "A simple kitchen, one person, one camera.", make: kitchenSetup },
  { l: "Bathroom", d: "A simple bathroom, one person, one camera.", make: bathroomSetup },
  { l: "Bedroom", d: "A simple bedroom, one person, one camera.", make: bedroomSetup },
];

export function SceneBuilderWorkspace({
  projectId,
  projectTitle,
  setups,
  active,
  unreadable,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  setups: { id: string; name: string }[];
  active: { id: string; data: Setup } | null;
  unreadable: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  // Names follow edits in the open setup straight away, rather than waiting
  // for the next page load to rename its tab.
  const [liveName, setLiveName] = useState<string | null>(null);
  const href = (id: string) => `/projects/${projectId}/scene-builder?setup=${id}`;

  const create = async (s: Setup) => {
    const res = await createSceneSetup(projectId, s);
    const err = actionError(res);
    if (err || !res || !("id" in res)) { toast(err ?? "Could not create the setup.", "error"); return; }
    router.push(href(res.id));
    router.refresh();
  };

  const store: SceneStore | undefined = active
    ? {
        initial: active.data,
        canEdit,
        create,
        save: async (s) => {
          setLiveName(s.name);
          const res = await saveSceneSetup(active.id, s);
          return actionError(res);
        },
      }
    : undefined;

  const remove = async () => {
    if (!active) return;
    const name = setups.find((s) => s.id === active.id)?.name ?? "this setup";
    const ok = await confirmAction({
      title: `Delete ${name}?`,
      body: "The set, the people, the lights and every camera position in it go. This cannot be undone.",
      confirmLabel: "Delete setup",
    });
    if (!ok) return;
    startBusy(async () => {
      const err = actionError(await deleteSceneSetup(active.id));
      if (err) { toast(err, "error"); return; }
      const next = setups.find((s) => s.id !== active.id);
      router.push(next ? href(next.id) : `/projects/${projectId}/scene-builder`);
      router.refresh();
    });
  };

  return (
    // Full bleed inside the app shell: undo main's padding, and size the
    // builder to what is left under the topbar (57px) and this bar (49px).
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-8">
      <div className="flex h-[49px] items-center gap-3 border-b border-border bg-surface px-4">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-text-muted hover:text-text"
        >
          <ChevronLeftIcon /> <span className="max-w-[160px] truncate">{projectTitle}</span>
        </Link>
        <span className="text-text-faint">/</span>
        <span className="shrink-0 font-display text-sm font-bold">Scene builder</span>
        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Setups">
          {setups.map((s) => {
            const on = s.id === active?.id;
            return (
              <Link
                key={s.id}
                href={href(s.id)}
                aria-current={on ? "page" : undefined}
                className={`max-w-[200px] shrink-0 truncate rounded-[8px] px-2.5 py-1 text-xs font-semibold ${
                  on ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {on && liveName ? liveName : s.name}
              </Link>
            );
          })}
        </nav>
        {active && canEdit ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="shrink-0 rounded-[8px] px-2 py-1 text-xs font-semibold text-text-muted hover:text-red disabled:opacity-50"
          >
            Delete setup
          </button>
        ) : null}
      </div>

      {active && store ? (
        <PrevizPrototype key={active.id} store={store} heightClass="h-[calc(100dvh-106px)]" />
      ) : (
        <div className="mx-auto max-w-[860px] px-4 py-12">
          {unreadable ? (
            <p className="mb-6 rounded-[10px] border border-border bg-surface px-4 py-3 text-sm">
              This setup was saved by a newer or older build and cannot be opened here. Start another below.
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Build the setup before the shoot</h1>
          <p className="mt-2 max-w-[620px] text-[15px] text-text-muted">
            Lay out the set, the people, the lights and the cameras in 3D. Each camera frames a shot through a real
            lens and sensor, and the meter reads the light the way a gaffer would. Start from a room below.
          </p>
          {canEdit ? (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRESETS.map((p) => (
                <button
                  key={p.l}
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(() => create(p.make()))}
                  className="rounded-[14px] border border-border bg-surface p-4 text-left transition hover:border-accent disabled:opacity-50"
                >
                  <span className="block font-display text-[15px] font-bold">{p.l}</span>
                  <span className="mt-1 block text-[13px] text-text-muted">{p.d}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-sm text-text-muted">No setups on this project yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
