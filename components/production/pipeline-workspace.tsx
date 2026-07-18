"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusTag, type Hue } from "@/components/status-tag";
import { uploadAssetFile } from "@/components/projects/upload-file";
import {
  addShot,
  updateShot,
  deleteShot,
  reorderShots,
  savePrompt,
  addGeneration,
  addGenerationsBulk,
  updateGeneration,
  setGenerationStatus,
  setGenerationRole,
  deleteGeneration,
  importFromHiggsfield,
  inspectMediaLink,
} from "@/app/(app)/projects/[id]/pipeline-actions";
import { sendDocToReview } from "@/app/(app)/projects/[id]/doc-review-actions";
import { ScriptEditor } from "@/components/production/script-editor";
import { TriageView } from "@/components/production/triage-view";
import { LibraryButton, LibraryBar } from "@/components/production/prompt-library";
import type { AiScript, AiShot, AiPrompt, AiGeneration, AiPromptLibraryEntry } from "@/lib/database.types";

type Stage = "image" | "video";

const IMAGE_MODELS = ["Nano Banana 2 Pro", "Midjourney v7", "Flux 1.1", "Seedream 3", "Ideogram 2"];
const VIDEO_MODELS = ["Seedance 2.0", "Kling 2.1", "Veo 3", "Runway Gen-4", "Sora", "Hailuo", "Pika 2"];

const STAGE_HUE: Record<string, Hue> = {
  script: "cyan", image: "yellow", video: "blue", post: "purple", delivered: "green",
};
const ROLE_TAG: Record<string, { t: string; c: string }> = {
  start: { t: "START", c: "var(--h-cyan)" }, end: { t: "END", c: "var(--h-pink)" },
  take: { t: "TAKE", c: "var(--h-green)" }, final: { t: "FINAL", c: "var(--h-green)" },
};

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

function gradFor(id: string) {
  const hues = ["#f59e0b,#b45309", "#6366f1,#a21caf", "#0ea5e9,#164e63", "#10b981,#064e3b", "#f43f5e,#7f1d1d", "#8b5cf6,#4338ca"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % hues.length;
  return `linear-gradient(135deg, ${hues[h]})`;
}

// ---- Add-generation modal (captures the spec/provenance) --------------------

function AddGenModal({
  projectId,
  studioId,
  shot,
  stage,
  promptId,
  basePrompt,
  refStartId,
  refEndId,
  onClose,
}: {
  projectId: string;
  studioId: string;
  shot: AiShot;
  stage: Stage;
  promptId: string | null;
  basePrompt: string;
  refStartId: string | null;
  refEndId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [promptText, setPromptText] = useState(basePrompt);
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectMsg, setInspectMsg] = useState<string | null>(null);
  const [f, setF] = useState({
    external_url: "", platform: "", model: "", model_version: "", seed: "",
    aspect: stage === "image" ? "16:9" : "", resolution: "", fps: "", duration_sec: "",
    guidance: "", cost: "", notes: "", generated_by_name: "",
  });
  function set(k: keyof typeof f, v: string) { setF((p) => ({ ...p, [k]: v })); }

  // Auto-fill provenance we can derive from the pasted link: platform (from the
  // host), aspect/resolution/duration (from the real media), prompt (from the
  // page). Model/seed stay manual (no platform exposes them via a share link).
  async function autofill() {
    const url = f.external_url.trim();
    if (!url) { setInspectMsg("Paste a link above first."); return; }
    setInspecting(true); setInspectMsg(null);
    try {
      const res = await inspectMediaLink(url);
      if ("error" in res) { setInspectMsg(res.error); return; }
      setF((p) => ({
        ...p,
        platform: p.platform || res.platform || "",
        aspect: res.aspect || p.aspect,
        resolution: res.resolution || p.resolution,
        duration_sec: res.duration_sec != null ? String(res.duration_sec) : p.duration_sec,
      }));
      if (res.prompt && !promptText.trim()) setPromptText(res.prompt);
      const bits = [res.platform, res.aspect, res.resolution].filter(Boolean).length;
      setInspectMsg(bits > 0 ? "Filled what we could from the link ✓" : "Reached the link, but nothing to auto-fill.");
    } finally {
      setInspecting(false);
    }
  }

  const sharedSpec = () => ({
    platform: f.platform || null,
    model: f.model || null,
    model_version: f.model_version || null,
    seed: f.seed || null,
    aspect: f.aspect || null,
    resolution: f.resolution || null,
    fps: f.fps ? Number(f.fps) : null,
    duration_sec: f.duration_sec ? Number(f.duration_sec) : null,
    guidance: f.guidance ? Number(f.guidance) : null,
    cost: f.cost ? Number(f.cost) : null,
    params: f.notes ? { notes: f.notes } : null,
    generated_by_name: f.generated_by_name || null,
  });

  function submit() {
    setErr(null);
    start(async () => {
      // Bulk path: many files, each becomes a candidate sharing the spec.
      if (files.length > 0) {
        const paths: string[] = [];
        try {
          for (let i = 0; i < files.length; i++) {
            setProg(`Uploading ${i + 1}/${files.length}…`);
            const up = await uploadAssetFile({ studioId, projectId, file: files[i] });
            paths.push(up.storagePath);
          }
        } catch (e) {
          setErr(`Upload failed: ${(e as Error).message}`);
          setProg(null);
          return;
        }
        setProg("Saving…");
        const res = await addGenerationsBulk(projectId, {
          shotId: shot.id,
          stage,
          promptId,
          prompt: promptText || null,
          filePaths: paths,
          parent_start_id: stage === "video" ? refStartId : null,
          parent_end_id: stage === "video" ? refEndId : null,
          ...sharedSpec(),
        });
        setProg(null);
        if (res?.error) { setErr(res.error); return; }
        onClose();
        router.refresh();
        return;
      }
      // Single URL path.
      await addGeneration(projectId, {
        shotId: shot.id,
        stage,
        promptId,
        prompt: promptText || null,
        external_url: f.external_url || null,
        platform: f.platform || null,
        model: f.model || null,
        model_version: f.model_version || null,
        seed: f.seed || null,
        aspect: f.aspect || null,
        resolution: f.resolution || null,
        fps: f.fps ? Number(f.fps) : null,
        duration_sec: f.duration_sec ? Number(f.duration_sec) : null,
        guidance: f.guidance ? Number(f.guidance) : null,
        cost: f.cost ? Number(f.cost) : null,
        params: f.notes ? { notes: f.notes } : null,
        parent_start_id: stage === "video" ? refStartId : null,
        parent_end_id: stage === "video" ? refEndId : null,
        generated_by_name: f.generated_by_name || null,
      });
      onClose();
      router.refresh();
    });
  }

  const models = stage === "image" ? IMAGE_MODELS : VIDEO_MODELS;

  return (
    <Modal open onClose={onClose} size="lg" title={stage === "image" ? "Add image candidate" : "Add video take"}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Upload {stage === "image" ? "image" : "video"} files <span className="font-normal normal-case text-text-faint">(pick one or many · recommended)</span>
          </label>
          <input type="file" multiple accept={stage === "image" ? "image/*" : "video/*,image/*"}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm text-text-muted file:mr-3 file:rounded-[8px] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent-fg" />
          {files.length > 0 && (
            <p className="mt-1 text-xs text-text-faint">
              {files.length} file{files.length === 1 ? "" : "s"} selected · the spec below applies to all of them
            </p>
          )}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            …or a direct file URL <span className="font-normal normal-case text-text-faint">(must end in .png/.jpg/.mp4 — a share page won&apos;t preview)</span>
          </label>
          <input value={f.external_url} onChange={(e) => set("external_url", e.target.value)}
            placeholder="https://…/image.png" className={`mt-1 ${field}`} />
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" onClick={autofill} disabled={inspecting || !f.external_url.trim()}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-bold text-text transition hover:border-accent hover:text-accent disabled:opacity-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
              </svg>
              {inspecting ? "Reading…" : "Auto-fill from link"}
            </button>
            {inspectMsg && <span className="text-[11px] font-medium text-text-muted">{inspectMsg}</span>}
          </div>
        </div>
        {stage === "video" && (refStartId || refEndId) && (
          <p className="rounded-[9px] bg-cyan-bg px-3 py-1.5 text-xs font-medium" style={{ color: "var(--h-cyan)" }}>
            Linked to this shot&apos;s approved START + END frames automatically.
          </p>
        )}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Prompt used <span className="font-normal normal-case text-text-faint">(applies to {files.length > 1 ? `all ${files.length}` : "this"} — tweak it per batch)</span>
          </label>
          <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={3}
            placeholder="The exact prompt used to generate these…" className={`mt-1 ${field}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Platform</label>
            <input value={f.platform} onChange={(e) => set("platform", e.target.value)} placeholder="e.g. fal, Krea" className={`mt-1 ${field}`} /></div>
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Model</label>
            <input list="modellist" value={f.model} onChange={(e) => set("model", e.target.value)} placeholder={models[0]} className={`mt-1 ${field}`} />
            <datalist id="modellist">{models.map((m) => <option key={m} value={m} />)}</datalist></div>
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Version</label>
            <input value={f.model_version} onChange={(e) => set("model_version", e.target.value)} className={`mt-1 ${field}`} /></div>
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Seed</label>
            <input value={f.seed} onChange={(e) => set("seed", e.target.value)} className={`mt-1 ${field}`} /></div>
          {stage === "image" ? (
            <>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Aspect</label>
                <input value={f.aspect} onChange={(e) => set("aspect", e.target.value)} placeholder="16:9" className={`mt-1 ${field}`} /></div>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Resolution</label>
                <input value={f.resolution} onChange={(e) => set("resolution", e.target.value)} placeholder="2048²" className={`mt-1 ${field}`} /></div>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Guidance</label>
                <input value={f.guidance} onChange={(e) => set("guidance", e.target.value)} className={`mt-1 ${field}`} /></div>
            </>
          ) : (
            <>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Duration (s)</label>
                <input value={f.duration_sec} onChange={(e) => set("duration_sec", e.target.value)} placeholder="5" className={`mt-1 ${field}`} /></div>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">FPS</label>
                <input value={f.fps} onChange={(e) => set("fps", e.target.value)} placeholder="24" className={`mt-1 ${field}`} /></div>
              <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Resolution</label>
                <input value={f.resolution} onChange={(e) => set("resolution", e.target.value)} placeholder="1080p" className={`mt-1 ${field}`} /></div>
            </>
          )}
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Cost</label>
            <input value={f.cost} onChange={(e) => set("cost", e.target.value)} placeholder="credits / $" className={`mt-1 ${field}`} /></div>
          <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Generated by</label>
            <input value={f.generated_by_name} onChange={(e) => set("generated_by_name", e.target.value)} placeholder="name (optional)" className={`mt-1 ${field}`} /></div>
        </div>
        <div><label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Notes / extra params</label>
          <input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="negative prompt, LoRA, camera, round…" className={`mt-1 ${field}`} /></div>
        {err && <p className="rounded-[9px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{err}</p>}
        <div className="flex items-center justify-end gap-3 pt-1">
          {busy && prog && <span className="mr-auto text-xs font-medium text-text-muted">{prog}</span>}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? "Working…" : files.length > 1 ? `Add ${files.length} candidates` : "Add"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Shared bits ------------------------------------------------------------

type SpecRow = [string, string | number | null | undefined];
function genSpecRows(gen: AiGeneration): SpecRow[] {
  return [
    ["Platform", gen.platform],
    ["Model", [gen.model, gen.model_version].filter(Boolean).join(" ") || null],
    ["Seed", gen.seed],
    ["Aspect", gen.aspect],
    ["Resolution", gen.resolution],
    ["FPS", gen.fps],
    ["Duration", gen.duration_sec ? `${gen.duration_sec}s` : null],
    ["Guidance", gen.guidance],
    ["Cost", gen.cost],
    ["Refs", gen.parent_start_id ? "start → end" : null],
    ["Generated by", gen.generated_by_name],
    ["Notes", (gen.params as { notes?: string } | null)?.notes ?? null],
  ];
}

// Subtle pipeline connector between stages.
function Flow({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-text-faint">
      <span aria-hidden className="text-base leading-none">↓</span>
      {label && <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>}
    </div>
  );
}

// A large, labeled frame slot for the locked Start / End (image) or Take (video).
function FrameSlot({ label, color, gen, src, empty, video }: {
  label: string; color: string; gen: AiGeneration | null; src: string | null; empty: string; video?: boolean;
}) {
  const isVideo = video || gen?.kind === "video";
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color }}>{label}</div>
      {gen ? (
        <div className="relative overflow-hidden rounded-[10px]" style={{ aspectRatio: "16/9", outline: `2px solid ${color}`, outlineOffset: "2px", background: gradFor(gen.id) }}>
          {src && (isVideo ? (
            <video src={src} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ))}
          {isVideo && !src && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-sm text-black">▶</span>
            </span>
          )}
          {gen.model && (
            <span className="absolute right-1.5 top-1.5 rounded-[5px] bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold text-white">{gen.model}</span>
          )}
        </div>
      ) : (
        <div className="grid place-items-center rounded-[10px] border-2 border-dashed border-border px-2 text-center text-[11px] text-text-faint" style={{ aspectRatio: "16/9" }}>
          {empty}
        </div>
      )}
    </div>
  );
}

// ---- Generation card --------------------------------------------------------

function GenCard({
  projectId, shot, gen, src, onRun,
}: {
  projectId: string; shot: AiShot; gen: AiGeneration; src: string | null;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const [spec, setSpec] = useState(false);
  const [open, setOpen] = useState(false);
  const isImage = gen.stage === "image";
  const isVideo = gen.kind === "video";
  const roleTag = gen.role ? ROLE_TAG[gen.role] ?? null : null;
  const rows = genSpecRows(gen).filter(([, v]) => v != null && v !== "");
  const openHref = gen.external_url ?? src;

  return (
    <div className={`overflow-hidden rounded-[12px] border border-border ${gen.status === "rejected" ? "opacity-45" : ""}`}>
      <button type="button" onClick={() => setOpen(true)}
        className="group relative block w-full" style={{ aspectRatio: "16/9", background: gradFor(gen.id) }}>
        {src && (isVideo ? (
          <video src={`${src}#t=0.1`} muted playsInline preload="metadata"
            className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ))}
        {isVideo && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-sm text-white transition group-hover:bg-black/70">▶</span>
          </span>
        )}
        {gen.model && (
          <span className="absolute right-1.5 top-1.5 rounded-[5px] bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
            {gen.model}
          </span>
        )}
        {roleTag && (
          <span className="absolute left-1.5 top-1.5 rounded-[5px] px-1.5 py-0.5 text-[9px] font-extrabold text-black" style={{ background: roleTag.c }}>
            {roleTag.t}
          </span>
        )}
        {gen.status === "approved" && !roleTag && (
          <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-green px-1.5 py-0.5 text-[9px] font-extrabold text-white">✓</span>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100">
          ⤢ Open
        </span>
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} size="xl"
          title={`${isImage ? "Image" : "Take"}${gen.model ? ` · ${gen.model}` : ""}`}>
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-[12px] bg-black" style={{ aspectRatio: "16/9" }}>
              {src ? (
                isVideo ? (
                  <video src={src} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
                )
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/70">
                  No previewable media. Upload the file, or paste a direct image URL (a share page can&apos;t be shown).
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {openHref && (
                <a href={openHref} target="_blank" rel="noreferrer"
                  className="rounded-[9px] border border-border-strong px-3 py-1.5 text-xs font-bold text-text transition hover:border-accent hover:text-accent">
                  Open original ↗
                </a>
              )}
              {roleTag && (
                <span className="rounded-[7px] px-2 py-1 text-[11px] font-extrabold text-black" style={{ background: roleTag.c }}>{roleTag.t}</span>
              )}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">Prompt used</div>
              <textarea defaultValue={gen.prompt ?? ""} rows={3}
                onBlur={(e) => onRun(() => updateGeneration(projectId, gen.id, { prompt: e.target.value || null }))}
                placeholder="The exact prompt for this generation…"
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong" />
            </div>
            {rows.length > 0 && (
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-dashed border-border py-1 text-[12.5px]">
                    <span className="text-text-faint">{k}</span>
                    <span className="font-semibold">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      <div className="flex flex-wrap items-center gap-1 p-1.5">
        {isImage ? (
          <>
            <button onClick={() => onRun(() => setGenerationRole(projectId, shot.id, gen.id, gen.role === "start" ? null : "start"))}
              className="rounded-[6px] px-2 py-1 text-[11px] font-bold" style={{ background: "var(--h-cyan-bg)", color: "var(--h-cyan)" }}>Start</button>
            <button onClick={() => onRun(() => setGenerationRole(projectId, shot.id, gen.id, gen.role === "end" ? null : "end"))}
              className="rounded-[6px] px-2 py-1 text-[11px] font-bold" style={{ background: "var(--h-pink-bg)", color: "var(--h-pink)" }}>End</button>
          </>
        ) : (
          <button onClick={() => onRun(() => setGenerationRole(projectId, shot.id, gen.id, gen.role === "take" ? null : "take"))}
            className="rounded-[6px] px-2 py-1 text-[11px] font-bold" style={{ background: "var(--h-green-bg)", color: "var(--h-green)" }}>Pick take</button>
        )}
        <button onClick={() => onRun(() => setGenerationStatus(projectId, gen.id, gen.status === "rejected" ? "candidate" : "rejected"))}
          className="rounded-[6px] px-2 py-1 text-[11px] font-semibold text-text-faint hover:text-red">
          {gen.status === "rejected" ? "Restore" : "Reject"}
        </button>
        <button onClick={() => setSpec((s) => !s)} className="ml-auto rounded-[6px] px-2 py-1 text-[11px] font-semibold text-text-muted hover:text-text">
          Spec
        </button>
      </div>
      {spec && (
        <div className="border-t border-border px-2.5 py-2 text-[11.5px]">
          {gen.prompt && (
            <p className="mb-1.5 border-b border-dashed border-border pb-1.5 italic text-text-muted">&ldquo;{gen.prompt}&rdquo;</p>
          )}
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-border py-0.5 last:border-0">
              <span className="text-text-faint">{k}</span>
              <span className="font-semibold tabular-nums">{String(v)}</span>
            </div>
          ))}
          <button onClick={() => onRun(() => deleteGeneration(projectId, gen.id))} className="mt-1 text-[11px] font-semibold text-red hover:underline">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Stage panel (image or video) ------------------------------------------

// ---- References (v2v inputs): driving / style / character clips -------------

// Reference roles differ by stage: images generate FROM characters / styles /
// elements; video can additionally be driven by a motion clip (v2v).
const REF_ROLES: Record<Stage, { value: string; label: string }[]> = {
  image: [
    { value: "character", label: "Character reference" },
    { value: "style", label: "Style reference" },
    { value: "element", label: "Element / object" },
    { value: "ref", label: "Reference" },
  ],
  video: [
    { value: "motion", label: "Driving / motion video" },
    { value: "style", label: "Style reference" },
    { value: "character", label: "Character reference" },
    { value: "ref", label: "Reference" },
  ],
};

function AddRefModal({
  projectId, studioId, shot, stage, onClose,
}: {
  projectId: string; studioId: string; shot: AiShot; stage: Stage; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const roles = REF_ROLES[stage];
  const [role, setRole] = useState(roles[0].value);
  const [kind, setKind] = useState<"video" | "image">(stage === "image" ? "image" : "video");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<string | null>(null);

  function save() {
    setErr(null);
    if (!file && !url.trim()) { setErr("Upload a clip or paste a link."); return; }
    start(async () => {
      let filePath: string | null = null;
      if (file) {
        try {
          setProg("Uploading…");
          const up = await uploadAssetFile({ studioId, projectId, file });
          filePath = up.storagePath;
        } catch (e) {
          setErr(`Upload failed: ${(e as Error).message}`); setProg(null); return;
        }
      }
      setProg("Saving…");
      const res = await addGeneration(projectId, {
        shotId: shot.id, stage, status: "reference", role, kind,
        file_path: filePath, external_url: filePath ? null : (url.trim() || null),
      });
      setProg(null);
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} size="md" title="Add a reference">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          {stage === "image"
            ? "A character, style, or element this shot's images are generated from. Tracked with its own lineage."
            : "A clip this shot generates from (video-to-video): a driving/style/character reference. Tracked with its own lineage."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`mt-1 ${field}`}>
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as "video" | "image")} className={`mt-1 ${field}`}>
              <option value="video">Video</option>
              <option value="image">Image</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Upload a clip</label>
          <input type="file" accept="video/*,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            or paste a link <span className="font-normal normal-case text-text-faint">(from the tool it lives on)</span>
          </label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={`mt-1 ${field}`} />
        </div>
        {err && <p className="text-xs font-semibold text-red">{err}</p>}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={busy}>{prog ?? "Add reference"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReferencesPanel({
  projectId, studioId, shot, stage, refs, media, onRun,
}: {
  projectId: string; studioId: string; shot: AiShot; stage: Stage;
  refs: AiGeneration[]; media: Record<string, string>;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const srcOf = (g: AiGeneration) => media[g.id] ?? g.external_url ?? null;
  return (
    <div className="mb-3 rounded-[12px] border border-dashed border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          References{" "}
          <span className="font-normal normal-case text-text-faint">
            {stage === "image"
              ? "— characters, styles & elements used in these images"
              : "— what this shot generates from (v2v)"}
          </span>
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>+ Reference</Button>
      </div>
      {refs.length === 0 ? (
        <p className="text-xs text-text-faint">
          {stage === "image"
            ? "None yet. Add a character, style, or element reference for this shot."
            : "None yet. Add a driving/style/character clip for video-to-video."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {refs.map((g) => {
            const src = srcOf(g);
            return (
              <div key={g.id} className="overflow-hidden rounded-[10px] border border-border">
                <div className="relative" style={{ aspectRatio: "16/9", background: gradFor(g.id) }}>
                  {src && (g.kind === "video"
                    ? <video src={src} muted className="absolute inset-0 h-full w-full object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
                  <span className="absolute left-1 top-1 rounded-[4px] bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">
                    {g.role || "ref"}
                  </span>
                  <button onClick={() => onRun(() => deleteGeneration(projectId, g.id))}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white transition hover:bg-red"
                    title="Remove reference" aria-label="Remove reference">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {adding && <AddRefModal projectId={projectId} studioId={studioId} shot={shot} stage={stage} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ---- Import from an external tool (Higgsfield, etc.) ------------------------
// Paste the pool of clips you generated elsewhere; each link is fetched, stored,
// and dropped in as a candidate here so you can view + review + pick without the
// download / re-upload round trip. Generation stays on the external tool.

function ImportModal({
  projectId, shot, stage, basePrompt, onClose, onDone,
}: {
  projectId: string; shot: AiShot; stage: Stage; basePrompt: string;
  onClose: () => void; onDone: () => void;
}) {
  const [busy, start] = useTransition();
  const [urlsText, setUrlsText] = useState("");
  const [platform, setPlatform] = useState("Higgsfield");
  const [promptText, setPromptText] = useState(basePrompt);
  const [by, setBy] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ url: string; reason: string }[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const links = useMemo(
    () => Array.from(new Set(urlsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))),
    [urlsText],
  );

  function submit() {
    setErr(null);
    setFailed(null);
    setDone(null);
    if (links.length === 0) { setErr("Paste at least one link."); return; }
    start(async () => {
      const res = await importFromHiggsfield(projectId, {
        shotId: shot.id,
        stage,
        urls: links,
        prompt: promptText || null,
        platform: platform || null,
        generated_by_name: by || null,
      });
      if ("error" in res) { setErr(res.error); return; }
      setDone(res.imported);
      if (res.failed.length > 0) {
        // Keep the ones that failed in the box so they can be retried.
        setFailed(res.failed);
        setUrlsText(res.failed.map((f) => f.url).join("\n"));
        onDone();
        return;
      }
      onDone();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Import from Higgsfield">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Paste the links to the clips you generated (one per line — a share link or a
          direct video URL). We pull each one in as a candidate on this shot, with its
          source tracked, so you can review the pool and pick the winner here. No download
          or re-upload. Generation stays on the tool.
        </p>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Links <span className="font-normal normal-case text-text-faint">(one per line · up to 40)</span>
          </label>
          <textarea value={urlsText} onChange={(e) => setUrlsText(e.target.value)} rows={6}
            placeholder={"https://higgsfield.ai/…\nhttps://…/clip.mp4"} className={`mt-1 ${field} font-mono text-xs`} />
          {links.length > 0 && (
            <p className="mt-1 text-xs text-text-faint">{links.length} link{links.length === 1 ? "" : "s"} ready</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Tool / platform</label>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Higgsfield" className={`mt-1 ${field}`} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Generated by</label>
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="name (optional)" className={`mt-1 ${field}`} />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Prompt used <span className="font-normal normal-case text-text-faint">(optional · applied to all imported)</span>
          </label>
          <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={2}
            placeholder="The prompt behind these clips…" className={`mt-1 ${field}`} />
        </div>
        {done != null && (
          <p className="rounded-[9px] bg-green-bg px-3 py-2 text-sm font-semibold text-green">
            Imported {done} clip{done === 1 ? "" : "s"}.{failed && failed.length > 0 ? ` ${failed.length} still need attention below.` : ""}
          </p>
        )}
        {failed && failed.length > 0 && (
          <div className="rounded-[9px] border border-border bg-surface-2/40 p-2.5 text-xs">
            <p className="mb-1 font-bold text-text-muted">Couldn&apos;t import these — check the link and retry:</p>
            <ul className="space-y-1">
              {failed.map((f) => (
                <li key={f.url} className="flex flex-col">
                  <span className="truncate font-mono text-[11px] text-text">{f.url}</span>
                  <span className="text-red">{f.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {err && <p className="rounded-[9px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{err}</p>}
        <div className="flex items-center justify-end gap-3 pt-1">
          {busy && <span className="mr-auto text-xs font-medium text-text-muted">Pulling {links.length} clip{links.length === 1 ? "" : "s"}…</span>}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>{done != null ? "Close" : "Cancel"}</Button>
          <Button size="sm" onClick={submit} disabled={busy || links.length === 0}>
            {busy ? "Importing…" : failed ? "Retry these" : `Import ${links.length || ""}`.trim()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StagePanel({
  projectId, studioId, shot, stage, prompt, gens, media, library, refStartId, refEndId, onRun,
}: {
  projectId: string; studioId: string; shot: AiShot; stage: Stage;
  prompt: AiPrompt | null; gens: AiGeneration[]; media: Record<string, string>;
  library: AiPromptLibraryEntry[];
  refStartId: string | null; refEndId: string | null;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const router = useRouter();
  const [pText, setPText] = useState(prompt?.text ?? "");
  const [pModel, setPModel] = useState(prompt?.target_model ?? "");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const models = stage === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const label = stage === "image" ? "Image" : "Video";
  const hue = stage === "image" ? "amber" : "blue";
  // Reference inputs (characters/styles/elements for images; driving/style/
  // character clips for v2v) live alongside the pool but are kept out of the
  // candidate/take grid. Both stages support them.
  const refs = gens.filter((g) => g.status === "reference");
  const pool = gens.filter((g) => g.status !== "reference");
  const kept = pool.filter((g) => g.status !== "rejected").length;
  const start = stage === "image" ? pool.find((g) => g.role === "start") ?? null : null;
  const end = stage === "image" ? pool.find((g) => g.role === "end") ?? null : null;
  const take = stage === "video" ? pool.find((g) => g.role === "take" || g.role === "final") ?? null : null;
  const srcOf = (g: AiGeneration | null) => (g ? media[g.id] ?? g.external_url ?? null : null);

  return (
    <div className="rounded-[14px] border border-border p-4" style={{ borderTop: `3px solid var(--h-${hue})` }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] text-sm" style={{ background: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}>
          {stage === "image" ? "◨" : "▶"}
        </span>
        <h4 className="text-sm font-bold text-text">{label} stage</h4>
        <span className="text-xs text-text-faint">{kept} kept · {pool.length} total</span>
      </div>

      <ReferencesPanel projectId={projectId} studioId={studioId} shot={shot} stage={stage} refs={refs} media={media} onRun={onRun} />


      <div className="mb-3 space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          Working prompt <span className="font-normal normal-case text-text-faint">· pre-fills each new batch; the exact prompt is saved on every generation</span>
        </label>
        <textarea value={pText} onChange={(e) => setPText(e.target.value)}
          onBlur={() => savePrompt(projectId, shot.id, stage, { text: pText })}
          rows={2} placeholder={`Base ${label.toLowerCase()} prompt…`} className={field} />
        <LibraryBar
          projectId={projectId}
          stage={stage}
          entries={library}
          currentPrompt={pText}
          onInsert={(text) => { setPText(text); savePrompt(projectId, shot.id, stage, { text }); }}
          onAppend={(text) => {
            const next = pText.trim() ? `${pText.trim()}\n\n${text}` : text;
            setPText(next);
            savePrompt(projectId, shot.id, stage, { text: next });
          }}
        />
        <input list={`m-${stage}`} value={pModel} onChange={(e) => setPModel(e.target.value)}
          onBlur={() => savePrompt(projectId, shot.id, stage, { target_model: pModel || null })}
          placeholder={`Default model (${models[0]})`} className={field} />
        <datalist id={`m-${stage}`}>{models.map((m) => <option key={m} value={m} />)}</datalist>
      </div>

      {/* Candidate pool first: generate & triage */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">{stage === "image" ? "Candidates — tag a Start + End" : "Takes — pick one"}</p>
        <div className="flex items-center gap-2">
          {pool.length > 1 && (
            <button onClick={() => setTriaging(true)}
              className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-xs font-bold text-white transition"
              style={{ background: `var(--h-${hue})` }}
              title="Judge the batch fast: keyboard-driven approve / star / pick + compare">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="m14 17 2 2 4-4" />
              </svg>
              Triage {pool.length}
            </button>
          )}
          {stage === "video" && (
            <button onClick={() => setImporting(true)}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-xs font-bold text-text transition hover:border-accent hover:text-accent"
              title="Pull the clips you generated on an external tool straight in">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
              </svg>
              Import from Higgsfield
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + {stage === "image" ? "Candidate" : "Take"}
          </Button>
        </div>
      </div>

      {pool.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border py-6 text-center text-xs text-text-faint">
          No {stage === "image" ? "images" : "takes"} yet. Add generations as you make them.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {pool.map((g) => <GenCard key={g.id} projectId={projectId} shot={shot} gen={g} src={srcOf(g)} onRun={onRun} />)}
        </div>
      )}

      <Flow />

      {/* Then the locked selection, lifted out of the pool into its own section */}
      {stage === "image" ? (
        <div className="rounded-[12px] bg-surface-2 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Selected frames · the video animates between these
          </div>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <FrameSlot label="Start" color="var(--h-cyan)" gen={start} src={srcOf(start)} empty="Tag a candidate 'Start' above" />
            <FrameSlot label="End" color="var(--h-pink)" gen={end} src={srcOf(end)} empty="Tag a candidate 'End' above" />
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] bg-surface-2 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">Picked take</div>
          <div className="max-w-xs">
            <FrameSlot label="Final take" color="var(--h-green)" gen={take} src={srcOf(take)} empty="Pick a take above" video />
          </div>
        </div>
      )}

      {adding && (
        <AddGenModal projectId={projectId} studioId={studioId} shot={shot} stage={stage}
          promptId={prompt?.id ?? null} basePrompt={pText} refStartId={refStartId} refEndId={refEndId}
          onClose={() => setAdding(false)} />
      )}
      {importing && (
        <ImportModal projectId={projectId} shot={shot} stage={stage} basePrompt={pText}
          onClose={() => setImporting(false)} onDone={() => router.refresh()} />
      )}
      {triaging && (
        <TriageView projectId={projectId} stage={stage} shotId={shot.id}
          items={pool} media={media} onClose={() => setTriaging(false)} />
      )}
    </div>
  );
}

// ---- Sequence strip (all shots at once, drag to reorder) --------------------

function SequenceStrip({
  shots, thumbs, activeId, onSelect, onReorder,
}: {
  shots: AiShot[];
  thumbs: Map<string, string | null>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const sig = shots.map((s) => s.id).join(",");
  const [order, setOrder] = useState<string[]>(shots.map((s) => s.id));
  useEffect(() => {
    setOrder(shots.map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const byId = useMemo(() => {
    const m = new Map<string, AiShot>();
    shots.forEach((s) => m.set(s.id, s));
    return m;
  }, [shots]);
  const dragIx = useRef<number | null>(null);
  const [overIx, setOverIx] = useState<number | null>(null);

  function drop(i: number) {
    const from = dragIx.current;
    dragIx.current = null;
    setOverIx(null);
    if (from == null || from === i) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setOrder(next);
    onReorder(next);
  }

  return (
    <div className="rounded-[14px] border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Sequence</span>
        <span className="text-xs text-text-faint">{shots.length} shot{shots.length === 1 ? "" : "s"} · drag to reorder</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {order.map((id, i) => {
          const s = byId.get(id);
          if (!s) return null;
          const on = id === activeId;
          const url = thumbs.get(id) ?? null;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => { dragIx.current = i; }}
              onDragOver={(e) => { e.preventDefault(); setOverIx(i); }}
              onDragLeave={() => setOverIx((v) => (v === i ? null : v))}
              onDrop={() => drop(i)}
              onClick={() => onSelect(id)}
              className={`w-[136px] shrink-0 cursor-pointer rounded-[10px] border p-1.5 transition ${
                on ? "border-accent bg-accent-soft" : overIx === i ? "border-accent" : "border-border hover:border-border-strong"
              }`}
            >
              <div className="relative overflow-hidden rounded-[7px]" style={{ aspectRatio: "16/9", background: gradFor(id) }}>
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <span className="absolute left-1 top-1 rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[9px] font-extrabold text-white">{i + 1}</span>
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full"
                  style={{ background: s.method === "live" ? "var(--h-cyan)" : "var(--h-purple)", boxShadow: "0 0 0 2px rgba(0,0,0,.35)" }}
                  title={s.method === "live" ? "Live" : "Generated"} />
              </div>
              <div className="mt-1 truncate text-[12px] font-semibold text-text">{s.title || "Untitled shot"}</div>
              <div className="mt-0.5">
                <StatusTag hue={STAGE_HUE[s.stage] ?? ("blue" as Hue)}>{s.stage}</StatusTag>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Send-to-review control (spells out exactly what's being sent) ----------

function IncludeRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-extrabold text-white"
        style={{ background: ok ? "var(--green)" : "var(--border-strong)" }}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "font-semibold text-text" : "text-text-faint"}>{label}</span>
      {!ok && <span className="text-xs text-text-faint">not picked yet</span>}
    </div>
  );
}

function SendToReviewControl({
  projectId, shot, inReview, hasStart, hasEnd, hasTake,
}: {
  projectId: string; shot: AiShot; inReview: boolean;
  hasStart: boolean; hasEnd: boolean; hasTake: boolean;
}) {
  const router = useRouter();
  const [openM, setOpenM] = useState(false);
  const [busy, startT] = useTransition();

  if (inReview) {
    return (
      <Link
        href={`/projects/${projectId}/review/shot/${shot.id}`}
        className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs font-bold"
        style={{ background: "var(--h-pink-bg)", color: "var(--h-pink)" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-pink)" }} />
        In review · Open
      </Link>
    );
  }

  const nothing = !hasStart && !hasEnd && !hasTake;
  function send() {
    startT(async () => {
      await sendDocToReview(projectId, "ai_shot", shot.id);
      setOpenM(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpenM(true)}
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-xs font-bold text-text-muted transition hover:border-border-strong hover:text-text"
        title="Put this shot into the review cycle"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
        </svg>
        Send to review
      </button>
      {openM && (
        <Modal open onClose={() => setOpenM(false)} title="Send this shot to review">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              You&apos;re sending <b className="text-text">{shot.title || "this shot"}</b> into
              the project&apos;s review cycle. Your team reviews it on a full page (pins on the
              frames, timecoded notes on the take) and greenlights it. When it&apos;s ready you
              share one link and the client reviews the exact same thing.
            </p>
            <div className="rounded-[12px] border border-border bg-surface-2/40 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                What goes into this review
              </p>
              <div className="space-y-1.5">
                <IncludeRow label="Start frame" ok={hasStart} />
                <IncludeRow label="End frame" ok={hasEnd} />
                <IncludeRow label="Take (video)" ok={hasTake} />
              </div>
            </div>
            {nothing && (
              <p
                className="rounded-[9px] px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)" }}
              >
                Nothing is picked yet. You can still send it, but reviewers won&apos;t see any
                frames or a take until you tag a Start / End (and pick a Take) below.
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setOpenM(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={send} disabled={busy}>
                {busy ? "Sending…" : "Send to review"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---- Workspace --------------------------------------------------------------

export function PipelineWorkspace({
  projectId, studioId, script, shots, prompts, generations, media, library = [], reviewingShotIds = [],
}: {
  projectId: string;
  studioId: string;
  script: AiScript | null;
  shots: AiShot[];
  prompts: AiPrompt[];
  generations: AiGeneration[];
  media: Record<string, string>;
  library?: AiPromptLibraryEntry[];
  reviewingShotIds?: string[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(shots[0]?.id ?? null);
  const [scriptOpen, setScriptOpen] = useState(false);

  const reviewing = useMemo(() => new Set(reviewingShotIds), [reviewingShotIds]);
  const active = shots.find((s) => s.id === activeId) ?? null;

  function run(fn: () => Promise<unknown>) {
    start(async () => { await fn(); router.refresh(); });
  }
  function newShot(method: "generated" | "live") {
    start(async () => { const r = await addShot(projectId, method); if (r?.id) setActiveId(r.id); router.refresh(); });
  }

  // Open the pipeline with the first shot already created: a new AI project
  // starts in shot 1 (generated) instead of an empty "add a shot" state. Only
  // seeds once, on the client (never on link prefetch), and only when empty.
  const seededRef = useRef(false);
  useEffect(() => {
    if (shots.length === 0 && !seededRef.current) {
      seededRef.current = true;
      start(async () => {
        const r = await addShot(projectId, "generated");
        if (r?.id) setActiveId(r.id);
        router.refresh();
      });
    }
  }, [shots.length, projectId, router]);

  const shotPrompts = useMemo(() => {
    const m = new Map<string, AiPrompt>();
    for (const p of prompts) m.set(`${p.shot_id}:${p.stage}`, p);
    return m;
  }, [prompts]);
  const shotGens = useMemo(() => {
    const m = new Map<string, AiGeneration[]>();
    for (const g of generations) {
      const k = `${g.shot_id}:${g.stage}`;
      const a = m.get(k) ?? []; a.push(g); m.set(k, a);
    }
    return m;
  }, [generations]);

  const imgGens = active ? shotGens.get(`${active.id}:image`) ?? [] : [];
  const approvedStart = imgGens.find((g) => g.role === "start") ?? null;
  const approvedEnd = imgGens.find((g) => g.role === "end") ?? null;
  const videoGens = active ? shotGens.get(`${active.id}:video`) ?? [] : [];
  const pickedTake = videoGens.find((g) => g.role === "take" || g.role === "final") ?? null;

  // Input mode tailors the generated flow. Default 'frames' = the classic
  // image candidates -> Start/End -> video. video_to_video / text_to_video skip
  // the image stage and go straight to a video generation (v2v / video-first).
  const inputMode = active?.input_mode ?? "frames";
  const showImageStage =
    active?.method !== "live" &&
    (inputMode === "frames" || inputMode === "image_to_video");

  // Representative thumbnail per shot: final take > take > start > any image > any.
  const shotThumb = useMemo(() => {
    const byShot = new Map<string, AiGeneration[]>();
    for (const g of generations) {
      const a = byShot.get(g.shot_id) ?? []; a.push(g); byShot.set(g.shot_id, a);
    }
    const m = new Map<string, string | null>();
    for (const s of shots) {
      const gs = byShot.get(s.id) ?? [];
      const rep =
        gs.find((g) => g.role === "final") ??
        gs.find((g) => g.role === "take") ??
        gs.find((g) => g.role === "start") ??
        gs.find((g) => g.stage === "image") ??
        gs[0];
      m.set(s.id, rep ? media[rep.id] ?? rep.external_url ?? null : null);
    }
    return m;
  }, [generations, shots, media]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setScriptOpen((s) => !s)}
          className="flex items-center gap-2 rounded-[11px] border border-border px-3 py-2 text-sm font-bold text-text hover:border-border-strong">
          <span className="grid h-6 w-6 place-items-center rounded-[7px]" style={{ background: "var(--h-indigo-bg)", color: "var(--h-indigo)" }}>✎</span>
          Script <span className="text-xs font-normal text-text-faint">{scriptOpen ? "hide" : "edit"}</span>
        </button>
        <LibraryButton projectId={projectId} entries={library} />
        <span className="flex-1" />
        <Button size="sm" onClick={() => newShot("generated")}>+ Generated shot</Button>
        <Button size="sm" variant="secondary" onClick={() => newShot("live")}>+ Live shot</Button>
      </div>

      {scriptOpen && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-text">Script — the copy for this project</h4>
          <ScriptEditor projectId={projectId} initial={script?.content ?? ""} />
        </div>
      )}

      {/* Sequence: all shots at once */}
      {shots.length > 0 && (
        <SequenceStrip
          shots={shots}
          thumbs={shotThumb}
          activeId={activeId}
          onSelect={setActiveId}
          onReorder={(ids) => run(() => reorderShots(projectId, ids))}
        />
      )}

      {/* Active shot */}
      {shots.length === 0 ? (
        <div className="grid place-items-center rounded-[14px] border border-dashed border-border p-16 text-center text-sm text-text-faint">
          Setting up your first shot…
        </div>
      ) : !active ? (
        <div className="grid place-items-center rounded-[14px] border border-dashed border-border p-16 text-sm text-text-faint">
          Select a shot from the sequence above.
        </div>
      ) : (
        <div className="space-y-4">
            {/* Shot header */}
            <div className="rounded-[14px] border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input defaultValue={active.title} onBlur={(e) => run(() => updateShot(projectId, active.id, { title: e.target.value }))}
                  placeholder="Shot title" className={`${cell} flex-1 text-base font-bold`} />
                <div className="flex gap-1">
                  {(["generated", "live"] as const).map((m) => (
                    <button key={m} onClick={() => run(() => updateShot(projectId, active.id, { method: m }))}
                      className="rounded-[8px] px-2.5 py-1 text-xs font-bold"
                      style={active.method === m
                        ? { background: m === "live" ? "var(--h-cyan-bg)" : "var(--h-purple-bg)", color: m === "live" ? "var(--h-cyan)" : "var(--h-purple)" }
                        : { color: "var(--text-faint)" }}>
                      {m === "live" ? "Live" : "Generated"}
                    </button>
                  ))}
                </div>
                <select value={active.stage} onChange={(e) => run(() => updateShot(projectId, active.id, { stage: e.target.value }))}
                  className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold">
                  {["script", "image", "video", "post", "delivered"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {active.method !== "live" && (
                  <select value={active.input_mode ?? "frames"}
                    onChange={(e) => run(() => updateShot(projectId, active.id, { input_mode: e.target.value }))}
                    className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold"
                    title="How this shot is generated">
                    <option value="frames">Start + End frames</option>
                    <option value="image_to_video">Image → video</option>
                    <option value="video_to_video">Video → video</option>
                    <option value="text_to_video">Text → video</option>
                  </select>
                )}
                <SendToReviewControl
                  projectId={projectId}
                  shot={active}
                  inReview={reviewing.has(active.id)}
                  hasStart={Boolean(approvedStart)}
                  hasEnd={Boolean(approvedEnd)}
                  hasTake={Boolean(pickedTake)}
                />
                <button onClick={() => { if (confirm("Delete this shot?")) { setActiveId(null); run(() => deleteShot(projectId, active.id)); } }}
                  className="text-xs font-semibold text-red hover:underline">Delete</button>
              </div>
              <textarea defaultValue={active.beat ?? ""} onBlur={(e) => updateShot(projectId, active.id, { beat: e.target.value || null })}
                rows={2} placeholder="Script beat — the action/copy this shot covers" className={`mt-2 ${field}`} />
            </div>

            {active.method === "live" ? (
              <div className="rounded-[14px] border border-dashed border-border p-6 text-sm text-text-muted">
                <b className="text-text">Live / captured shot.</b> This one is shot on-set, not generated. Use the
                project&apos;s shot list, storyboards, and call sheet for it; it still flows into the same review and
                delivery. (Deeper live-shot linking comes later.)
              </div>
            ) : (
              <>
                {showImageStage && (
                  <>
                    <Flow label="prompt, generate & pick images" />
                    <StagePanel projectId={projectId} studioId={studioId} shot={active} stage="image"
                      prompt={shotPrompts.get(`${active.id}:image`) ?? null}
                      gens={imgGens} media={media} library={library} refStartId={null} refEndId={null} onRun={run} />
                  </>
                )}
                <Flow label={
                  showImageStage ? "lock start + end, then generate video"
                    : inputMode === "video_to_video" ? "add a reference video, then generate"
                    : "prompt & generate video"
                } />
                <StagePanel projectId={projectId} studioId={studioId} shot={active} stage="video"
                  prompt={shotPrompts.get(`${active.id}:video`) ?? null}
                  gens={shotGens.get(`${active.id}:video`) ?? []}
                  media={media} library={library}
                  refStartId={showImageStage ? approvedStart?.id ?? null : null}
                  refEndId={showImageStage ? approvedEnd?.id ?? null : null} onRun={run} />
              </>
            )}
          </div>
        )}
    </div>
  );
}
