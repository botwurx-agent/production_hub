"use client";

// Generating on Higgsfield from the AI pipeline: the window opened from the
// map, wired to the real actions, plus the strip that shows every take still
// being made and FINISHES them, so a take started and then walked away from
// still lands on its shot.
//
// What goes in is built from the page's own data, never typed: the frames the
// shot already has tagged, the elements it uses, and for "another like this"
// the very inputs that take was made from.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateWindow, type GenInputOption, type GenQuote, type GenerateRequest } from "@/components/production/higgsfield-generate";
import type { GenerateAsk } from "@/components/production/pipeline-map";
import { checkGeneration, dismissGeneration, quoteGenerations, startGeneration } from "@/app/(app)/projects/[id]/generate-actions";
import { actionError } from "@/lib/action-result";
import { toast } from "@/components/ui/toast";
import type { CastReference } from "@/lib/cast";
import type { MapRef } from "@/lib/pipeline-map";
import type { AiGeneration, AiPrompt, AiShot } from "@/lib/database.types";

type Props = {
  projectId: string;
  shots: AiShot[];
  generations: AiGeneration[];
  prompts: AiPrompt[];
  refs: MapRef[];
  thumbs: Record<string, string>;
  refsFor: (shotId: string) => CastReference[];
};

function label(g: AiGeneration, fallback: string): string {
  const p = (g.prompt ?? "").trim();
  return p ? (p.length > 40 ? `${p.slice(0, 40)}...` : p) : fallback;
}

/** The window's request for one ask, built from what the shot already holds. */
export function buildRequest(ask: GenerateAsk, p: Props): GenerateRequest | null {
  const shot = p.shots.find((s) => s.id === ask.shotId);
  if (!shot) return null;
  const onShot = p.generations.filter((g) => g.shot_id === shot.id && g.status !== "rejected");
  const from = ask.fromGenId ? onShot.find((g) => g.id === ask.fromGenId) ?? null : null;
  const thumb = (g: AiGeneration | null | undefined) => (g ? p.thumbs[g.id] ?? null : null);

  const frame = (g: AiGeneration | null | undefined, role: "start" | "end" | "ref"): GenInputOption | null =>
    g && g.kind === "image" ? { genId: g.id, label: label(g, "Frame"), thumb: thumb(g), role, source: "frame" } : null;
  const video = (g: AiGeneration): GenInputOption => ({
    genId: g.id,
    label: label(g, g.status === "reference" ? "Motion reference" : "Take"),
    thumb: thumb(g),
    role: "ref",
    source: "video",
  });
  const elements: GenInputOption[] = p
    .refsFor(shot.id)
    .flatMap((r) => (r.sheets[0] ? [{ genId: r.sheets[0].id, label: r.name, thumb: r.sheets[0].thumbUrl ?? r.sheets[0].url, role: "ref" as const, source: "element" as const }] : []));

  const byId = new Map(onShot.map((g) => [g.id, g]));
  const tagged = (role: "start" | "end") => onShot.find((g) => g.stage === "image" && g.role === role) ?? null;
  let kind: "image" | "video" = "video";
  let inputs: GenInputOption[] = [];

  if (ask.mode === "still" || (ask.mode === "again" && from?.kind === "image")) {
    kind = "image";
    inputs = elements;
  } else if (ask.mode === "take" && from?.kind === "image") {
    inputs = [frame(from, "start"), ...elements].filter(Boolean) as GenInputOption[];
  } else if (ask.mode === "again" && from) {
    // Another like this one: the same frames and the same recorded inputs.
    const recorded = p.refs
      .filter((r) => r.generation_id === from.id)
      .map((r) => byId.get(r.ref_generation_id))
      .filter((g): g is AiGeneration => Boolean(g))
      .map((g) => (g.kind === "video" ? video(g) : frame(g, "ref")))
      .filter(Boolean) as GenInputOption[];
    inputs = [
      frame(from.parent_start_id ? byId.get(from.parent_start_id) : null, "start"),
      frame(from.parent_end_id ? byId.get(from.parent_end_id) : null, "end"),
      ...recorded,
      ...elements,
    ].filter(Boolean) as GenInputOption[];
  } else {
    inputs = [frame(tagged("start"), "start"), frame(tagged("end"), "end"), ...elements].filter(Boolean) as GenInputOption[];
  }
  const seen = new Set<string>();
  inputs = inputs.filter((i) => (seen.has(i.genId) ? false : (seen.add(i.genId), true)));

  // Everything else on the shot that could be fed in.
  const available: GenInputOption[] = [
    ...onShot
      .filter((g) => g.kind === "image")
      .map((g) => frame(g, g.status === "reference" ? "ref" : g.role === "end" ? "end" : "start"))
      .filter((x): x is GenInputOption => Boolean(x)),
    ...onShot.filter((g) => g.kind === "video").map(video),
    ...elements,
  ];

  const stagePrompt = p.prompts.find((x) => x.shot_id === shot.id && x.stage === kind)?.text?.trim();
  const defaultPrompt = (from?.prompt ?? "").trim() || stagePrompt || shot.beat || shot.title || "";
  return {
    kind,
    shotId: shot.id,
    shotTitle: shot.title || "this shot",
    inputs,
    available,
    defaultPrompt,
    defaultAspect: from?.aspect ?? undefined,
  };
}

export function PipelineGenerate({
  open,
  onClose,
  ...p
}: Props & { open: GenerateRequest | null; onClose: () => void }) {
  const router = useRouter();
  // Stops the window's own polling once it is closed: the strip takes over.
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = !!open;
  }, [open]);

  async function quote(choices: Parameters<typeof quoteGenerations>[1]): Promise<GenQuote[]> {
    const res = await quoteGenerations(p.projectId, choices);
    const err = actionError(res);
    if (err || !res || "error" in res) return choices.map(() => ({ error: err ?? "No price." }));
    return res.costs.map((cost) => ({ credits: res.credits, cost }));
  }

  return (
    <GenerateWindow
      request={open}
      onClose={onClose}
      quote={quote}
      generate={async (choice, expectedCost, onSubmitted) => {
        if (!open) return { error: "Nothing to generate." };
        const res = await startGeneration(p.projectId, { shotId: open.shotId, choice, expectedCost });
        const err = actionError(res);
        if (err || !res || "error" in res) {
          return { error: err ?? "Could not start.", newCost: res && "newCost" in res ? res.newCost : undefined };
        }
        onSubmitted();
        router.refresh();
        // Wait while the window is open. Closing it hands the take to the strip.
        const deadline = Date.now() + 8 * 60 * 1000;
        while (openRef.current && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 3000));
          const c = await checkGeneration(p.projectId, res.genId);
          // A failed job carries its reason in `error` too, so the state is
          // read first; anything without one is a hiccup the next check retries.
          if (!c || !("state" in c)) continue;
          if (c.state === "done") {
            router.refresh();
            return { ok: true };
          }
          if (c.state === "failed") return { error: c.error };
        }
        return { error: "Still generating. It will land on the shot when it is done; you can close this window." };
      }}
    />
  );
}

function elapsed(fromIso: string | undefined, now: number): string {
  const t = fromIso ? Date.parse(fromIso) : NaN;
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Every take still being made, and the ones Higgsfield refused. It polls the
 * ones the viewer started (the job lives on their account), refreshes the page
 * when one lands, and lets a failure be cleared.
 */
export function InFlightGenerations({
  projectId,
  rows,
  shots,
  currentUserId,
}: {
  projectId: string;
  rows: AiGeneration[];
  shots: AiShot[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const titles = useMemo(() => new Map(shots.map((s) => [s.id, s.title || "a shot"])), [shots]);
  const mine = rows.filter((r) => r.status === "generating" && r.generated_by === currentUserId).map((r) => r.id);
  const key = mine.join(",");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const ids = key.split(",");
    (async () => {
      while (alive) {
        let landed = 0;
        for (const id of ids) {
          const c = await checkGeneration(projectId, id);
          if (!alive) return;
          if (c && "state" in c && (c.state === "done" || c.state === "failed")) landed++;
        }
        if (landed > 0) {
          router.refresh();
          return; // the refresh brings a new list, which starts its own loop
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, projectId, router]);

  const shown = rows.filter((r) => !dismissed.has(r.id));
  if (shown.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-[11px] border border-border bg-surface-2 p-2.5">
      {shown.map((r) => {
        const params = (r.params ?? {}) as { started_at?: string; error?: string };
        const failed = r.status === "failed";
        const theirs = r.generated_by !== currentUserId;
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${failed ? "" : "animate-pulse"}`}
              style={{ background: failed ? "var(--h-red)" : "var(--h-blue)" }}
            />
            <span className="font-semibold">{r.kind === "video" ? "Video take" : "Still"}</span>
            <span className="text-text-muted">
              for {titles.get(r.shot_id ?? "") ?? "a shot"} · {r.model ?? "Higgsfield"}
            </span>
            {failed ? (
              <>
                <span className="min-w-0 flex-1 text-text">{params.error ?? "Higgsfield could not make this one."}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent"
                  onClick={async () => {
                    setDismissed((d) => new Set(d).add(r.id));
                    const res = await dismissGeneration(projectId, r.id);
                    const err = actionError(res);
                    if (err) toast(err, "error");
                    router.refresh();
                  }}
                >
                  Dismiss
                </button>
              </>
            ) : (
              <span className="text-text-muted">
                {theirs ? "generating on a colleague's Higgsfield" : `generating on Higgsfield, ${elapsed(params.started_at, now)}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
