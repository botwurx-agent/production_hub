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
  /** The roles this model's medias take. `videoRefs` is a VIDEO as a reference. */
  roles: { start?: string; end?: string; refs?: string; videoRefs?: string };
};

/**
 * Order matters: the FIRST model of each kind is the default (operator,
 * 2026-11-04: Nano Banana 2.1 for stills, Seedance 2.5 for video). The others
 * stay one press away with their own price on the card.
 */
export const GEN_MODELS: GenModel[] = [
  {
    id: "nano_banana_2_1",
    name: "Nano Banana 2.1",
    kind: "image",
    note: "Keeps the composition of a reference. Takes elements, reference images and video references.",
    aspects: ["16:9", "9:16", "4:5", "1:1", "21:9", "3:2", "2:3", "4:3", "3:4"],
    options: [],
    roles: { refs: "image_references", videoRefs: "video_references" },
  },
  {
    id: "gpt_image_2_5",
    name: "GPT Image 2.5",
    kind: "image",
    note: "Best at legible type and packaging. Takes reference images.",
    aspects: ["16:9", "9:16", "4:5", "1:1", "21:9", "3:2", "2:3", "4:3", "3:4"],
    options: [],
    roles: { refs: "image_references" },
  },
  {
    id: "seedance_2_5",
    name: "Seedance 2.5",
    kind: "video",
    note: "Start and end frames, elements, reference images and video references. Up to 30s.",
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
    roles: { start: "start_image", end: "end_image", refs: "image_references", videoRefs: "video_references" },
  },
  {
    id: "kling3_0",
    name: "Kling 3.0",
    kind: "video",
    note: "Start and end frames only, no elements. Far cheaper.",
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

/**
 * Where an input came from: a still on the shot (a frame, a candidate or a
 * reference image), a saved element, or a VIDEO on the shot (a take or a motion
 * clip), which can only ever be a video reference.
 */
export type GenInputSource = "frame" | "element" | "video";

export type GenInput = { genId: string; role: GenInputRole; source: GenInputSource };

export type GenChoice = {
  modelId: string;
  prompt: string;
  aspect: string;
  duration: number | null;
  options: Record<string, string>;
  /** Generations on this shot fed in, with what each is for. */
  inputs: GenInput[];
};

function isSource(v: unknown): v is GenInputSource {
  return v === "frame" || v === "element" || v === "video";
}

export const MAX_GEN_PROMPT = 3000;
/** Inputs on one generation. A runaway list is a mistake, not a brief. */
export const MAX_INPUTS = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const inputs: GenInput[] = [];
  let start = false;
  let end = false;
  for (const it of Array.isArray(o.inputs) ? o.inputs.slice(0, MAX_INPUTS) : []) {
    if (!it || typeof it !== "object") continue;
    const { genId, role, source: rawSource } = it as { genId?: unknown; role?: unknown; source?: unknown };
    if (typeof genId !== "string" || !UUID.test(genId) || seen.has(genId)) continue;
    const source: GenInputSource = isSource(rawSource) ? rawSource : "frame";
    if (role !== "start" && role !== "end" && role !== "ref") continue;
    if (!rolesFor(model, source).includes(role)) continue;
    if (role === "start") {
      if (start) continue;
      start = true;
    }
    if (role === "end") {
      if (end) continue;
      end = true;
    }
    seen.add(genId);
    inputs.push({ genId, role, source });
  }
  return { modelId: model.id, prompt, aspect, duration, options, inputs };
}

/**
 * What an input may be used as on this model. A still on the shot can be the
 * start frame, the end frame or a reference; an element is only ever a
 * reference, since it is a character or a product rather than a moment; a
 * video is only ever a video reference, since a frame has to be a picture.
 */
export function rolesFor(model: GenModel, source: GenInputSource): GenInputRole[] {
  if (source === "video") return model.roles.videoRefs ? ["ref"] : [];
  const out: GenInputRole[] = [];
  if (source === "frame" && model.roles.start) out.push("start");
  if (source === "frame" && model.roles.end) out.push("end");
  if (model.roles.refs) out.push("ref");
  return out;
}

export function takesInput(model: GenModel, input: { role: GenInputRole; source: GenInputSource }): boolean {
  return rolesFor(model, input.source).includes(input.role);
}

/** The role name Higgsfield expects for an input on this model, or null. */
export function mediaRole(model: GenModel, input: { role: GenInputRole; source: GenInputSource }): string | null {
  if (!takesInput(model, input)) return null;
  if (input.role === "start") return model.roles.start ?? null;
  if (input.role === "end") return model.roles.end ?? null;
  return (input.source === "video" ? model.roles.videoRefs : model.roles.refs) ?? null;
}

/** What a model does not take, said once, so a dropped input is never silent. */
export function droppedInputs(model: GenModel, inputs: { role: GenInputRole; source: GenInputSource }[]): string | null {
  const left = inputs.filter((i) => !takesInput(model, i));
  if (left.length === 0) return null;
  const takes: string[] = [];
  if (model.roles.start) takes.push("start and end frames");
  if (model.roles.refs) takes.push("reference images");
  if (model.roles.videoRefs) takes.push("video references");
  const what = takes.length ? `${takes.join(" and ")} only` : "the prompt only";
  return `${model.name} takes ${what}, so ${left.length === 1 ? "one input is" : `${left.length} inputs are`} left out.`;
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
  const ins = choice.inputs
    .filter((i) => !!model && takesInput(model, i))
    .map((i) => `${inputWord(i)}: ${inputLabels[i.genId] ?? "a frame"}`);
  lines.push({ label: "Built from", value: ins.length ? ins.join(", ") : "The prompt alone" });
  lines.push({ label: "Seed and job", value: "As Higgsfield reports them" });
  lines.push({ label: "Cost", value: "The credits charged" });
  return lines;
}

/** What an input is called on screen and in the record. */
export function inputWord(i: { role: GenInputRole; source: GenInputSource }): string {
  if (i.role === "start") return "Start frame";
  if (i.role === "end") return "End frame";
  if (i.source === "element") return "Element";
  if (i.source === "video") return "Video reference";
  return "Reference";
}

/** "35 credits", "6.25 credits", "1 credit". */
export function creditsWord(n: number): string {
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${s} ${n === 1 ? "credit" : "credits"}`;
}
