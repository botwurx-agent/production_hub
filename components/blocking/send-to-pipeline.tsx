"use client";

// Shot blocking: Send to pipeline. The blocking clip goes onto a pipeline shot
// as a MOTION reference (the video stage, where the Generate window offers it
// to Seedance as a video reference) and, ticked by default, the first frame
// goes onto the same shot's image stage as a reference, which is what gets
// "made real" into the start image. Nothing is generated here and nothing is
// spent: the pipeline is where takes are made.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { actionError } from "@/lib/action-result";
import { sendBlockingToPipeline } from "@/app/(app)/projects/[id]/blocking-actions";
import { Btn } from "./ui";

export type PipelineShot = { id: string; label: string };
export type PipelineTarget = {
  projectId: string;
  studioId: string;
  sceneId: string;
  shots: PipelineShot[];
  /** The shot this scene was last sent to, picked first. */
  linkedShotId: string | null;
  onLinked?: (shotId: string, shots: PipelineShot[]) => void;
};

type Phase = "idle" | "recording" | "uploading" | "saving" | "done";

export function SendToPipeline({
  target, sceneName, duration, size, fps, aspect, captureClip, captureFrame, onClose,
}: {
  target: PipelineTarget;
  sceneName: string;
  duration: number;
  size: { w: number; h: number };
  fps: number;
  aspect: string;
  captureClip: () => Promise<{ blob: Blob; mime: string; ext: string } | null>;
  captureFrame: () => Promise<Blob | null>;
  onClose: () => void;
}) {
  const linked = target.shots.some((s) => s.id === target.linkedShotId) ? target.linkedShotId : null;
  const [choice, setChoice] = useState<string>(linked ?? (target.shots.length ? target.shots[0].id : "new"));
  const [newTitle, setNewTitle] = useState(sceneName || "Blocked shot");
  const [withFrame, setWithFrame] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sent, setSent] = useState<{ shotId: string; label: string; replaced: number } | null>(null);
  const t0 = useRef(0);
  const busy = phase === "recording" || phase === "uploading" || phase === "saving";

  useEffect(() => {
    if (phase !== "recording") return;
    t0.current = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0.current) / 1000), 200);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [busy, onClose]);

  const send = async () => {
    setError(null);
    const stem = (sceneName || "blocking").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "blocking";
    try {
      const frameBlob = withFrame ? await captureFrame() : null;
      if (withFrame && !frameBlob) throw new Error("The first frame could not be drawn.");
      setPhase("recording");
      const clip = await captureClip();
      if (!clip) throw new Error("Nothing was recorded. Try again in Chrome.");
      setPhase("uploading");
      const up = await uploadAssetFile({
        studioId: target.studioId,
        projectId: target.projectId,
        file: new File([clip.blob], `${stem}_blocking.${clip.ext}`, { type: clip.mime }),
      });
      const frameUp = frameBlob
        ? await uploadAssetFile({
          studioId: target.studioId,
          projectId: target.projectId,
          file: new File([frameBlob], `${stem}_frame1.png`, { type: "image/png" }),
        })
        : null;
      setPhase("saving");
      const res = await sendBlockingToPipeline(target.projectId, target.sceneId, {
        shotId: choice === "new" ? null : choice,
        newTitle: choice === "new" ? newTitle : null,
        clipPath: up.storagePath,
        framePath: frameUp?.storagePath ?? null,
        seconds: duration,
        width: size.w,
        height: size.h,
        fps,
        aspect,
      });
      const err = actionError(res);
      if (err || !res || !("shotId" in res)) throw new Error(err ?? "The clip was uploaded but could not be put on the shot.");
      setSent({ shotId: res.shotId, label: res.label, replaced: res.replaced });
      target.onLinked?.(res.shotId, res.shots);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending failed.");
      setPhase("idle");
    }
  };

  const status =
    phase === "recording" ? `Recording the clip, ${Math.min(elapsed, duration).toFixed(1)} of ${duration.toFixed(1)} s. It plays through in real time.`
      : phase === "uploading" ? "Uploading the clip and the frame…"
        : phase === "saving" ? "Putting them on the shot…" : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Send to the pipeline"
        className="w-full max-w-[460px] rounded-[14px] border border-border bg-surface p-5 text-text shadow-2xl">
        {phase === "done" && sent ? (
          <>
            <h2 className="text-[16px] font-bold">On the pipeline</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              The blocking clip is on <span className="font-semibold text-text">{sent.label}</span> as a motion reference
              {withFrame ? ", and the first frame is in its References, ready to be made real into the start image" : ""}.
              {sent.replaced ? ` The earlier blocking from this scene was replaced.` : ""}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
              In the pipeline: generate a still from the frame and tag it Start, then Generate a take. Seedance gets the clip as its video reference.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={onClose}>Stay here</Btn>
              <Link href={`/projects/${target.projectId}/pipeline?shot=${sent.shotId}`}
                className="inline-flex h-7 items-center rounded-[6px] border border-accent bg-accent px-2.5 text-[11.5px] font-semibold text-accent-fg hover:brightness-110">
                Open the shot
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[16px] font-bold">Send to the pipeline</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
              Records the {duration.toFixed(1)} s blocking clip ({size.w} x {size.h}, {fps} fps) and puts it on a shot as the motion reference for the camera move.
            </p>

            <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Which shot</p>
            <div className="max-h-[220px] space-y-1 overflow-y-auto">
              {target.shots.map((s) => (
                <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-[8px] border px-2.5 py-2 text-[12.5px] ${choice === s.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"}`}>
                  <input type="radio" name="shot" checked={choice === s.id} onChange={() => setChoice(s.id)} disabled={busy} />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {s.id === target.linkedShotId && <span className="text-[10.5px] text-text-faint">sent before</span>}
                </label>
              ))}
              <label className={`flex cursor-pointer items-center gap-2 rounded-[8px] border px-2.5 py-2 text-[12.5px] ${choice === "new" ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"}`}>
                <input type="radio" name="shot" checked={choice === "new"} onChange={() => setChoice("new")} disabled={busy} />
                <span className="shrink-0">New shot</span>
                {choice === "new" && (
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} disabled={busy} maxLength={120}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 min-w-0 flex-1 rounded-[6px] border border-border bg-surface-2 px-2 text-[12px] text-text outline-none" placeholder="Shot title" />
                )}
              </label>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12.5px]">
              <input type="checkbox" className="mt-0.5" checked={withFrame} onChange={(e) => setWithFrame(e.target.checked)} disabled={busy} />
              <span>
                Also send the first frame
                <span className="block text-[11.5px] text-text-faint">Lands in the shot's References, to be made real into the start image.</span>
              </span>
            </label>

            {status && <p className="mt-3 text-[12px] text-text">{status}</p>}
            {error && <p className="mt-3 rounded-[8px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] text-text">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
              <Btn tone="primary" onClick={send} disabled={busy || (choice === "new" && !newTitle.trim())}>
                {busy ? "Sending…" : "Record and send"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
