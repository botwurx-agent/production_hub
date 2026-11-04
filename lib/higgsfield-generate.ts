// Generating a candidate on Higgsfield from inside Studio Flows: the models we
// offer, the options each one really takes, and what gets written down about
// a generation. Pure (no server-only) so the window and the server action read
// the same rules and both can be tested.
//
// Every option here was read off Higgsfield's own model catalogue
// (models_explore get) on 2026-11-04, and the prices quoted in the window come
// from generate_* with get_cost, which spends nothing. Measured then: Seedance
// 2.5 at 5s 720p is 35 credits, Kling 3.0 at 5s std with sound off is 6.25, a
// Nano Banana 2.1 still at 2K is 2. Do not add a model or an option from memory:
// a wrong option name is ignored or refused by their server, and a wrong price
// is the one thing this window must never show.

export type GenKind = "image" | "video";

export type GenOption = {
  key: string;
  label: string;
  values: { value: string; label: string }[];
  default: string;
};

export type GenModel = {
  id: string;
  name: string;
  kind: GenKind;
  /** One line on what it is good for, in production words. */
  note: string;
  aspects: string[];
  duration?: { min: number; max: number; default: number };
  options: GenOption[];
  /** The roles this model's medias take. */
  roles: { start?: string; end?: string; refs?: string };
};

export const GEN_MODELS: GenModel[] = [
  {
    id: "nano_banana_2_1",
    name: "Nano Banana 2.1",
    kind: "image",
    note: "Keeps the composition of a reference. Cheapest still.",
    aspects: ["16:9", "9:16", "4:5", "1:1", "21:9"],
    options: [],
    roles: { refs: "image_references" },
  },
  {
    id: "gpt_image_2_5",
    name: "GPT Image 2.5",
    kind: "image",
    note: "Best at legible type and packaging.",
    aspects: ["16:9", "9:16", "4:5", "1:1", "21:9"],
    options: [],
    roles: { refs: "image_references" },
  },
  {
    id: "kling3_0",
    name: "Kling 3.0",
    kind: "video",
    note: "Start and end frames only. Much cheaper.",
    aspects: ["16:9", "9:16", "1:1"],
    duration: { min: 3, max: 15, default: 5 },
    options: [
      {
        key: "mode",
        label: "Quality",
        values: [
          { value: "std", label: "Standard" },
          { value: "pro", label: "Pro" },
          { value: "4k", label: "4K" },
        ],
        default: "std",
      },
      {
        key: "sound",
        label: "Sound",
        values: [
          { value: "off", label: "Off" },
          { value: "on", label: "On" },
        ],
        default: "off",
      },
    ],
    roles: { start: "start_image", end: "end_image" },
  },
  {
    id: "seedance_2_5",
    name: "Seedance 2.5",
    kind: "video",
    note: "Frames plus your elements as references, up to 30s.",
    aspects: ["16:9", "9:16", "21:9", "4:3", "1:1", "3:4"],
    duration: { min: 4, max: 30, default: 5 },
    options: [
      {
        key: "resolution",
        label: "Resolution",
        values: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        default: "720p",
      },
      {
        key: "generate_audio",
        label: "Sound",
        values: [
          { value: "false", label: "Off" },
          { value: "true", label: "On" },
        ],
        default: "false",
      },
    ],
    roles: { start: "start_image", end: "end_image", refs: "image_references" },
  },
];

/** Stills get 2K, which is what Make it real was priced at. */
const IMAGE_FIXED: Record<string, Record<string, string>> = {
  nano_banana_2_1: { resolution: "2k" },
  gpt_image_2_5: { resolution: "2k", quality: "high" },
};

export function genModel(id: unknown): GenModel | null {
  return GEN_MODELS.find((m) => m.id === id) ?? null;
}

export function modelsFor(kind: GenKind): GenModel[] {
  return GEN_MODELS.filter((m) => m.kind === kind);
}

export type GenInputRole = "start" | "end" | "ref";

export type GenChoice = {
  modelId: string;
  prompt: string;
  aspect: string;
  duration: number | null;
  options: Record<string, string>;
  /** Generations on this shot fed in, with what each is for. */
  inputs: { genId: string; role: GenInputRole }[];
};

export const MAX_GEN_PROMPT = 3000;

/**
 * The choice as it may be sent: model known, aspect and options among the
 * model's own, duration clamped and whole, prompt trimmed and capped, inputs
 * the model can take (one start, one end, refs only where it takes refs).
 * It comes back from the browser, so this runs on the server too.
 */
export function cleanChoice(v: unknown): GenChoice | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const model = genModel(o.modelId);
  if (!model) return null;
  const prompt = (typeof o.prompt === "string" ? o.prompt : "").replace(/\s+/g, " ").trim().slice(0, MAX_GEN_PROMPT);
  const aspect = typeof o.aspect === "string" && model.aspects.includes(o.aspect) ? o.aspect : model.aspects[0];
  let duration: number | null = null;
  if (model.duration) {
    const n = typeof o.duration === "number" ? o.duration : Number(o.duration);
    duration = Number.isFinite(n) && n > 0 ? Math.round(Math.min(model.duration.max, Math.max(model.duration.min, n))) : model.duration.default;
  }
  const raw = o.options && typeof o.options === "object" ? (o.options as Record<string, unknown>) : {};
  const options: Record<string, string> = {};
  for (const opt of model.options) {
    const val = raw[opt.key];
    options[opt.key] = typeof val === "string" && opt.values.some((x) => x.value === val) ? val : opt.default;
  }
  const seen = new Set<string>();
  const inputs: GenChoice["inputs"] = [];
  let start = false;
  let end = false;
  for (const it of Array.isArray(o.inputs) ? o.inputs.slice(0, 12) : []) {
    if (!it || typeof it !== "object") continue;
    const { genId, role } = it as { genId?: unknown; role?: unknown };
    if (typeof genId !== "string" || !/^[0-9a-f-]{36}$/i.test(genId) || seen.has(genId)) continue;
    if (role === "start" && model.roles.start && !start) start = true;
    else if (role === "end" && model.roles.end && !end) end = true;
    else if (role === "ref" && model.roles.refs) {
      /* any number */
    } else continue;
    seen.add(genId);
    inputs.push({ genId, role: role as GenInputRole });
  }
  return { modelId: model.id, prompt, aspect, duration, options, inputs };
}

/** What a model does not take, said once, so a dropped input is never silent. */
export function droppedInputs(model: GenModel, inputs: { role: GenInputRole }[]): string | null {
  const refs = inputs.filter((i) => i.role === "ref").length;
  if (refs > 0 && !model.roles.refs) {
    return `${model.name} takes frames only, so ${refs === 1 ? "the element is" : `the ${refs} elements are`} left out.`;
  }
  return null;
}

/** The params sent to generate_*, apart from medias (which need Higgsfield's ids). */
export function genParams(choice: GenChoice): Record<string, unknown> {
  const model = genModel(choice.modelId);
  if (!model) return {};
  const out: Record<string, unknown> = { model: model.id, aspect_ratio: choice.aspect, count: 1 };
  if (model.kind === "image") Object.assign(out, IMAGE_FIXED[model.id] ?? {});
  if (choice.duration != null) out.duration = choice.duration;
  for (const [k, v] of Object.entries(choice.options)) out[k] = v === "true" ? true : v === "false" ? false : v;
  if (model.id === "seedance_2_5") out.mode = choice.inputs.length > 0 ? "omni_reference" : "t2v";
  return out;
}

/**
 * What is written down about a generation, in the producer's words, so the
 * window can say it before anything is spent. Resolution and length are read
 * off the FILE when it lands rather than trusted from the request.
 */
export function provenanceLines(choice: GenChoice, inputLabels: Record<string, string>): { label: string; value: string }[] {
  const model = genModel(choice.modelId);
  const lines: { label: string; value: string }[] = [
    { label: "Platform", value: "Higgsfield" },
    { label: "Model", value: model?.name ?? choice.modelId },
    { label: "Prompt", value: choice.prompt || "(none)" },
    { label: "Aspect", value: choice.aspect },
  ];
  if (choice.duration != null) lines.push({ label: "Length", value: `${choice.duration}s asked, measured from the file` });
  for (const opt of model?.options ?? []) {
    const v = opt.values.find((x) => x.value === choice.options[opt.key]);
    if (v) lines.push({ label: opt.label, value: v.label });
  }
  lines.push({ label: "Resolution", value: "Measured from the file" });
  const takes = (r: GenInputRole) => (r === "ref" ? !!model?.roles.refs : r === "start" ? !!model?.roles.start : !!model?.roles.end);
  const ins = choice.inputs.filter((i) => takes(i.role)).map((i) => `${i.role === "ref" ? "Element" : i.role === "start" ? "Start" : "End"}: ${inputLabels[i.genId] ?? "a frame"}`);
  lines.push({ label: "Built from", value: ins.length ? ins.join(", ") : "The prompt alone" });
  lines.push({ label: "Seed and job", value: "As Higgsfield reports them" });
  lines.push({ label: "Cost", value: "The credits charged" });
  return lines;
}

/** "35 credits", "6.25 credits", "1 credit". */
export function creditsWord(n: number): string {
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${s} ${n === 1 ? "credit" : "credits"}`;
}
