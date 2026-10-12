"use client";

// "Make it real": one camera's frame sent to the person's own Higgsfield
// account and brought back as a photoreal still, which can then go to the shot
// list as that camera's row picture.
//
// NOTHING SPENDS CREDITS UNTIL "Generate" IS PRESSED, and the window states
// the price and the balance before that press. One press is one still; "Try
// again" is another press and says so.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { REAL_MODELS } from "@/lib/higgsfield-result";
import { normCode } from "@/lib/previz/shot-export";
import type { SendCamera, SendResult, SendTarget } from "./send-to-shot-list";

export type RealActions = {
  quote: (modelId: string) => Promise<{ credits: number | null; cost: number | null; plan: string | null } | { error: string; notConnected?: true }>;
  /** Renders the camera's frame and stores it on the project. */
  frame: (cameraId: string) => Promise<{ path: string; url: string } | { error: string }>;
  start: (path: string, prompt: string, modelId: string) => Promise<{ jobId: string } | { error: string; notConnected?: true }>;
  check: (jobId: string) => Promise<{ state: "pending" } | { state: "done"; path: string; url: string } | { state: "failed"; error: string } | { error: string }>;
  keep: (cameraId: string, path: string, target: SendTarget) => Promise<SendResult>;
};

type Phase =
  | { k: "setup" }
  | { k: "working"; step: string }
  | { k: "result"; frameUrl: string; path: string; url: string }
  | { k: "kept"; res: Extract<SendResult, { listId: string }> };

const POLL_MS = 1500;
const GIVE_UP_MS = 4 * 60 * 1000;

export function MakeItRealDialog({
  cameras,
  activeId,
  promptFor,
  lists,
  defaultTitle,
  shotListHref,
  settingsHref,
  actions,
  onClose,
}: {
  cameras: SendCamera[];
  activeId: string;
  promptFor: (cameraId: string) => string;
  lists: { id: string; title: string; codes: string[] }[];
  defaultTitle: string;
  shotListHref: string;
  settingsHref: string;
  actions: RealActions;
  onClose: () => void;
}) {
  const [camId, setCamId] = useState(cameras.some((c) => c.id === activeId) ? activeId : cameras[0]?.id ?? "");
  const [modelId, setModelId] = useState<string>(REAL_MODELS[0].id);
  const [prompt, setPrompt] = useState(() => promptFor(camId));
  const edited = useRef(false);
  const [quote, setQuote] = useState<{ credits: number | null; cost: number | null } | null>(null);
  const [quoteErr, setQuoteErr] = useState<{ msg: string; notConnected: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: "setup" });
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "new");
  const [newTitle, setNewTitle] = useState(defaultTitle || "Shot list");
  const alive = useRef(true);
  // Set on every mount, not only the first: React's development double mount
  // runs the cleanup once, and a flag left false drops every later step.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const cam = cameras.find((c) => c.id === camId) ?? null;
  const busy = phase.k === "working";

  // A camera's description follows the camera until the producer edits it.
  useEffect(() => {
    if (!edited.current) setPrompt(promptFor(camId));
  }, [camId, promptFor]);

  useEffect(() => {
    let off = false;
    setQuote(null);
    setQuoteErr(null);
    actions.quote(modelId).then((q) => {
      if (off) return;
      if (!q) { setQuoteErr({ msg: "Could not reach Higgsfield. Reload and try again.", notConnected: false }); return; }
      if ("error" in q) setQuoteErr({ msg: q.error, notConnected: Boolean(q.notConnected) });
      else setQuote(q);
    }).catch(() => { if (!off) setQuoteErr({ msg: "Could not reach Higgsfield.", notConnected: false }); });
    return () => { off = true; };
  }, [modelId, actions]);

  const generate = async () => {
    if (!cam || busy) return;
    setErr(null);
    setPhase({ k: "working", step: `Rendering ${cam.code}'s frame...` });
    try {
      const f = await actions.frame(cam.id);
      if (!f || "error" in f) throw new Error(f?.error ?? "The frame could not be stored.");
      if (!alive.current) return;
      setPhase({ k: "working", step: "Sending it to Higgsfield..." });
      const s = await actions.start(f.path, prompt, modelId);
      if (!s || "error" in s) throw new Error(s?.error ?? "That did not reach the server. Reload and check before trying again.");
      setPhase({ k: "working", step: "Higgsfield is making the still. This usually takes 10 to 30 seconds." });
      const began = Date.now();
      while (alive.current) {
        const c = await actions.check(s.jobId);
        if (!c) throw new Error("That did not reach the server. The still may be in your Higgsfield history.");
        if ("state" in c && c.state === "failed") throw new Error(c.error);
        if (!("state" in c)) throw new Error(c.error);
        if (c.state === "done") {
          setPhase({ k: "result", frameUrl: f.url, path: c.path, url: c.url });
          setQuote((q) => (q && q.credits !== null && q.cost !== null ? { ...q, credits: q.credits - q.cost } : q));
          return;
        }
        if (Date.now() - began > GIVE_UP_MS) {
          throw new Error("Higgsfield is taking longer than usual. The still will appear in your Higgsfield history when it is done.");
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (e) {
      if (!alive.current) return;
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setPhase({ k: "setup" });
    }
  };

  const keep = async () => {
    if (phase.k !== "result" || !cam) return;
    const at = phase;
    setErr(null);
    setPhase({ k: "working", step: "Adding it to the shot list..." });
    const res = await actions.keep(
      cam.id,
      at.path,
      target === "new" ? { listId: null, newTitle: newTitle.trim() || "Shot list" } : { listId: target, newTitle: null },
    ).catch((e) => ({ error: e instanceof Error ? e.message : "Could not send to the shot list." }) as SendResult);
    if (!alive.current) return;
    if (!res || "error" in res) {
      setErr(res?.error ?? "Could not send to the shot list.");
      setPhase(at);
      return;
    }
    setPhase({ k: "kept", res });
  };

  const updates = useMemo(() => {
    const l = lists.find((x) => x.id === target);
    return Boolean(cam && l?.codes.some((c) => normCode(c) === normCode(cam.code)));
  }, [lists, target, cam]);

  const model = REAL_MODELS.find((m) => m.id === modelId) ?? REAL_MODELS[0];
  const priceLine = quote
    ? `${quote.cost !== null ? `${fmt(quote.cost)} credits` : "Price not stated"} for one still, from your Higgsfield plan${quote.credits !== null ? ` (${fmt(quote.credits)} left)` : ""}.`
    : quoteErr
      ? null
      : "Checking the price with Higgsfield...";
  const short = Boolean(quote && quote.cost !== null && quote.credits !== null && quote.credits < quote.cost);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onClose} data-previz-own-wheel>
      <div
        role="dialog"
        aria-label="Make it real"
        className="max-h-[90vh] w-[720px] max-w-full overflow-y-auto rounded-[16px] border border-border bg-surface p-5 text-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Make it real</h2>
            <p className="text-xs text-text-muted">
              Sends one camera&apos;s frame to your Higgsfield account and brings back a photoreal still with the same
              framing. You can then put it on the shot list as that camera&apos;s picture.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50">
            Close
          </button>
        </div>

        {phase.k === "kept" ? (
          <div className="space-y-3">
            <div className="rounded-[10px] border border-[var(--h-green)] bg-[var(--h-green-bg)] p-3 text-text">
              <p className="font-semibold">
                {phase.res.updated ? `${cam?.code ?? "The row"} updated` : `${cam?.code ?? "A row"} added`} on {phase.res.title}, with the real still as its picture.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setPhase({ k: "setup" }); }} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold">
                Make another
              </button>
              <Link href={shotListHref} className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
                Open the shot list
              </Link>
            </div>
          </div>
        ) : phase.k === "result" || (phase.k === "working" && phase.step.startsWith("Adding")) ? (
          phase.k === "result" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <figure>
                  <div className="overflow-hidden rounded-[10px] bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={phase.frameUrl} alt={`${cam?.code ?? ""} previz frame`} className="w-full" />
                  </div>
                  <figcaption className="mt-1 text-[11px] text-text-muted">Previz frame</figcaption>
                </figure>
                <figure>
                  <div className="overflow-hidden rounded-[10px] bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={phase.url} alt={`${cam?.code ?? ""} photoreal still`} className="w-full" />
                  </div>
                  <figcaption className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                    <span>{model.name}</span>
                    <a href={phase.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-text">Open full size</a>
                  </figcaption>
                </figure>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-muted">Keep it on a shot list</span>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
                  >
                    {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    <option value="new">New shot list...</option>
                  </select>
                </label>
                <span className="pb-2 text-[11px] font-semibold text-text-muted">
                  {target !== "new" && updates ? `Updates ${cam?.code}` : `Adds ${cam?.code}`}
                </span>
              </div>
              {target === "new" ? (
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={120}
                  aria-label="New shot list name"
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
                />
              ) : null}
              {err ? <p className="rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] p-2 text-xs text-text">{err}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-[11px] text-text-muted">
                  The still is saved to this project either way.
                </span>
                <button type="button" onClick={() => setPhase({ k: "setup" })} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold">
                  Try again{quote?.cost !== null && quote?.cost !== undefined ? ` (${fmt(quote.cost)} credits)` : ""}
                </button>
                <button type="button" onClick={() => void keep()} className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
                  Keep: put it on the shot list
                </button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">{phase.step}</p>
          )
        ) : (
          <>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-muted">Camera</span>
                <select
                  value={camId}
                  onChange={(e) => setCamId(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
                >
                  {cameras.map((c) => <option key={c.id} value={c.id}>{c.code}{c.title ? ` · ${c.title}` : ""}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-muted">Model</span>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
                >
                  {REAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </div>

            {cam?.thumb ? (
              <div className="mb-3 w-[200px] overflow-hidden rounded-[8px] bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cam.thumb} alt={`${cam.code} as it stands`} className="w-full" />
              </div>
            ) : null}

            <label className="mb-1 block">
              <span className="mb-1 flex items-center justify-between text-xs font-semibold text-text-muted">
                <span>What it should look like</span>
                {edited.current ? (
                  <button
                    type="button"
                    onClick={() => { edited.current = false; setPrompt(promptFor(camId)); }}
                    className="font-semibold hover:text-text"
                  >
                    Reset
                  </button>
                ) : null}
              </span>
              <textarea
                value={prompt}
                onChange={(e) => { edited.current = true; setPrompt(e.target.value); }}
                disabled={busy}
                rows={6}
                maxLength={3000}
                className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
              />
            </label>
            <p className="mb-3 text-[11px] text-text-muted">
              Filled in from the setup. Add what the blocks cannot show: wardrobe, the product, the mood, time of day.
            </p>

            {quoteErr ? (
              <p className="mb-3 rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] p-2 text-xs text-text">
                {quoteErr.msg}{" "}
                {quoteErr.notConnected ? <Link href={settingsHref} className="font-semibold underline">Open Settings</Link> : null}
              </p>
            ) : (
              <p className={`mb-3 text-xs ${short ? "font-semibold text-text" : "text-text-muted"}`}>
                {priceLine}
                {short ? " That is not enough for this still." : ""}
              </p>
            )}
            {busy ? <p className="mb-3 text-xs font-semibold text-text">{phase.step}</p> : null}
            {err ? <p className="mb-3 rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] p-2 text-xs text-text">{err}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy || !cam || !prompt.trim() || Boolean(quoteErr) || !quote || short}
                className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {busy ? "Working..." : `Generate${quote?.cost !== null && quote?.cost !== undefined ? ` (${fmt(quote.cost)} credits)` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));
