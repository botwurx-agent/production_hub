"use client";

// Shot blocking on a project: its own full-screen tool, deliberately not the
// app's page chrome. A slim bar (back to the project, the scenes as tabs, new
// scene from a template, save state) over the editor.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import { TEMPLATES } from "@/lib/blocking/templates";
import type { BlockScene } from "@/lib/blocking/scene";
import { createBlockingScene, deleteBlockingScene, describeBlockingScene, saveBlockingScene } from "@/app/(app)/projects/[id]/blocking-actions";
import { SceneBar, type SceneBarAnswer } from "./scene-bar";
import { BlockingStudio } from "./blocking-studio";
import { STUDIO_VARS, useOutside } from "./ui";
import type { PipelineShot } from "./send-to-pipeline";


export function BlockingWorkspace({
  projectId, projectTitle, scenes, active, canEdit, shotId, studioId, shots: initialShots, linkedShotId, aiEnabled = false,
}: {
  /** The scene bar runs on the studio's AI key; hidden when none is set or for view-only access. */
  aiEnabled?: boolean;
  studioId: string;
  shots: PipelineShot[];
  linkedShotId: string | null;
  projectId: string;
  projectTitle: string;
  scenes: { id: string; name: string }[];
  active: { id: string; data: BlockScene } | null;
  canEdit: boolean;
  shotId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useOutside(menu, () => setMenu(false));
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [liveName, setLiveName] = useState<string | null>(null);
  const [pipeShots, setPipeShots] = useState(initialShots);
  const [linked, setLinked] = useState(linkedShotId);
  const pending = useRef<BlockScene | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = (id: string) => `/projects/${projectId}/blocking?scene=${id}`;

  const flush = useCallback(async () => {
    if (!active || !pending.current) return;
    const s = pending.current;
    pending.current = null;
    setState("saving");
    const res = await saveBlockingScene(active.id, s);
    const err = actionError(res);
    if (err) { setState("error"); toast(err, "error"); return; }
    setState(pending.current ? "saving" : "saved");
  }, [active]);

  const onChange = (s: BlockScene) => {
    setLiveName(s.name);
    if (!canEdit) return;
    pending.current = s;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };

  // A change still pending when the scene is switched or the page is left is
  // saved rather than dropped.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void flush(); }, [flush]);

  const create = async (make: () => BlockScene) => {
    setMenu(false);
    setBusy(true);
    const res = await createBlockingScene(projectId, make(), shotId);
    setBusy(false);
    const err = actionError(res);
    if (err || !res || !("id" in res)) { toast(err ?? "Could not create the scene.", "error"); return; }
    router.push(href(res.id));
  };

  const describe = async (prompt: string, current: BlockScene | null) => {
    const res = await describeBlockingScene(projectId, prompt, current);
    const err = actionError(res);
    if (err || !res) return { error: err ?? "That did not reach the server. Try again." };
    return res;
  };

  /** A new scene from a description: laid out, saved, then opened. */
  const startFromWords = async (prompt: string): Promise<SceneBarAnswer> => {
    const res = await describe(prompt, null);
    if ("error" in res) return res;
    const made = await createBlockingScene(projectId, res.scene, shotId);
    const err = actionError(made);
    if (err || !made || !("id" in made)) return { error: err ?? "Could not create the scene." };
    setMenu(false);
    router.push(href(made.id));
    return { summary: res.summary, skipped: res.skipped };
  };
  const bar = aiEnabled && canEdit;

  const remove = async () => {
    if (!active) return;
    const ok = await confirmAction({ title: `Delete "${liveName ?? active.data.name}"?`, body: "The scene and its keyframes go. This cannot be undone.", confirmLabel: "Delete scene" });
    if (!ok) return;
    const res = await deleteBlockingScene(active.id);
    const err = actionError(res);
    if (err) { toast(err, "error"); return; }
    pending.current = null;
    router.push(`/projects/${projectId}/blocking`);
  };

  return (
    <div data-theme="dark" style={STUDIO_VARS} className="fixed inset-0 z-[60] flex flex-col bg-bg text-text">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Link href={`/projects/${projectId}`} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text" title="Back to the project">
          <span aria-hidden>‹</span>
          <span className="max-w-[160px] truncate">{projectTitle}</span>
        </Link>
        <span className="h-5 w-px bg-border" />
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-wide">
          <span className="h-2 w-2 rotate-45 bg-amber" />
          Shot blocking
        </span>
        <nav className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto">
          {scenes.map((s) => {
            const on = active?.id === s.id;
            return (
              <Link key={s.id} href={href(s.id)}
                className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[12px] ${on ? "bg-surface-2 font-semibold text-text" : "text-text-muted hover:text-text"}`}>
                {on ? liveName ?? s.name : s.name}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[11px] ${state === "error" ? "text-red" : "text-text-faint"}`}>
            {!canEdit ? "View only" : state === "saving" ? "Saving…" : state === "error" ? "Not saved" : active ? "Saved" : ""}
          </span>
          {canEdit && active && (
            <button type="button" onClick={remove} className="rounded-[6px] px-2 py-1 text-[12px] text-text-muted hover:text-red">Delete</button>
          )}
          {canEdit && (
            <div ref={menuRef} className="relative">
              <button type="button" disabled={busy} onClick={() => setMenu((v) => !v)}
                className="rounded-[6px] bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-fg disabled:opacity-50">
                + New scene
              </button>
              {menu && (
                <div className={`absolute right-0 top-9 z-40 ${bar ? "w-[420px]" : "w-[300px]"} rounded-[10px] border border-border bg-surface p-1.5 shadow-2xl`}>
                  {bar && (
                    <div className="border-b border-border p-1.5 pb-2.5">
                      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Describe it</p>
                      <SceneBar placeholder="A woman walks her dog along a city sidewalk, tracking side on…" onSubmit={startFromWords} />
                      <p className="mb-0.5 mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Or start from</p>
                    </div>
                  )}
                  {TEMPLATES.map((tp) => (
                    <button key={tp.id} type="button" onClick={() => create(tp.make)}
                      className="block w-full rounded-[7px] px-2.5 py-2 text-left hover:bg-surface-2">
                      <span className="block text-[12.5px] font-semibold text-text">{tp.name}</span>
                      <span className="block text-[11px] text-text-muted">{tp.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-6 text-center lg:hidden">
        <p className="max-w-[320px] text-[13px] leading-relaxed text-text-muted">
          Shot blocking is a 3D tool with a timeline and needs a bigger screen. Open it on a laptop or desktop.
        </p>
      </div>
      <main className="hidden min-h-0 flex-1 lg:block">
        {active ? (
          <BlockingStudio key={active.id} initial={active.data} canEdit={canEdit} onChange={onChange}
            describe={bar ? (p, sc) => describe(p, sc) : undefined}
            pipeline={canEdit ? {
              projectId, studioId, sceneId: active.id, shots: pipeShots, linkedShotId: linked,
              onLinked: (id, list) => { setLinked(id); setPipeShots(list); },
            } : undefined} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full max-w-[760px]">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-text-faint">
                <span className="h-2 w-2 rotate-45 bg-amber" /> Shot blocking
              </p>
              <h1 className="mt-2 font-display text-[30px] font-bold leading-tight">Block the shot, then let the model shoot it.</h1>
              <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-text-muted">
                A low-poly scene with a keyframed camera. Record it as a blocking clip and Seedance follows the camera move, with the first frame as its start image.
              </p>
              {bar && (
                <div className="mt-6">
                  <p className="mb-2 text-[12px] font-semibold text-text">Describe the shot</p>
                  <SceneBar placeholder="A runner crosses a coastal road at dawn, camera tracking alongside, then pulls ahead…" onSubmit={startFromWords} />
                  <p className="mt-5 text-[12px] font-semibold text-text">Or start from a template</p>
                </div>
              )}
              {canEdit ? (
                <div className={`${bar ? "mt-2" : "mt-6"} grid gap-2 sm:grid-cols-2 lg:grid-cols-3`}>
                  {TEMPLATES.map((tp) => (
                    <button key={tp.id} type="button" disabled={busy} onClick={() => create(tp.make)}
                      className="rounded-[12px] border border-border bg-surface p-4 text-left transition hover:border-accent disabled:opacity-50">
                      <span className="block text-[14px] font-semibold">{tp.name}</span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-text-muted">{tp.hint}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-[13px] text-text-muted">No blocking scenes on this project yet.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
