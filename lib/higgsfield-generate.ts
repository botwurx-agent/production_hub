// Generating a candidate on Higgsfield from inside Studio Flows: the models we
// offer (read live from Higgsfield's catalogue, see modelsFromCatalog), the
// options each one really takes, and what gets written down about a
// generation. Pure (no server-only) so the window and the server action read
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
  /** Who makes it (Google, Bytedance, Kling...), when Higgsfield says. */
  provider?: string;
  /** One line on what it is good for. */
  note: string;
  /** Empty when the model takes no aspect ratio at all. */
  aspects: string[];
  /** `steps` when the model takes only certain lengths. */
  duration?: { min: number; max: number; default: number; steps?: number[] };
  options: GenOption[];
  /** The roles this model's medias take. `videoRefs` is a VIDEO as a reference. */
  roles: { start?: string; end?: string; refs?: string; videoRefs?: string };
  /** How many reference images it takes, when it says. */
  maxRefs?: number;
  /**
   * Models with a generation-type `mode` (text to video, from frames, from
   * references) get it set from what is fed in rather than asked for.
   */
  autoMode?: "t2v" | "staged";
};

/**
 * The defaults (operator, 2026-11-04): Seedance 2.5 for video, the most used,
 * and Nano Banana 2.1 for stills. Every other model Higgsfield offers is one
 * pick away in the list, read live from their catalogue.
 */
export const DEFAULT_MODEL: Record<GenKind, string> = { video: "seedance_2_5", image: "nano_banana_2_1" };

/**
 * Used only when the live catalogue cannot be read, so the window still
 * works. Read off models_explore on 2026-11-04.
 */
export const FALLBACK_MODELS: GenModel[] = [
  {
    id: "nano_banana_2_1",
    name: "Nano Banana 2.1",
    kind: "image",
    provider: "Google",
    note: "Keeps the composition of a reference. Takes elements, reference images and video references.",
    aspects: ["16:9", "9:16", "4:5", "1:1", "21:9", "3:2", "2:3", "4:3", "3:4"],
    options: [resolutionOption(["1k", "2k", "4k"], "2k")],
    roles: { refs: "image_references", videoRefs: "video_references" },
  },
  {
    id: "seedance_2_5",
    name: "Seedance 2.5",
    kind: "video",
    provider: "Bytedance",
    note: "Start and end frames, elements, reference images and video references. Up to 30s.",
    aspects: ["16:9", "9:16", "21:9", "4:3", "1:1", "3:4"],
    duration: { min: 4, max: 30, default: 5 },
    options: [resolutionOption(["480p", "720p", "1080p"], "720p"), soundOption("generate_audio", "bool")],
    roles: { start: "start_image", end: "end_image", refs: "image_references", videoRefs: "video_references" },
    autoMode: "t2v",
  },
  {
    id: "kling3_0",
    name: "Kling 3.0",
    kind: "video",
    provider: "Kling",
    note: "Start and end frames only, no elements. Far cheaper.",
    aspects: ["16:9", "9:16", "1:1"],
    duration: { min: 3, max: 15, default: 5 },
    options: [
      { key: "mode", label: "Mode", values: [{ value: "std", label: "Standard" }, { value: "pro", label: "Pro" }, { value: "4k", label: "4K" }], default: "std" },
      soundOption("sound", "onoff"),
    ],
    roles: { start: "start_image", end: "end_image" },
  },
];

function resolutionOption(values: string[], def: string): GenOption {
  return { key: "resolution", label: "Resolution", values: values.map((v) => ({ value: v, label: valueLabel(v) })), default: def };
}

function soundOption(key: string, shape: "bool" | "onoff"): GenOption {
  const [off, on] = shape === "bool" ? ["false", "true"] : ["off", "on"];
  return { key, label: "Sound", values: [{ value: off, label: "Off" }, { value: on, label: "On" }], default: off };
}

// ---------------------------------------------------------------------------
// The live catalogue. models_explore list returns each model's parameters,
// media roles, aspect ratios and lengths; this turns that into what the
// window shows, so a model Higgsfield adds tomorrow (Kling 4.0 arrived this
// way) is in the list without a deploy. Prices are never read from here:
// they always come from generate_* with get_cost.

/** One item as models_explore list returns it. Everything is optional. */
export type CatalogItem = {
  id?: unknown;
  name?: unknown;
  provider_name?: unknown;
  description?: unknown;
  output_type?: unknown;
  parameters?: unknown;
  medias?: unknown;
  aspect_ratios?: unknown;
  duration_range?: unknown;
  durations?: unknown;
};

type CatalogParam = {
  name?: unknown;
  required?: unknown;
  type?: unknown;
  options?: unknown;
  default?: unknown;
  nullable?: unknown;
};

/**
 * Not generators: upscalers, cutouts, edits of an existing clip, lip sync,
 * marketing templates, presets and sprite sheets. They make sense on
 * Higgsfield and none of them makes a candidate from a prompt here.
 */
const NOT_A_GENERATOR =
  /upscale|background|remover|topaz|outpaint|decompose|image_command|dubbing|voice|sync_so|deflicker|depth|sam_3|fps_boost|reframe|marketing|ms_image|preset|ad_multiplier|autosprite|hf_mult|motion_control|video_edit|draw_to_video|intone|vector|recraft_v4_styles|soul_cast|soul_location|3d_jutsu|_shots$|soul_cinema_studio|image_auto|cinematic_studio_image$/;

/** Settings we never ask about: housekeeping, or handled by the app itself. */
const HIDDEN = new Set([
  "folder_id",
  "seed",
  "batch_size",
  "width",
  "height",
  "is_inpaint",
  "duration",
  "extension_mode",
  "multi_shots",
  "multi_shot_mode",
  "multi_prompt",
  "prompt_language",
  "enable_web_search",
  "enable_image_search",
  "enhance_prompt",
  "cfg_scale",
  "remove_bg",
]);

/** Higgsfield's own default where it is more than we would spend unasked. */
const DEFAULT_OVERRIDES: Record<string, Record<string, string>> = {
  // A still at 2K is what Make it real was priced at, and what reads on a board.
  nano_banana_2_1: { resolution: "2k" },
  gpt_image_2_5: { resolution: "2k", quality: "high" },
};

/** Lengths the list does not state, measured with models_explore get. */
const DURATION_OVERRIDES: Record<string, { min: number; max: number }> = {
  seedance_2_5: { min: 4, max: 30 },
  kling3_0: { min: 3, max: 15 },
};

const T2V_MODES = ["t2v", "omni_reference"];
const STAGED_MODES = ["text-to-video", "image-to-video", "reference-to-video"];

function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}
function nums(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0) : [];
}

/** "generate_audio" -> "Sound", "bitrate_mode" -> "Bitrate mode". */
function keyLabel(key: string): string {
  if (key === "generate_audio" || key === "sound" || key === "with_sound") return "Sound";
  const s = key.replace(/_id$/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "std" -> "Standard", "720p" stays, "high" -> "High". */
export function valueLabel(v: string): string {
  const known: Record<string, string> = { std: "Standard", pro: "Pro", "4k": "4K", "2k": "2K", "1k": "1K", "1.5k": "1.5K", xhigh: "Extra high", on: "On", off: "Off", true: "On", false: "Off" };
  if (known[v]) return known[v];
  if (/\d/.test(v)) return v;
  const s = v.replace(/[_-]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One catalogue item as a model the window offers, or null when it is not
 * something that makes a candidate from a prompt: a utility, one that needs a
 * setting we cannot fill (a style id from another screen), one that only
 * edits a clip, or one without a name.
 */
export function modelFromCatalog(item: CatalogItem, kind: GenKind): GenModel | null {
  const id = typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!/^[a-z0-9_]{2,60}$/.test(id) || !name || name === id) return null;
  if (item.output_type !== kind) return null;
  if (NOT_A_GENERATOR.test(id)) return null;

  const params = (Array.isArray(item.parameters) ? item.parameters : []) as CatalogParam[];
  let autoMode: GenModel["autoMode"];
  const options: GenOption[] = [];
  let durationParam: CatalogParam | null = null;

  for (const p of params) {
    const key = typeof p.name === "string" ? p.name : "";
    if (!key) continue;
    const opts = strs(p.options);
    // A generation-type mode is ours to set from the inputs.
    if (key === "mode" && opts.length && T2V_MODES.every((m) => opts.includes(m))) {
      autoMode = "t2v";
      continue;
    }
    if (key === "mode" && opts.length && STAGED_MODES.every((m) => opts.includes(m))) {
      autoMode = "staged";
      continue;
    }
    if (key === "duration") {
      durationParam = p;
      continue;
    }
    // A required setting we have no way to fill (a style or preset picked on
    // another screen) rules the model out rather than guessing.
    if (p.required === "required") return null;
    if (HIDDEN.has(key)) continue;
    const over = DEFAULT_OVERRIDES[id]?.[key];
    if (p.type === "bool") {
      if (p.default === undefined && p.nullable) continue;
      // Sound is off unless asked: a commercial lays its own audio, and it
      // costs more.
      const isSound = keyLabel(key) === "Sound";
      const def = isSound ? "false" : p.default === true ? "true" : "false";
      options.push({ key, label: keyLabel(key), values: [{ value: "false", label: "Off" }, { value: "true", label: "On" }], default: over ?? def });
      continue;
    }
    if (p.type === "string" && opts.length >= 2) {
      if (p.default === undefined && p.nullable) continue;
      const onOff = opts.length === 2 && opts.includes("on") && opts.includes("off");
      const values = (onOff ? ["off", "on"] : opts).map((v) => ({ value: v, label: valueLabel(v) }));
      const catDefault = typeof p.default === "string" && opts.includes(p.default) ? p.default : opts[0];
      const def = over && opts.includes(over) ? over : onOff && keyLabel(key) === "Sound" ? "off" : catDefault;
      options.push({ key, label: keyLabel(key), values, default: def });
    }
  }

  // Roles. A video model's "image" role is a start frame; an image model's is
  // a reference.
  const roleNames = new Set<string>();
  let maxRefs: number | undefined;
  for (const m of (Array.isArray(item.medias) ? item.medias : []) as { roles?: unknown; max?: unknown }[]) {
    for (const r of strs(m?.roles)) roleNames.add(r);
    if (typeof m?.max === "number" && m.max > 0) maxRefs = m.max;
  }
  const roles: GenModel["roles"] = {};
  if (roleNames.has("start_image")) roles.start = "start_image";
  if (roleNames.has("end_image")) roles.end = "end_image";
  if (roleNames.has("image_references")) roles.refs = "image_references";
  else if (kind === "image" && roleNames.has("image")) roles.refs = "image";
  if (roleNames.has("video_references")) roles.videoRefs = "video_references";
  // Something it could be made from, or nothing at all (text only). A model
  // whose only inputs are an existing clip or an avatar is an editor.
  const generative = roles.start || roles.refs || roleNames.size === 0 || (kind === "video" && roleNames.has("image"));
  if (!generative) return null;
  if (kind === "video" && !roles.start && roleNames.has("image")) roles.start = "image";

  let duration: GenModel["duration"];
  if (kind === "video") {
    const listed = nums(item.durations);
    const paramSteps = durationParam ? nums(durationParam.options) : [];
    const range = item.duration_range as { min?: unknown; max?: unknown } | undefined;
    const pDefault = typeof durationParam?.default === "number" ? durationParam.default : null;
    const steps = listed.length ? listed : paramSteps;
    if (steps.length) {
      const sorted = [...steps].sort((a, b) => a - b);
      const def = pDefault != null && sorted.includes(pDefault) ? pDefault : sorted.includes(5) ? 5 : sorted[0];
      duration = { min: sorted[0], max: sorted[sorted.length - 1], default: def, steps: sorted.length > 1 ? sorted : undefined };
    } else if (range && typeof range.min === "number" && typeof range.max === "number" && range.max >= range.min) {
      const def = pDefault != null ? pDefault : 5;
      duration = { min: range.min, max: range.max, default: Math.min(range.max, Math.max(range.min, def)) };
    } else if (DURATION_OVERRIDES[id]) {
      const o = DURATION_OVERRIDES[id];
      duration = { ...o, default: Math.min(o.max, Math.max(o.min, pDefault ?? 5)) };
    } else if (durationParam) {
      // Length taken but its range not stated: a common span, and the price
      // check refuses a length the model does not take before anything is spent.
      const def = pDefault ?? 5;
      duration = { min: Math.min(3, def), max: Math.max(15, def), default: def };
    }
  }

  const aspects = strs(item.aspect_ratios);
  const description = typeof item.description === "string" ? item.description.trim() : "";
  return {
    id,
    name,
    kind,
    provider: typeof item.provider_name === "string" && item.provider_name.trim() ? item.provider_name.trim() : undefined,
    note: description.slice(0, 200),
    aspects,
    duration,
    options,
    roles,
    maxRefs: roles.refs ? maxRefs : undefined,
    autoMode,
  };
}

/** The list the window offers for one kind: the default first, then Higgsfield's own order. */
export function modelsFromCatalog(items: unknown, kind: GenKind): GenModel[] {
  const out: GenModel[] = [];
  const seen = new Set<string>();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== "object") continue;
    const m = modelFromCatalog(it as CatalogItem, kind);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  // Two catalogue entries can share a name (Cinema Studio Video and its v2).
  // In a list that reads as a duplicate, so the later one takes its version.
  const names = new Map<string, number>();
  for (const m of out) {
    const n = (names.get(m.name) ?? 0) + 1;
    names.set(m.name, n);
    if (n > 1) {
      const v = /_v(\d+)$/.exec(m.id)?.[1];
      m.name = `${m.name} ${v ? `v${v}` : `(${n})`}`;
    }
  }
  const d = out.findIndex((m) => m.id === DEFAULT_MODEL[kind]);
  if (d > 0) out.unshift(...out.splice(d, 1));
  return out;
}

/** A model by id out of a list (the catalogue, or the fallback). */
export function findModel(models: GenModel[], id: unknown): GenModel | null {
  return models.find((m) => m.id === id) ?? null;
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
export function cleanChoice(v: unknown, models: GenModel[]): GenChoice | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const model = findModel(models, o.modelId);
  if (!model) return null;
  const prompt = (typeof o.prompt === "string" ? o.prompt : "").replace(/\s+/g, " ").trim().slice(0, MAX_GEN_PROMPT);
  const aspect = typeof o.aspect === "string" && model.aspects.includes(o.aspect) ? o.aspect : (model.aspects[0] ?? "");
  let duration: number | null = null;
  if (model.duration) {
    const n = typeof o.duration === "number" ? o.duration : Number(o.duration);
    duration = Number.isFinite(n) && n > 0 ? Math.round(Math.min(model.duration.max, Math.max(model.duration.min, n))) : model.duration.default;
    const steps = model.duration.steps;
    if (steps?.length) duration = steps.reduce((best, s) => (Math.abs(s - (duration as number)) < Math.abs(best - (duration as number)) ? s : best), steps[0]);
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
  let refs = 0;
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
    if (role === "ref" && source !== "video") {
      if (model.maxRefs != null && refs >= model.maxRefs) continue;
      refs++;
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
export function genParams(choice: GenChoice, model: GenModel): Record<string, unknown> {
  const out: Record<string, unknown> = { model: model.id, count: 1 };
  if (choice.aspect) out.aspect_ratio = choice.aspect;
  if (choice.duration != null) out.duration = choice.duration;
  const bools = new Set(model.options.filter((o) => o.values.some((x) => x.value === "true")).map((o) => o.key));
  for (const [k, v] of Object.entries(choice.options)) out[k] = bools.has(k) ? v === "true" : v;
  const used = choice.inputs.filter((i) => takesInput(model, i));
  if (model.autoMode === "t2v") out.mode = used.length > 0 ? "omni_reference" : "t2v";
  if (model.autoMode === "staged") {
    const frames = used.some((i) => i.role === "start" || i.role === "end");
    out.mode = frames ? "image-to-video" : used.length ? "reference-to-video" : "text-to-video";
  }
  return out;
}

/**
 * What is written down about a generation, in the producer's words, so the
 * window can say it before anything is spent. Resolution and length are read
 * off the FILE when it lands rather than trusted from the request.
 */
export function provenanceLines(choice: GenChoice, model: GenModel | null, inputLabels: Record<string, string>): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    { label: "Platform", value: "Higgsfield" },
    { label: "Model", value: model?.name ?? choice.modelId },
    { label: "Prompt", value: choice.prompt || "(none)" },
  ];
  if (choice.aspect) lines.push({ label: "Aspect", value: choice.aspect });
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
