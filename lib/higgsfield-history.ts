// Reading a Higgsfield `show_generations` page into what the pipeline's
// "From Higgsfield" picker needs. Pure (no server-only) so it can be tested
// against the body the live server sent on 2026-10-13.
//
// The shape it was built from: structuredContent.items[] with id, type
// (image | video | 3d), status, model, params (prompt, aspect_ratio, width,
// height, duration, seed, medias[{role, data:{id, type, url}}]), results
// (rawUrl, and minUrl for images), createdAt in UNIX SECONDS, plus a
// next_cursor that is the last item's createdAt. Tolerant on purpose: an MCP
// tool is described for an agent, not published as an API.

export type HfInput = { role: string; jobId: string | null; url: string | null };

export type HfGeneration = {
  id: string;
  kind: "image" | "video";
  model: string | null;
  prompt: string | null;
  aspect: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  seed: string | null;
  /** The full file. */
  url: string;
  /** A small preview when Higgsfield made one (images only). */
  thumb: string | null;
  /** Milliseconds, for display. */
  createdAt: number | null;
  /** What went into it: start and end frames, reference images, driving clips. */
  inputs: HfInput[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROMPT = 4000;

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const https = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https:\/\//i.test(s) ? s : null;
};

/** One item, or null when it is not something the pipeline can hold. */
export function parseGeneration(v: unknown): HfGeneration | null {
  const o = obj(v);
  if (!o) return null;
  const id = str(o.id);
  if (!id || !UUID.test(id)) return null;
  const type = str(o.type)?.toLowerCase();
  // 3D meshes and anything else are not candidates for a shot.
  if (type !== "image" && type !== "video") return null;
  const status = str(o.status)?.toLowerCase();
  if (status && status !== "completed") return null;
  const results = obj(o.results);
  const url = https(results?.rawUrl) ?? https(results?.raw_url) ?? https(o.url);
  if (!url) return null;
  const p = obj(o.params) ?? {};
  const created = num(o.createdAt);
  const seedRaw = p.seed;
  const inputs: HfInput[] = [];
  if (Array.isArray(p.medias)) {
    for (const m of p.medias.slice(0, 12)) {
      const mo = obj(m);
      const role = str(mo?.role);
      if (!mo || !role) continue;
      const d = obj(mo.data);
      const jid = str(d?.id);
      inputs.push({ role, jobId: jid && UUID.test(jid) ? jid : null, url: https(d?.url) });
    }
  }
  return {
    id,
    kind: type,
    model: str(o.model),
    prompt: str(p.prompt)?.slice(0, MAX_PROMPT) ?? null,
    aspect: str(p.aspect_ratio),
    width: num(p.width),
    height: num(p.height),
    durationSec: num(p.duration),
    seed: typeof seedRaw === "number" && Number.isFinite(seedRaw) ? String(seedRaw) : str(seedRaw),
    url,
    thumb: https(results?.minUrl) ?? https(results?.min_url),
    // createdAt is UNIX seconds; a value already in milliseconds is left alone.
    createdAt: created === null ? null : created < 1e11 ? Math.round(created * 1000) : Math.round(created),
    inputs,
  };
}

/** A whole page: what can be shown, and the cursor for the next one. */
export function parseGenerationsPage(data: unknown): { items: HfGeneration[]; nextCursor: string | null } {
  const o = obj(data);
  const list = Array.isArray(o?.items) ? o.items : Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  const items: HfGeneration[] = [];
  for (const v of list) {
    const g = parseGeneration(v);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    items.push(g);
  }
  const c = o?.next_cursor ?? o?.nextCursor;
  const nextCursor = typeof c === "number" && Number.isFinite(c) ? String(c) : str(c);
  return { items, nextCursor };
}

/** The start and end frames a video was made from, by Higgsfield job id. */
export function frameInputs(g: Pick<HfGeneration, "inputs">): { start: string | null; end: string | null } {
  const find = (role: string) => g.inputs.find((i) => i.role === role && i.jobId)?.jobId ?? null;
  return { start: find("start_image"), end: find("end_image") };
}

/** "Seedance 2.5" from "seedance_2_5": readable, never invented. */
export function modelLabel(id: string | null): string | null {
  if (!id) return null;
  const words = id.split(/[_\s]+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    // Version digits split by underscores read back as "2.5", not "2 5".
    if (/^\d+$/.test(w) && prev && /\d$/.test(prev)) out[out.length - 1] = `${prev}.${w}`;
    else out.push(/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase());
  }
  return out.join(" ");
}

/**
 * A picked generation coming BACK from the browser to be imported. It is
 * data the browser could have edited, so every field is re-checked: an id
 * that is not a Higgsfield job id or a link that is not https drops the item,
 * and text is capped. The download itself still goes through the SSRF-guarded
 * fetch, so a link cannot reach anything a pasted one could not.
 */
export function cleanPicked(v: unknown): HfGeneration | null {
  const o = obj(v);
  if (!o) return null;
  const id = str(o.id);
  const url = https(o.url);
  if (!id || !UUID.test(id) || !url) return null;
  const kind = o.kind === "image" || o.kind === "video" ? o.kind : null;
  if (!kind) return null;
  const inputs: HfInput[] = Array.isArray(o.inputs)
    ? o.inputs.slice(0, 12).flatMap((i) => {
        const io = obj(i);
        const role = str(io?.role)?.slice(0, 40);
        if (!io || !role) return [];
        const jid = str(io.jobId);
        return [{ role, jobId: jid && UUID.test(jid) ? jid : null, url: https(io.url) }];
      })
    : [];
  const cap = (s: string | null, n: number) => (s ? s.slice(0, n) : null);
  return {
    id,
    kind,
    model: cap(str(o.model), 80),
    prompt: cap(str(o.prompt), MAX_PROMPT),
    aspect: cap(str(o.aspect), 12),
    width: num(o.width),
    height: num(o.height),
    durationSec: num(o.durationSec),
    seed: cap(str(o.seed), 40),
    url,
    thumb: https(o.thumb),
    createdAt: num(o.createdAt),
    inputs,
  };
}
