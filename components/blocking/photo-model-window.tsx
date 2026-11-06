"use client";

// "Model from a photo": the window that sends photos of a real object to the
// person's own Higgsfield plan and puts the 3D model it makes into the scene.
// It states the price and the balance before anything is spent, and hands
// back a job id; the studio drops a placeholder into the scene and swaps the
// model in when it is ready, so nobody has to wait with the window open.
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PHOTO_MODEL, PHOTO_MODELS, type PhotoModelId } from "@/lib/blocking/photo-model";
import { Btn } from "./ui";

export type PhotoQuote = { credits: number | null; plan: string | null; costs: Partial<Record<PhotoModelId, number>> };

export type PhotoModelService = {
  /** Present only when the viewer can generate (edit rights and their own Higgsfield connection). */
  generate?: {
    quote: (photos: number) => Promise<PhotoQuote | { error: string; notConnected?: true }>;
    start: (files: File[], modelId: PhotoModelId) => Promise<{ jobId: string } | { error: string; notConnected?: true }>;
    check: (jobId: string) => Promise<{ state: "pending" } | { state: "done"; path: string } | { state: "failed"; error: string } | { error: string }>;
  };
  /** A short-lived link to a stored model, for anyone who can open the scene. */
  sign: (path: string) => Promise<string | null>;
};

const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

export function PhotoModelWindow({
  service, onClose, onStarted,
}: {
  service: NonNullable<PhotoModelService["generate"]>;
  onClose: () => void;
  onStarted: (jobId: string, modelId: PhotoModelId, name: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState<PhotoModelId>(DEFAULT_PHOTO_MODEL);
  const [quote, setQuote] = useState<PhotoQuote | null>(null);
  const [problem, setProblem] = useState<{ text: string; notConnected?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const many = files.length > 1;

  // Prices only change between one photo and several (Tripo's multiview model).
  useEffect(() => {
    let live = true;
    setQuote(null);
    service.quote(many ? 2 : 1).then((q) => {
      if (!live) return;
      if (!q) { setProblem({ text: "Your session has expired. Reload the page." }); return; }
      if ("error" in q) setProblem({ text: q.error, notConnected: q.notConnected });
      else setQuote(q);
    });
    return () => { live = false; };
  }, [many, service]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const model = PHOTO_MODELS.find((m) => m.id === modelId)!;
  const tooMany = files.length > model.maxPhotos;
  const cost = quote?.costs[modelId] ?? null;
  const short = cost != null && quote?.credits != null && quote.credits < cost;

  const add = (list: FileList | null) => {
    // Copy before the input is cleared: a FileList is a live view of it.
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (input.current) input.current.value = "";
    const big = picked.find((f) => f.size > MAX_PHOTO_BYTES);
    if (big) { setProblem({ text: `${big.name} is over 30MB. Use a smaller copy.` }); return; }
    setProblem(null);
    setFiles((prev) => [...prev, ...picked].slice(0, 4));
    if (!name && picked[0]) setName(picked[0].name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40));
  };

  const go = async () => {
    if (!files.length || tooMany || busy) return;
    setBusy(true);
    setProblem(null);
    const res = await service.start(files, modelId);
    setBusy(false);
    if (!res) { setProblem({ text: "Your session has expired. Reload the page." }); return; }
    if ("error" in res) { setProblem({ text: res.error, notConnected: res.notConnected }); return; }
    onStarted(res.jobId, modelId, name.trim() || "Model");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-[520px] rounded-[12px] border border-border bg-surface p-5 shadow-2xl" onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-text">Model from a photo</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
              Photograph the real object (the car, the bottle, the chair) and Higgsfield turns it into a 3D model in this scene, on your own credits.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-[16px] leading-none text-text-faint hover:text-text" aria-label="Close">×</button>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {previews.map((u, i) => (
              <div key={u} className="relative h-20 w-20 overflow-hidden rounded-[8px] border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-[11px] text-white" aria-label="Remove photo">×</button>
              </div>
            ))}
            {files.length < 4 && (
              <button type="button" onClick={() => input.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-[11px] text-text-muted hover:border-accent hover:text-text">
                <span className="text-[18px] leading-none">+</span>
                {files.length ? "Another view" : "Add a photo"}
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            The whole object, on a plain background. Only what is in the photo is made: a second, third or fourth view from another side gives Tripo a truer shape.
          </p>
        </div>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold text-text-muted">Name in the scene</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Hero bottle"
            className="mt-1 h-8 w-full rounded-[6px] border border-border bg-surface-2 px-2 text-[12.5px] text-text outline-none focus:border-accent" />
        </label>

        <div className="mt-4 grid gap-2">
          {PHOTO_MODELS.map((m) => {
            const on = m.id === modelId;
            const c = quote?.costs[m.id];
            const off = files.length > m.maxPhotos;
            return (
              <button key={m.id} type="button" onClick={() => setModelId(m.id)}
                className={`flex items-start justify-between gap-3 rounded-[8px] border px-3 py-2 text-left ${on ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"} ${off ? "opacity-50" : ""}`}>
                <span>
                  <span className="block text-[12.5px] font-semibold text-text">{m.name}</span>
                  <span className="block text-[11px] text-text-muted">{off ? `Takes one photo. Remove ${files.length - 1} to use it.` : m.hint}</span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-text">{c != null ? `${c} credits` : quote ? "" : "…"}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11.5px] text-text-muted">
          {quote?.credits != null ? `Your Higgsfield balance: ${quote.credits} credits${quote.plan ? ` (${quote.plan})` : ""}.` : quote ? "" : "Checking your balance…"}
          {" "}It takes about two to three minutes. An outline holds its place in the scene and fills in when the model is ready, so you can keep working.
        </p>

        {problem && (
          <p className="mt-3 rounded-[7px] border border-red bg-red-bg px-3 py-2 text-[12px] text-text">
            {problem.text}
            {problem.notConnected && <> <a href="/settings" className="font-semibold underline">Open Settings</a></>}
          </p>
        )}
        {short && <p className="mt-2 text-[12px] text-text">That is more than your balance. Top up on Higgsfield first.</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <button type="button" onClick={go} disabled={!files.length || tooMany || busy || short || !quote}
            className="rounded-[6px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fg disabled:opacity-50">
            {busy ? "Sending…" : cost != null ? `Make the model · ${cost} credits` : "Make the model"}
          </button>
        </div>
      </div>
    </div>
  );
}
