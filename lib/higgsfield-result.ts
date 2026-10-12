// Reading Higgsfield's MCP tool results. Pure (no server-only) so it can be
// tested against the bodies the live server actually sends.
//
// An MCP tool is described for an AI agent, not published as an API, so these
// readers are tolerant on purpose: a result may carry its data as
// structuredContent, as JSON inside a text block, or as plain text. Each
// reader looks for the thing it needs by meaning (a uuid under an id-like key,
// an https link, a status word) rather than at one fixed path, and returns
// null rather than guessing when it is not there.

export type ToolResult = {
  content?: { type?: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every text block joined, for an error message or a fallback parse. */
export function resultText(r: ToolResult | null | undefined): string {
  return (r?.content ?? [])
    .map((c) => (typeof c?.text === "string" ? c.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** The result's data: structuredContent when present, else JSON in the text. */
export function resultData(r: ToolResult | null | undefined): unknown {
  if (!r) return null;
  if (r.structuredContent !== undefined && r.structuredContent !== null) return r.structuredContent;
  const text = resultText(r);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* not JSON */
      }
    }
    return text;
  }
}

type Hit = { key: string; value: string; depth: number };

function walk(v: unknown, key: string, depth: number, out: Hit[]) {
  if (depth > 8 || out.length > 400) return;
  if (typeof v === "string") {
    out.push({ key, value: v, depth });
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, key, depth + 1, out);
    return;
  }
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k, depth + 1, out);
  }
}

function hits(v: unknown): Hit[] {
  const out: Hit[] = [];
  walk(v, "", 0, out);
  return out;
}

/**
 * The first uuid found under one of `keys`, tried in order, else under any key
 * ending in "id". A bare uuid string as the whole result counts too.
 */
export function findId(data: unknown, keys: string[]): string | null {
  if (typeof data === "string") {
    const t = data.trim();
    if (UUID.test(t)) return t;
    const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0] : null;
  }
  const all = hits(data).filter((h) => UUID.test(h.value));
  for (const k of keys) {
    const hit = all.find((h) => h.key.toLowerCase() === k.toLowerCase());
    if (hit) return hit.value;
  }
  const loose = all.find((h) => /id$/i.test(h.key));
  return loose?.value ?? null;
}

const DONE = new Set(["completed", "complete", "succeeded", "success", "done", "finished"]);
const FAILED = new Set(["failed", "error", "errored", "canceled", "cancelled", "rejected", "nsfw", "ip_detected", "expired"]);

export type JobState =
  | { state: "done"; url: string }
  | { state: "failed"; reason: string }
  | { state: "pending" };

/**
 * Where a generation job stands, read from a jobs_wait or job_status result.
 * A finished job must carry an image link to count as done: a "completed"
 * status with no link is reported as pending rather than as a result, since
 * there is nothing to show yet.
 */
export function readJob(data: unknown): JobState {
  const all = hits(data);
  const status = all.find((h) => /^(status|state)$/i.test(h.key))?.value.toLowerCase().trim() ?? "";
  if (FAILED.has(status)) {
    const reason =
      all.find((h) => /^(error|reason|fail_reason|message|detail)$/i.test(h.key))?.value ?? status;
    return { state: "failed", reason: reason.slice(0, 300) };
  }
  const links = all.filter((h) => /^https:\/\//i.test(h.value));
  // The full image, never the small preview Higgsfield also returns.
  const url =
    links.find((h) => /^raw_?url$/i.test(h.key))?.value ??
    links.find((h) => !/min|thumb|preview/i.test(h.key) && !/_min\.\w+($|\?)/i.test(h.value))?.value ??
    null;
  if (url && (DONE.has(status) || !status)) return { state: "done", url };
  return { state: "pending" };
}

/** Higgsfield's aspect name for a scene builder frame aspect. */
export function hfAspect(aspectId: string): string {
  switch (aspectId) {
    case "239":
      return "21:9";
    case "4x5":
      return "4:5";
    case "9x16":
      return "9:16";
    case "1x1":
      return "1:1";
    default:
      return "16:9";
  }
}

/** The models offered for a still, cheapest first. Checked live on 2026-10-12. */
export const REAL_MODELS = [
  { id: "nano_banana_2_1", name: "Nano Banana 2.1", params: { resolution: "2k" } },
  { id: "gpt_image_2_5", name: "GPT Image 2.5", params: { resolution: "2k", quality: "high" } },
] as const;

export type RealModelId = (typeof REAL_MODELS)[number]["id"];

export function realModel(id: unknown) {
  return REAL_MODELS.find((m) => m.id === id) ?? null;
}
