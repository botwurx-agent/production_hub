"use client";

import { useEffect, useState } from "react";
import { PipelineMap, type GenerateAsk } from "@/components/production/pipeline-map";
import { GenerateWindow, type GenerateRequest, type GenInputOption, type GenQuote } from "@/components/production/higgsfield-generate";
import { FALLBACK_MODELS, modelsFromCatalog, type GenChoice } from "@/lib/higgsfield-generate";
// A copy of Higgsfield's video catalogue (models_explore list, 2026-11-04),
// run through the same converter the live window uses.
import catalogSample from "./catalog-sample.json";
import { parsePositions, type MapGeneration, type MapInput, type MapPositions } from "@/lib/pipeline-map";

// Drawn stand-ins, obviously not screenshots.
const pic = (label: string, a: string, b: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="232" cy="62" r="34" fill="rgba(255,255,255,.35)"/><path d="M0 150 Q80 110 160 140 T320 128 V180 H0Z" fill="rgba(0,0,0,.22)"/><text x="14" y="166" font-family="sans-serif" font-size="18" font-weight="bold" fill="#fff">${label}</text></svg>`
  );

let t = 0;
const g = (id: string, shot: string, kind: "image" | "video" | "audio", extra: Partial<MapGeneration> = {}): MapGeneration => ({
  id,
  shot_id: shot,
  stage: kind,
  kind,
  status: "candidate",
  role: null,
  starred: false,
  platform: "Higgsfield",
  model: kind === "video" ? "seedance_2_5" : kind === "audio" ? "elevenlabs_v3" : "nano_banana_2",
  prompt: null,
  parent_start_id: null,
  parent_end_id: null,
  created_at: new Date(Date.UTC(2026, 9, 1, 0, t++)).toISOString(),
  ...extra,
});

const INPUT: MapInput = {
  shots: [
    { id: "s1", position: 0, title: "Sunrise over the lake", status: "approved", method: "generated", stage: "video", input_mode: "frames" },
    { id: "s2", position: 1, title: "Can cracks open, slow motion", status: "in_progress", method: "generated", stage: "video", input_mode: "image_to_video" },
    { id: "s3", position: 2, title: "Maya runs the jetty", status: "in_progress", method: "generated", stage: "video", input_mode: "video_to_video" },
    { id: "s4", position: 3, title: "Friends at the dock", status: "in_progress", method: "generated", stage: "image", input_mode: "frames" },
    { id: "s5", position: 4, title: "End card", status: "in_progress", method: "generated", stage: "video", input_mode: "text_to_video" },
  ],
  elements: [
    { id: "e1", name: "Maya", kind: "character" },
    { id: "e2", name: "Lake house jetty", kind: "location" },
    { id: "e3", name: "Golden Hour can", kind: "element" },
    { id: "e4", name: "Linen summer look", kind: "wardrobe" },
  ],
  uses: [
    { shot_id: "s1", entity_id: "e2" },
    { shot_id: "s2", entity_id: "e3" },
    { shot_id: "s3", entity_id: "e1" },
    { shot_id: "s3", entity_id: "e2" },
    { shot_id: "s3", entity_id: "e4" },
    { shot_id: "s4", entity_id: "e1" },
    { shot_id: "s4", entity_id: "e3" },
    { shot_id: "s4", entity_id: "e4" },
    { shot_id: "s5", entity_id: "e3" },
  ],
  generations: [
    // 1: two frames tagged start/end, two rejected, one take built from both
    g("a1", "s1", "image", { role: "start", status: "approved", prompt: "Wide, mist on the lake, first light breaking over the pines" }),
    g("a2", "s1", "image", { role: "end", status: "approved", prompt: "Same wide, sun clear of the treeline, warm flare" }),
    g("a3", "s1", "image", { status: "rejected" }),
    g("a4", "s1", "image", { status: "rejected" }),
    g("a5", "s1", "video", { role: "take", status: "approved", parent_start_id: "a1", parent_end_id: "a2" }),
    g("a6", "s1", "video", { status: "rejected", parent_start_id: "a1", parent_end_id: "a2" }),
    // 2: one frame, three takes from it, one shortlisted
    g("b1", "s2", "image", { role: "start", status: "approved", prompt: "Macro, condensation beading on the can" }),
    g("b2", "s2", "image", { starred: true }),
    g("b3", "s2", "video", { parent_start_id: "b1", starred: true }),
    g("b4", "s2", "video", { parent_start_id: "b1" }),
    g("b5", "s2", "video", { parent_start_id: "b1", role: "take", status: "approved" }),
    // 3: v2v off a motion reference, with a style reference
    g("c1", "s3", "video", { status: "reference", role: "motion", platform: null, model: null }),
    g("c2", "s3", "image", { status: "reference", role: "style", platform: null, model: null }),
    g("c3", "s3", "video", { starred: true }),
    g("c4", "s3", "video", {}),
    // 4: frames still being chosen
    g("d1", "s4", "image", { starred: true }),
    g("d2", "s4", "image", {}),
    g("d3", "s4", "image", {}),
    g("d4", "s4", "image", { status: "rejected" }),
    // 5: text to video plus the voiceover read
    g("f1", "s5", "video", { role: "take", status: "approved" }),
    g("f2", "s5", "audio", { role: "take", status: "approved", platform: "ElevenLabs", model: "v3" }),
  ],
  refs: [
    { generation_id: "c3", ref_generation_id: "c1", role: "motion" },
    { generation_id: "c3", ref_generation_id: "c2", role: "style" },
    { generation_id: "c4", ref_generation_id: "c1", role: "motion" },
  ],
  cut: { name: "Golden Hour :30", versions: [{ id: "v1", version_number: 1, review: "changes" }, { id: "v2", version_number: 2, review: "pending" }] },
  reviewingShotIds: ["s2"],
};

const PALETTE: [string, string][] = [
  ["#f2b45c", "#c75b39"], ["#7fb6d8", "#2f5f8a"], ["#e9c46a", "#8a5a2b"], ["#9ad1b0", "#2f7a5b"], ["#d6a3c9", "#6d3d78"], ["#f4a261", "#e76f51"],
];
const THUMBS: Record<string, string> = {};
INPUT.generations.forEach((x, i) => {
  const [a, b] = PALETTE[i % PALETTE.length];
  THUMBS[x.id] = pic(x.kind === "audio" ? "VO" : x.id.toUpperCase(), a, b);
});
const EL_THUMBS: Record<string, string> = { e1: pic("", "#d9a07b", "#6b3f2a"), e2: pic("", "#7fb6d8", "#355c45"), e3: pic("", "#f2d06b", "#c7782e"), e4: pic("", "#efe6d2", "#a8957a") };

const KEY = "pipeline.map.fixture";

// EXAMPLE PRICES ONLY. Anchored on three real quotes taken 2026-11-04 (Seedance
// 2.5 5s 720p = 35, Kling 3.0 5s std sound off = 6.25, Nano Banana 2.1 = 2) and
// scaled by guesswork for the other settings. The real window asks Higgsfield.
function examplePrice(c: GenChoice): number {
  const d = c.duration ?? 5;
  if (c.modelId === "nano_banana_2_1") return 2;
  if (c.modelId === "gpt_image_2_5") return 2.75;
  if (c.modelId === "kling3_0") {
    const q = c.options.mode === "4k" ? 3 : c.options.mode === "pro" ? 1.6 : 1;
    return Math.round(1.25 * d * q * (c.options.sound === "on" ? 1.5 : 1) * 100) / 100;
  }
  if (c.modelId !== "seedance_2_5") return Math.round(1.5 * d * 100) / 100;
  const r = c.options.resolution === "1080p" ? 2.25 : c.options.resolution === "480p" ? 0.5 : 1;
  return Math.round(7 * d * r * (c.options.generate_audio === "true" ? 1.3 : 1) * 100) / 100;
}
const EXAMPLE_BALANCE = 1240;
const LOAD_MODELS = async (kind: "image" | "video") => {
  await wait(300);
  return { models: kind === "video" ? modelsFromCatalog(catalogSample, "video") : FALLBACK_MODELS.filter((m) => m.kind === "image"), live: true };
};

const genById = new Map(INPUT.generations.map((x) => [x.id, x]));
const shotById = new Map(INPUT.shots.map((x) => [x.id, x]));
const elName = new Map(INPUT.elements.map((e) => [e.id, e.name]));

function frameOpt(id: string, role: "start" | "end" | "ref"): GenInputOption | null {
  const x = genById.get(id);
  if (!x) return null;
  return { genId: id, label: x.prompt ? x.prompt.slice(0, 40) : id.toUpperCase(), thumb: THUMBS[id] ?? null, role, source: "frame" };
}

/** What the real page does from its own data: frames and elements preselected. */
function requestFor(ask: GenerateAsk): GenerateRequest | null {
  const shot = shotById.get(ask.shotId);
  if (!shot) return null;
  const gens = INPUT.generations.filter((x) => x.shot_id === shot.id);
  const from = ask.fromGenId ? genById.get(ask.fromGenId) : undefined;
  const elements: GenInputOption[] = INPUT.uses
    .filter((u) => u.shot_id === shot.id)
    .map((u) => ({ genId: `el-${u.entity_id}`, label: elName.get(u.entity_id) ?? "Element", thumb: EL_THUMBS[u.entity_id] ?? null, role: "ref" as const, source: "element" as const }));
  const start = gens.find((x) => x.role === "start");
  const end = gens.find((x) => x.role === "end");
  let kind: "image" | "video" = "video";
  let inputs: GenInputOption[] = [];
  if (ask.mode === "still" || (ask.mode === "again" && from?.kind === "image")) {
    kind = "image";
    inputs = elements;
  } else if (ask.mode === "take" && from) {
    inputs = [frameOpt(from.id, "start"), ...elements].filter(Boolean) as GenInputOption[];
  } else if (ask.mode === "again" && from) {
    inputs = [from.parent_start_id && frameOpt(from.parent_start_id, "start"), from.parent_end_id && frameOpt(from.parent_end_id, "end"), ...elements].filter(Boolean) as GenInputOption[];
  } else {
    inputs = [start && frameOpt(start.id, "start"), end && frameOpt(end.id, "end"), ...elements].filter(Boolean) as GenInputOption[];
  }
  const prompt = from?.prompt ?? start?.prompt ?? shot.title;
  // Everything else on the shot: its still pictures (frames, candidates and
  // reference images, never rejected ones) and its elements.
  const available = [
    ...gens.filter((x) => x.kind === "image" && x.status !== "rejected").map((x) => frameOpt(x.id, x.status === "reference" ? "ref" : x.role === "end" ? "end" : "start")),
    ...gens
      .filter((x) => x.kind === "video" && x.status !== "rejected")
      .map((x): GenInputOption => ({
        genId: x.id,
        label: x.role === "motion" ? "Motion reference" : `Take ${x.id.toUpperCase()}`,
        thumb: (x.parent_start_id && THUMBS[x.parent_start_id]) || THUMBS[x.id] || null,
        role: "ref",
        source: "video",
      })),
    ...elements,
  ].filter(Boolean) as GenInputOption[];
  return { kind, shotId: shot.id, shotTitle: shot.title, inputs, available, defaultPrompt: prompt, defaultAspect: "16:9" };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function MapFixture() {
  const [positions, setPositions] = useState<MapPositions>({});
  const [gen, setGen] = useState<GenerateRequest | null>(null);
  useEffect(() => {
    try {
      setPositions(parsePositions(JSON.parse(localStorage.getItem(KEY) || "{}")));
    } catch {}
  }, []);
  return (
    <>
    <PipelineMap
      input={INPUT}
      thumbs={THUMBS}
      elementThumbs={EL_THUMBS}
      cutThumb={pic("v2", "#f2b45c", "#2f5f8a")}
      positions={positions}
      onPositionsChange={(next) => {
        setPositions(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
      }}
      onOpenShot={(id) => alert(`Would open shot ${id} in the pipeline`)}
      onGenerate={(ask) => setGen(requestFor(ask))}
    />
    <GenerateWindow
      request={gen}
      onClose={() => setGen(null)}
      loadModels={LOAD_MODELS}
      quote={async (cs): Promise<GenQuote[]> => {
        await wait(400);
        return cs.map((c) => ({ credits: EXAMPLE_BALANCE, cost: examplePrice(c) }));
      }}
      generate={async (_c, _cost, onSubmitted) => {
        await wait(900);
        onSubmitted();
        await wait(2500);
        return { ok: true };
      }}
    />
    </>
  );
}
