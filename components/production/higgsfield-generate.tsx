"use client";

// The generate window: one candidate made on the person's own Higgsfield plan,
// opened from the pipeline map or from a shot's stage panel. The PRICE IS
// SHOWN BEFORE THE PRESS, and the button carries it, because a video take
// costs fifteen times a still and the difference between models is larger
// than the difference between settings.
//
// It knows nothing about storage or Higgsfield's API: the caller passes
// `quote` (spends nothing) and `generate` (the only call that spends), so a
// fixture can mount the real window with stubs.

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  creditsWord,
  cleanChoice,
  droppedInputs,
  genModel,
  modelsFor,
  provenanceLines,
  inputWord,
  rolesFor,
  takesInput,
  type GenChoice,
  type GenInputRole,
  type GenInputSource,
  type GenKind,
} from "@/lib/higgsfield-generate";

export type GenInputOption = { genId: string; label: string; thumb: string | null; role: GenInputRole; source: GenInputSource };

const ROLE_WORD: Record<GenInputRole, string> = { start: "Start frame", end: "End frame", ref: "Reference" };
const SOURCE_WORD: Record<GenInputSource, string> = { frame: "Picture on this shot", element: "Element", video: "Video on this shot" };

export type GenQuote = { credits: number | null; cost: number | null } | { error: string };

export type GenerateRequest = {
  kind: GenKind;
  shotId: string;
  shotTitle: string;
  /** What it is being made from, preselected. */
  inputs: GenInputOption[];
  /** Everything else on the shot that could be fed in (pictures and elements). */
  available: GenInputOption[];
  defaultPrompt: string;
  defaultAspect?: string;
};

type Phase = { at: "edit" } | { at: "sending" } | { at: "working"; started: number } | { at: "done"; title: string } | { at: "failed"; error: string };

export function GenerateWindow({
  request,
  onClose,
  quote,
  generate,
}: {
  request: GenerateRequest | null;
  onClose: () => void;
  /** One price per choice, in one call. Spends nothing. */
  quote: (choices: GenChoice[]) => Promise<GenQuote[]>;
  /**
   * Submits, waits and stores. Resolves when the candidate is on the shot.
   * `expectedCost` is the price on the button; a generation that would cost
   * more is refused and comes back with `newCost`.
   */
  generate: (
    choice: GenChoice,
    expectedCost: number | null,
    onSubmitted: () => void,
  ) => Promise<{ ok: true } | { error: string; newCost?: number }>;
}) {
  const open = !!request;
  const kind = request?.kind ?? "image";
  const models = modelsFor(kind);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [duration, setDuration] = useState<number | null>(null);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<GenInputOption[]>([]);
  const [prices, setPrices] = useState<Record<string, GenQuote>>({});
  const [adding, setAdding] = useState(false);
  const [phase, setPhase] = useState<Phase>({ at: "edit" });

  // A fresh request resets the form to what it was opened from.
  useEffect(() => {
    if (!request) return;
    const first = modelsFor(request.kind)[0];
    setModelId(first?.id ?? "");
    setPrompt(request.defaultPrompt);
    setAspect(request.defaultAspect && first?.aspects.includes(request.defaultAspect) ? request.defaultAspect : first?.aspects[0] ?? "16:9");
    setDuration(first?.duration?.default ?? null);
    setOptions(Object.fromEntries((first?.options ?? []).map((o) => [o.key, o.default])));
    setInputs(request.inputs);
    setAdding(false);
    setPhase({ at: "edit" });
  }, [request]);

  const model = genModel(modelId);

  function pickModel(id: string) {
    const m = genModel(id);
    if (!m) return;
    setModelId(id);
    if (!m.aspects.includes(aspect)) setAspect(m.aspects[0]);
    setDuration(m.duration ? Math.min(m.duration.max, Math.max(m.duration.min, duration ?? m.duration.default)) : null);
    setOptions(Object.fromEntries(m.options.map((o) => [o.key, options[o.key] && o.values.some((v) => v.value === options[o.key]) ? options[o.key] : o.default])));
  }

  const choice: GenChoice = useMemo(
    () => ({
      modelId,
      prompt,
      aspect,
      duration,
      options,
      inputs: inputs.map((i) => ({ genId: i.genId, role: i.role, source: i.source })),
    }),
    [modelId, prompt, aspect, duration, options, inputs],
  );

  // The price follows the settings, not the prompt: a quote per keystroke
  // would be a round trip to Higgsfield per letter for a number that does not
  // move with the words. EVERY model of this kind is quoted (each with the
  // settings carried over as far as it takes them), so the cards can be
  // compared on cost before one is picked. A quote spends nothing.
  const priceKey = JSON.stringify({ aspect, duration, options, ins: inputs.map((i) => i.role), open });
  const seq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    setPrices({});
    const t = setTimeout(async () => {
      // Each model priced with the settings carried over as far as it takes
      // them, in one call, so the cards compare like for like.
      const all = models.map((m) => {
        if (m.id === modelId) return choice;
        const c = cleanChoice({ ...choice, modelId: m.id });
        return c ?? { ...choice, modelId: m.id };
      });
      const qs = await quote(all).catch(() => all.map(() => ({ error: "Could not reach Higgsfield for a price." }) as GenQuote));
      if (n !== seq.current) return;
      setPrices(Object.fromEntries(models.map((m, i) => [m.id, qs[i] ?? { error: "No price." }])));
    }, 350);
    return () => clearTimeout(t);
    // Picking another model changes its own settings, which is already in the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey]);

  const price = prices[modelId] ?? null;
  const cost = price && !("error" in price) ? price.cost : null;
  const credits = price && !("error" in price) ? price.credits : null;
  const short = cost != null && credits != null && cost > credits;
  const dropped = model ? droppedInputs(model, inputs) : null;
  const usable = model ? inputs.filter((i) => takesInput(model, i)) : [];
  const unused = (request?.available ?? []).filter((a) => !inputs.some((i) => i.genId === a.genId));

  /** Put an input in as a role; a second start or end replaces the first. */
  function putIn(opt: GenInputOption, role: GenInputRole) {
    setInputs((xs) => {
      const rest = xs.filter((x) => x.genId !== opt.genId && (role === "ref" || x.role !== role));
      const next = { ...opt, role };
      const order: Record<GenInputRole, number> = { start: 0, end: 1, ref: 2 };
      return [...rest, next].sort((a, b) => order[a.role] - order[b.role]);
    });
  }
  const canGo = phase.at === "edit" && cost != null && !short && prompt.trim().length > 0;

  async function go() {
    if (!canGo) return;
    setPhase({ at: "sending" });
    const res = await generate(choice, cost, () => setPhase({ at: "working", started: Date.now() })).catch(
      () => ({ error: "The connection dropped. Check your Higgsfield history before trying again." }) as { error: string; newCost?: number },
    );
    if ("error" in res) {
      // A price that went up is shown on the button, so the next press is a
      // deliberate yes to the new figure.
      if (res.newCost != null) setPrices((p) => ({ ...p, [modelId]: { credits, cost: res.newCost ?? null } }));
      setPhase({ at: "failed", error: res.error });
    }
    else setPhase({ at: "done", title: request?.shotTitle ?? "the shot" });
  }

  const labels = Object.fromEntries(inputs.map((i) => [i.genId, i.label]));
  const what = kind === "video" ? "a video take" : "a still";

  return (
    <Modal open={open} onClose={onClose} title={`Generate ${what}`} size="lg" id="higgsfield-generate">
      {request && model && (
        <div className="space-y-5">
          <p className="text-sm text-text-muted">
            For <span className="font-semibold text-text">{request.shotTitle}</span>. Made on your Higgsfield plan and added to this shot as a candidate, with
            everything about it written down.
          </p>

          {/* Model */}
          <div>
            <Label>Model</Label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickModel(m.id)}
                  disabled={phase.at !== "edit"}
                  className={`rounded-lg border p-3 text-left ${m.id === modelId ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-text">{m.name}</span>
                    <CardPrice q={prices[m.id]} />
                  </div>
                  <div className="mt-0.5 text-xs text-text-muted">{m.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Built from */}
          <div>
            <Label>Built from</Label>
            {inputs.length === 0 && <p className="mt-1.5 text-xs text-text-muted">The prompt alone.</p>}
            <div className="mt-1.5 flex flex-wrap gap-2">
              {inputs.map((i) => {
                const on = usable.includes(i);
                const roles = rolesFor(model, i.source);
                return (
                  <span key={i.genId} className={`inline-flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-1 pr-2 ${on ? "" : "opacity-45"}`}>
                    <Thumb src={i.thumb} />
                    <span className="text-xs">
                      {phase.at === "edit" && roles.length > 1 && roles.includes(i.role) ? (
                        <select
                          value={i.role}
                          onChange={(e) => putIn(i, e.target.value as GenInputRole)}
                          className="block bg-transparent font-semibold text-text"
                          aria-label={`Use ${i.label} as`}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_WORD[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="block font-semibold text-text">{inputWord(i)}</span>
                      )}
                      <span className="block max-w-[140px] truncate text-text-muted">{i.label}</span>
                    </span>
                    {phase.at === "edit" && (
                      <button type="button" onClick={() => setInputs((xs) => xs.filter((x) => x !== i))} className="ml-1 text-text-faint hover:text-text" aria-label={`Remove ${i.label}`}>
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              {phase.at === "edit" && unused.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAdding((a) => !a)}
                  className="inline-flex h-11 items-center rounded-lg border border-dashed border-border px-3 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
                >
                  {adding ? "Done adding" : "+ Add a frame, reference or element"}
                </button>
              )}
            </div>
            {dropped && <p className="mt-1.5 text-xs text-text-muted">{dropped}</p>}
            {adding && phase.at === "edit" && (
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-2">
                {unused.map((a) => {
                  const roles = rolesFor(model, a.source);
                  return (
                    <div key={a.genId} className="flex flex-wrap items-center gap-2 rounded-md bg-surface p-1.5">
                      <Thumb src={a.thumb} />
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="block font-semibold text-text">{SOURCE_WORD[a.source]}</span>
                        <span className="block truncate text-text-muted">{a.label}</span>
                      </span>
                      {roles.length === 0 ? (
                        <span className="text-xs text-text-muted">{model.name} does not take {a.source === "element" ? "elements" : a.source === "video" ? "video references" : "this"}</span>
                      ) : (
                        <span className="flex gap-1">
                          {roles.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => putIn(a, r)}
                              className="h-7 rounded-md border border-border px-2 text-xs font-semibold text-text hover:border-accent"
                            >
                              {r === "ref" ? (a.source === "video" ? "As video reference" : "As reference") : `As ${ROLE_WORD[r].toLowerCase()}`}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div>
            <Label>Prompt</Label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={phase.at !== "edit"}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          {/* Settings */}
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Field label="Aspect">
              <Seg values={model.aspects.map((a) => ({ value: a, label: a }))} value={aspect} onChange={setAspect} disabled={phase.at !== "edit"} />
            </Field>
            {model.duration && (
              <Field label="Length">
                <span className="inline-flex items-center gap-2">
                  <input
                    type="range"
                    min={model.duration.min}
                    max={model.duration.max}
                    value={duration ?? model.duration.default}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    disabled={phase.at !== "edit"}
                    className="w-28"
                  />
                  <span className="w-8 text-sm tabular-nums text-text">{duration}s</span>
                </span>
              </Field>
            )}
            {model.options.map((o) => (
              <Field key={o.key} label={o.label}>
                <Seg values={o.values} value={options[o.key] ?? o.default} onChange={(v) => setOptions((x) => ({ ...x, [o.key]: v }))} disabled={phase.at !== "edit"} />
              </Field>
            ))}
          </div>

          {/* What gets written down */}
          <details className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-text">Saved with the candidate</summary>
            <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
              {provenanceLines(choice, labels).map((l) => (
                <div key={l.label} className="contents">
                  <dt className="text-text-faint">{l.label}</dt>
                  <dd className="line-clamp-2 text-text">{l.value}</dd>
                </div>
              ))}
            </dl>
          </details>

          {/* Price and the press */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <PriceLine price={price} short={short} />
            {phase.at === "edit" && (
              <button
                type="button"
                onClick={go}
                disabled={!canGo}
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cost != null ? `Generate · ${creditsWord(cost)}` : "Generate"}
              </button>
            )}
          </div>

          <Progress phase={phase} kind={kind} onClose={onClose} onRetry={() => setPhase({ at: "edit" })} />
        </div>
      )}
    </Modal>
  );
}

function CardPrice({ q }: { q: GenQuote | undefined }) {
  if (!q) return <span className="text-xs text-text-faint">...</span>;
  if ("error" in q || q.cost == null) return <span className="text-xs text-text-faint">no price</span>;
  return <span className="shrink-0 text-xs font-semibold tabular-nums text-text">{creditsWord(q.cost)}</span>;
}

function Thumb({ src }: { src: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-8 w-12 shrink-0 rounded object-cover" /> : <span className="h-8 w-12 shrink-0 rounded bg-surface-2" />;
}

function PriceLine({ price, short }: { price: GenQuote | null; short: boolean }) {
  if (!price) return <span className="text-sm text-text-muted">Checking the price on Higgsfield...</span>;
  if ("error" in price) return <span className="text-sm text-text">{price.error}</span>;
  if (price.cost == null) return <span className="text-sm text-text">Higgsfield did not give a price, so nothing can be generated.</span>;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text">
      <span className="h-2 w-2 rounded-full" style={{ background: short ? "var(--h-red)" : "var(--h-green)" }} />
      <span>
        <span className="font-semibold">{creditsWord(price.cost)}</span>
        {price.credits != null && (
          <span className="text-text-muted">
            {short ? ` · you have ${creditsWord(price.credits)}, not enough` : ` · ${creditsWord(Math.round((price.credits - price.cost) * 100) / 100)} left after`}
          </span>
        )}
      </span>
    </span>
  );
}

function Progress({ phase, kind, onClose, onRetry }: { phase: Phase; kind: GenKind; onClose: () => void; onRetry: () => void }) {
  if (phase.at === "edit") return null;
  if (phase.at === "failed")
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-text">
        <span className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--h-red)" }} />
          {phase.error}
        </span>
        <button type="button" onClick={onRetry} className="shrink-0 text-sm font-semibold text-accent">
          Back
        </button>
      </div>
    );
  if (phase.at === "done")
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-text">
        <span className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--h-green)" }} />
          Added to {phase.title} as a candidate.
        </span>
        <button type="button" onClick={onClose} className="shrink-0 text-sm font-semibold text-accent">
          Done
        </button>
      </div>
    );
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-text">
      <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full" style={{ background: "var(--h-blue)" }} />
      <span>
        {phase.at === "sending" ? "Sending to Higgsfield..." : `Generating on Higgsfield. ${kind === "video" ? "A take usually takes one to three minutes." : "A still usually takes under a minute."}`}
        <span className="block text-text-muted">You can close this window. It lands on the shot either way.</span>
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Seg({ values, value, onChange, disabled }: { values: { value: string; label: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex flex-wrap overflow-hidden rounded-md border border-border">
      {values.map((v) => (
        <button
          key={v.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v.value)}
          className={`h-8 border-r border-border px-2.5 text-xs last:border-r-0 ${v.value === value ? "bg-accent-soft font-semibold text-text" : "bg-surface text-text-muted hover:text-text"}`}
        >
          {v.label}
        </button>
      ))}
    </span>
  );
}
