"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { uploadAssetFile } from "@/components/projects/upload-file";
import {
  addGenerationsBulk,
  deleteGeneration,
  savePrompt,
  setGenerationRole,
  setGenerationStatus,
  setGenerationStarred,
} from "@/app/(app)/projects/[id]/pipeline-actions";
import type { AiGeneration, AiPrompt, AiShot } from "@/lib/database.types";

/**
 * Voiceover on a shot.
 *
 * A third stage beside image and video, and it sits on the SHOT rather than in
 * a project audio folder for one reason: the editor needs to know which read
 * goes with which clip. The handoff hands over 01_Paris-Cafe.mp4, and the VO
 * has to arrive as 01_Paris-Cafe.mp3 next to it, or whoever assembles the cut
 * is left pairing twenty clips against twenty files by ear.
 *
 * Deliberately leaner than StagePanel. No references, no prompt library, no
 * start/end roles: a read has a line, a voice and a take you pick. What it does
 * share is the generation row itself, so provenance, cost, reject and star all
 * work here without a second implementation.
 *
 * Many reads per shot, and none is fine. A single line often runs across three
 * shots and plenty of shots carry no VO at all, so nothing here assumes one
 * file per shot even though that is the common case.
 */

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

/** The platforms a studio actually generates a read on. Free text, so not a wall. */
const VOICE_PLATFORMS = ["ElevenLabs", "Higgsfield", "OpenAI", "PlayHT", "Resemble", "Recorded"];

function secs(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function AudioPanel({
  projectId,
  studioId,
  shot,
  prompt,
  gens,
  media,
  onRun,
}: {
  projectId: string;
  studioId: string;
  shot: AiShot;
  prompt: AiPrompt | null;
  gens: AiGeneration[];
  media: Record<string, string>;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [line, setLine] = useState(prompt?.text ?? "");
  const [voice, setVoice] = useState(prompt?.target_model ?? "");
  const [platform, setPlatform] = useState("");
  const [progress, setProgress] = useState<string | null>(null);

  const pool = gens.filter((g) => g.status !== "reference");
  const kept = pool.filter((g) => g.status !== "rejected");
  const picked = pool.find((g) => g.role === "take") ?? null;

  async function addFiles(list: FileList | null) {
    // Copied to an array BEFORE the input is cleared: a FileList is a live view
    // of the input's selection, so reading it later gives nothing.
    const files = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;

    const wrong = files.filter((f) => !f.type.startsWith("audio/"));
    if (wrong.length) {
      toast(
        `${wrong.length === 1 ? "That file is" : "Those files are"} not audio.`,
        "error"
      );
      return;
    }

    const paths: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading ${i + 1} of ${files.length}...`);
        // Direct to storage through a server-minted signed URL, so twenty reads
        // are not bounded by the serverless request body the way a Server
        // Action upload would be.
        const up = await uploadAssetFile({ studioId, projectId, file: files[i] });
        paths.push(up.storagePath);
      }
    } catch (e) {
      setProgress(null);
      toast(`Upload failed: ${(e as Error).message}`, "error");
      return;
    }

    setProgress("Saving...");
    const res = await addGenerationsBulk(projectId, {
      shotId: shot.id,
      stage: "audio",
      prompt: line || null,
      filePaths: paths,
      platform: platform || null,
      model: voice || null,
    });
    setProgress(null);
    if (res?.error) {
      toast(res.error, "error");
      return;
    }
    toast(`Added ${files.length} read${files.length === 1 ? "" : "s"}.`, "success");
    router.refresh();
  }

  return (
    <div
      className="rounded-[14px] border border-border p-4"
      style={{ borderTop: "3px solid var(--h-purple)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-[8px] text-sm"
          style={{ background: "var(--h-purple-bg)", color: "var(--h-purple)" }}
        >
          ♪
        </span>
        <h4 className="text-sm font-bold text-text">Voiceover</h4>
        <span className="text-xs text-text-faint">
          {kept.length} kept · {pool.length} total
          {picked ? " · take picked" : ""}
        </span>
      </div>

      {/* The line, which is both the record of what was read and what gets
          pasted into the generator next time. */}
      <div className="mb-3 space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          Line{" "}
          <span className="font-normal normal-case text-text-faint">
            · what is said over this shot
          </span>
        </label>
        <textarea
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onBlur={() => {
            savePrompt(projectId, shot.id, "audio", { text: line }).then(() =>
              router.refresh()
            );
          }}
          rows={2}
          placeholder="Science-backed. Clinically proven."
          className={field}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            onBlur={() => {
              savePrompt(projectId, shot.id, "audio", {
                target_model: voice || null,
              }).then(() => router.refresh());
            }}
            placeholder="Voice (e.g. Rachel, or a voice id)"
            className={field}
          />
          <input
            list="vo-platforms"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Generated on (optional)"
            className={field}
          />
          <datalist id="vo-platforms">
            {VOICE_PLATFORMS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Reads */}
      <div className="space-y-2">
        {pool.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-text-faint">
            No reads yet. Generate the voiceover on your own tool, then add the
            files here so they travel with the shot.
          </p>
        )}

        {pool.map((g, i) => {
          const src = media[g.id] ?? g.external_url ?? null;
          const rejected = g.status === "rejected";
          const isPick = g.role === "take";
          return (
            <div
              key={g.id}
              className={`rounded-[11px] border p-3 transition ${
                isPick
                  ? "border-transparent bg-accent-soft"
                  : rejected
                    ? "border-border opacity-50"
                    : "border-border"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-text">
                  Read {i + 1}
                </span>
                {isPick && (
                  <span className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-fg">
                    Take
                  </span>
                )}
                {g.starred && <span className="text-xs text-amber">★</span>}
                {g.model && (
                  <span className="text-[11px] text-text-muted">{g.model}</span>
                )}
                {g.platform && (
                  <span className="text-[11px] text-text-faint">
                    {g.platform}
                  </span>
                )}
                {g.duration_sec != null && (
                  <span className="text-[11px] text-text-faint">
                    {secs(Number(g.duration_sec))}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() =>
                      onRun(() =>
                        setGenerationRole(
                          projectId,
                          shot.id,
                          g.id,
                          isPick ? null : "take"
                        )
                      )
                    }
                    className={`rounded-[8px] px-2 py-1 text-[11px] font-semibold transition ${
                      isPick
                        ? "bg-accent text-accent-fg"
                        : "border border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {isPick ? "Picked" : "Pick"}
                  </button>
                  <button
                    onClick={() =>
                      onRun(() =>
                        setGenerationStarred(projectId, g.id, !g.starred)
                      )
                    }
                    title="Shortlist"
                    className="px-1.5 text-[13px] text-text-faint transition hover:text-amber"
                  >
                    ★
                  </button>
                  <button
                    onClick={() =>
                      onRun(() =>
                        setGenerationStatus(
                          projectId,
                          g.id,
                          rejected ? "candidate" : "rejected"
                        )
                      )
                    }
                    className="rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:text-text"
                  >
                    {rejected ? "Restore" : "Reject"}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: "Delete this read?",
                        body: "The audio file is removed from this shot. This cannot be undone.",
                      });
                      if (ok) onRun(() => deleteGeneration(projectId, g.id));
                    }}
                    aria-label="Delete read"
                    className="px-1.5 text-text-faint transition hover:text-red"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {src ? (
                <audio src={src} controls preload="none" className="w-full" />
              ) : (
                <p className="text-[11.5px] text-text-faint">
                  No playable file on this read.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={progress !== null}
          className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50"
        >
          + Add reads
        </button>
        {progress && (
          <span className="text-[11.5px] text-text-faint">{progress}</span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
