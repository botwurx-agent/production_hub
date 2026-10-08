"use client";

// The project's location stills: frames from the phone viewfinder, each one
// labelled with the camera, lens and aspect it was framed for, and the way
// into the scene builder ("Build a scene" starts a setup whose camera is that
// lens, with the still overlaid to match).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASPECTS, ffEquivalent, fovDeg, imagedArea } from "@/lib/previz/optics";
import { bodyById } from "@/lib/viewfinder";
import { setupFromStill } from "@/components/previz/setup";
import { createSceneSetup, readScoutPhoto } from "@/app/(app)/projects/[id]/scene-actions";
import { deleteLocationStill, getStillUrl, linkStillToScene, updateStillNote } from "@/app/(app)/projects/[id]/still-actions";
import { actionError } from "@/lib/action-result";
import { useAiEnabled } from "@/components/ai/ai-availability";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/card";

export type StillView = {
  id: string;
  thumb: string | null;
  width: number | null;
  height: number | null;
  bodyId: string;
  focal: number;
  aspectId: string;
  tilt: number | null;
  roll: number | null;
  phoneCamera: string | null;
  note: string | null;
  sceneId: string | null;
  takenAt: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A JPEG data URL of the image, no wider than `max` on its long side. */
async function shrink(blob: Blob, max: number, q: number): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LocationStills({
  projectId,
  stills,
  canEdit,
  canReadRoom,
}: {
  projectId: string;
  stills: StillView[];
  canEdit: boolean;
  canReadRoom: boolean;
}) {
  const router = useRouter();
  const ai = useAiEnabled();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState("");

  const vf = `/projects/${projectId}/viewfinder`;

  const build = async (s: StillView) => {
    setBusy(s.id);
    try {
      setStep("Opening the still");
      const u = await getStillUrl(s.id);
      const uErr = actionError(u);
      if (uErr || !("url" in u)) throw new Error(uErr ?? "Could not open the still.");
      const blob = await (await fetch(u.url)).blob();
      const board = await shrink(blob, 1280, 0.8);

      const body = bodyById(s.bodyId);
      const ratio = ASPECTS.find((a) => a.id === s.aspectId)?.ratio ?? 16 / 9;
      const hfov = fovDeg(imagedArea(body, ratio).w, s.focal);

      let draft = null;
      if (ai && canReadRoom) {
        setStep("Reading the room from the still");
        const forReader = await shrink(blob, 1600, 0.85);
        const res = await readScoutPhoto({
          base64: forReader.split(",")[1] ?? "",
          mediaType: "image/jpeg",
          fileName: "location-still.jpg",
          lens: { ffFocal: ffEquivalent(hfov), hfovDeg: hfov, tiltDeg: s.tilt },
        });
        const err = actionError(res);
        if (err || !("draft" in res)) toast(`The room could not be read (${err ?? "no result"}), so a plain room stands in. The camera and lens are still exact.`, "info");
        else draft = res.draft;
      }

      setStep("Building the scene");
      const setup = setupFromStill({
        name: s.note?.slice(0, 60) || `Still, ${when(s.takenAt)}`,
        bodyId: s.bodyId,
        focal: s.focal,
        aspectId: s.aspectId,
        tiltDeg: s.tilt,
        board,
        draft,
      });
      const made = await createSceneSetup(projectId, setup);
      const mErr = actionError(made);
      if (mErr || !("id" in made)) throw new Error(mErr ?? "The scene could not be created.");
      await linkStillToScene(s.id, made.id);
      router.push(`/projects/${projectId}/scene-builder?setup=${made.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The scene could not be built.", "error");
      setBusy(null);
    }
  };

  const open = async (s: StillView) => {
    const u = await getStillUrl(s.id);
    const err = actionError(u);
    if (err || !("url" in u)) return toast(err ?? "Could not open the still.", "error");
    window.open(u.url, "_blank", "noopener");
  };

  const remove = async (s: StillView) => {
    const ok = await confirmAction({
      title: "Delete this still?",
      body: s.sceneId ? "The still is removed. The scene built from it stays." : "The still is removed for everyone on the project.",
      confirmLabel: "Delete still",
    });
    if (!ok) return;
    const res = await deleteLocationStill(s.id);
    const err = actionError(res);
    if (err) toast(err, "error");
    else router.refresh();
  };

  const saveNote = async (s: StillView, note: string) => {
    if ((s.note ?? "") === note.trim()) return;
    const err = actionError(await updateStillNote(s.id, note));
    if (err) toast(err, "error");
  };

  if (!stills.length) {
    return (
      <EmptyState
        hue="orange"
        title="No location stills yet"
        description="Open the viewfinder on your phone, pick the camera and lens, and frame the shot. Every still lands here with its lens, aspect and tilt."
        action={
          <Link href={vf} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
            Open the viewfinder
          </Link>
        }
        steps={[
          { title: "Calibrate once", text: "Measure two marks on a wall so the phone knows its own lens. About two minutes, once per phone." },
          { title: "Frame on location", text: "Pick the body and the lens. The phone shows that exact frame, with tilt and a level." },
          { title: "Build the scene", text: "On a computer, turn a still into a scene with the same camera, lens and tilt." },
        ]}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {stills.length} {stills.length === 1 ? "still" : "stills"}. Build a scene from one to block it out in 3D with the same lens.
        </p>
        <Link href={vf} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          Open the viewfinder
        </Link>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stills.map((s) => {
          const body = bodyById(s.bodyId);
          const asp = ASPECTS.find((a) => a.id === s.aspectId);
          return (
            <div key={s.id} className="overflow-hidden rounded-[14px] border border-border bg-surface">
              <button type="button" onClick={() => open(s)} className="relative block aspect-[3/2] w-full bg-[#111]" aria-label="Open the full still">
                {s.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-xs text-text-faint">No preview</span>
                )}
              </button>
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-text">
                  <span>{Math.round(s.focal)}mm</span>
                  <span className="text-text-faint">·</span>
                  <span>{body.name}</span>
                  <span className="text-text-faint">·</span>
                  <span>{asp?.label ?? s.aspectId}</span>
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {when(s.takenAt)}
                  {s.tilt !== null && ` · tilt ${Math.abs(s.tilt).toFixed(0)}° ${s.tilt < -0.5 ? "down" : s.tilt > 0.5 ? "up" : "level"}`}
                  {s.roll !== null && Math.abs(s.roll) >= 1 && ` · ${Math.abs(s.roll).toFixed(0)}° off level`}
                </div>
                {s.phoneCamera && <div className="mt-0.5 truncate text-[11px] text-text-faint">{s.phoneCamera}</div>}
                {canEdit ? (
                  <textarea
                    defaultValue={s.note ?? ""}
                    onBlur={(e) => saveNote(s, e.target.value)}
                    placeholder="Add a note (where, which wall, what for)"
                    rows={2}
                    className="mt-2 w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-faint"
                  />
                ) : (
                  s.note && <p className="mt-2 text-sm text-text">{s.note}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {s.sceneId ? (
                    <Link href={`/projects/${projectId}/scene-builder?setup=${s.sceneId}`} className="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-text">
                      Open its scene
                    </Link>
                  ) : canEdit ? (
                    <button type="button" disabled={busy !== null} onClick={() => build(s)} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-fg disabled:opacity-50">
                      {busy === s.id ? `${step}...` : "Build a scene"}
                    </button>
                  ) : null}
                  {canEdit && (
                    <button type="button" onClick={() => remove(s)} className="ml-auto rounded-lg px-2.5 py-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
