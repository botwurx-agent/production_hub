// Shot blocking: whole-track and single-key operations for the timeline's
// right-click menu (reverse a move, shift it, change its length, copy and
// paste a key or a whole move, even into another scene). Pure, so it can be
// tested; the studio wraps each in one undoable commit.
import type { CamKey, Ease, Key, Vec3 } from "./scene";
import { setKey, snap } from "./keys";

const EPS = 1e-6;
const sorted = <K extends Key>(keys: K[]) => [...keys].sort((a, b) => a.t - b.t);

/** A key's ease, as seen from the other direction: an ease in becomes an ease out. */
const flipEase = (e: Ease): Ease => (e === "in" ? "out" : e === "out" ? "in" : e);

/**
 * The move played backwards over the same stretch of time: a push in becomes
 * a pull out, and the first key lands where the last one was. Each key keeps
 * what it holds (position, angle, lens, gesture, what the camera looks at);
 * the ease a segment leaves with moves to the key that now starts it, flipped,
 * and a hand-shaped curve handle points the other way.
 */
export function reverseKeys<K extends Key>(keys: K[], fps: number): K[] {
  const ks = sorted(keys);
  if (ks.length < 2) return ks;
  const t0 = ks[0].t;
  const t1 = ks[ks.length - 1].t;
  const out = ks.map((k, i) => {
    // In reverse order, key i is followed by key i-1, so the segment it now
    // leaves along is the one key i-1 used to leave along toward it.
    const leaving = i > 0 ? ks[i - 1].ease : k.ease;
    const next = { ...k, t: snap(t0 + t1 - k.t, fps), ease: flipEase(leaving) } as K;
    const tan = (k as unknown as CamKey).tan;
    if (tan) (next as unknown as CamKey).tan = [-tan[0], -tan[1], -tan[2]];
    return next;
  });
  return sorted(out);
}

/**
 * The whole move slid later (positive) or earlier, kept inside the scene. The
 * slide is cut short so nothing falls off either end; `moved` says how far it
 * really went.
 */
export function shiftKeys<K extends Key>(keys: K[], dt: number, duration: number, fps: number): { keys: K[]; moved: number } {
  const ks = sorted(keys);
  if (!ks.length) return { keys: ks, moved: 0 };
  const lo = -ks[0].t;
  const hi = duration - ks[ks.length - 1].t;
  const d = snap(Math.min(hi, Math.max(lo, dt)), fps);
  if (Math.abs(d) < EPS) return { keys: ks, moved: 0 };
  return { keys: ks.map((k) => ({ ...k, t: snap(k.t + d, fps) })), moved: d };
}

/** How long a move runs, from its first key to its last. */
export const moveLength = (keys: Key[]) => (keys.length < 2 ? 0 : Math.max(...keys.map((k) => k.t)) - Math.min(...keys.map((k) => k.t)));

/**
 * The move stretched or squeezed to a new length, starting where it starts
 * now, along the same route. Kept inside the scene and never shorter than one
 * frame per key, so two keys can never land on the same frame.
 */
export function retimeKeys<K extends Key>(keys: K[], length: number, duration: number, fps: number): { keys: K[]; length: number } {
  const ks = sorted(keys);
  const cur = moveLength(ks);
  if (ks.length < 2 || cur < EPS) return { keys: ks, length: cur };
  const t0 = ks[0].t;
  const min = (ks.length - 1) / fps;
  const want = Math.min(duration - t0, Math.max(min, length));
  const f = want / cur;
  const out: K[] = [];
  let last = -Infinity;
  for (const k of ks) {
    let t = snap(t0 + (k.t - t0) * f, fps);
    if (t <= last + EPS) t = snap(last + 1 / fps, fps);
    last = t;
    out.push({ ...k, t });
  }
  return { keys: out, length: snap(out[out.length - 1].t - t0, fps) };
}

/* ---------- the clipboard ---------- */

/** What can be copied: one key, or a whole move, from the camera or an object. */
export type Clip =
  | { kind: "key"; from: "camera" | "object"; key: Key | CamKey }
  | { kind: "move"; from: "camera" | "object"; keys: (Key | CamKey)[]; name: string };

export const CLIP_KEY = "blocking.clipboard";

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const vec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(num);
const EASES: Ease[] = ["smooth", "linear", "in", "out", "hold"];

/** A key read back from storage, or null. Only the fields a key carries survive. */
function cleanKey(r: unknown): Key | CamKey | null {
  if (!r || typeof r !== "object") return null;
  const k = r as Record<string, unknown>;
  if (!num(k.t) || !vec(k.p) || !vec(k.r)) return null;
  const out: CamKey = {
    t: k.t as number,
    p: k.p as Vec3,
    r: k.r as Vec3,
    ease: EASES.includes(k.ease as Ease) ? (k.ease as Ease) : "smooth",
    lens: num(k.lens) ? Math.min(800, Math.max(4, k.lens as number)) : 0,
  };
  if (Array.isArray(k.g) && k.g.length === 2 && k.g.every(num)) out.g = k.g as [number, number];
  if (typeof k.gk === "string" && k.gk.length < 40) (out as Key).gk = k.gk as Key["gk"];
  if (Array.isArray(k.af) && k.af.length === 2 && k.af.every(num)) out.af = k.af as [number, number];
  if (vec(k.tan)) out.tan = k.tan as Vec3;
  if (typeof k.at === "string" && k.at.length < 80) out.at = k.at;
  if (!out.lens) delete (out as Partial<CamKey>).lens;
  return out;
}

/** The clipboard read back from storage: anything malformed reads as empty. */
export function parseClip(raw: string | null): Clip | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const from = v.from === "camera" ? "camera" : v.from === "object" ? "object" : null;
    if (!from) return null;
    if (v.kind === "key") {
      const key = cleanKey(v.key);
      return key ? { kind: "key", from, key } : null;
    }
    if (v.kind === "move" && Array.isArray(v.keys)) {
      const keys = v.keys.slice(0, 400).map(cleanKey).filter((k): k is Key => !!k);
      if (!keys.length) return null;
      return { kind: "move", from, keys: sorted(keys), name: typeof v.name === "string" ? v.name.slice(0, 80) : "a move" };
    }
  } catch { /* fine */ }
  return null;
}

/**
 * A copied key made to fit the track it is pasted onto. A camera key onto an
 * object keeps only where it is and which way it faces; an object key onto
 * the camera takes the lens the camera has at that moment. What the camera
 * looks at (`at`) is kept only if that object is in this scene.
 */
export function fitKey(k: Key | CamKey, to: "camera" | "object", t: number, opts: { lens: number; ids: Set<string> }): Key | CamKey {
  const c = k as CamKey;
  if (to === "object") {
    const out: Key = { t, p: [...k.p] as Vec3, r: [...k.r] as Vec3, ease: k.ease };
    if (k.g) out.g = [...k.g] as [number, number];
    if (k.gk) out.gk = k.gk;
    return out;
  }
  const out: CamKey = { t, p: [...k.p] as Vec3, r: [...k.r] as Vec3, ease: k.ease, lens: c.lens ?? opts.lens };
  if (c.af) out.af = [...c.af] as [number, number];
  if (c.tan) out.tan = [...c.tan] as Vec3;
  if (c.at && opts.ids.has(c.at)) out.at = c.at;
  return out;
}

/** One key pasted at a time, replacing any key on that frame. */
export function pasteKey<K extends Key>(keys: K[], clipKey: Key | CamKey, to: "camera" | "object", t: number, fps: number, opts: { lens: number; ids: Set<string> }): K[] {
  return setKey(keys, fitKey(clipKey, to, snap(t, fps), opts) as K, fps);
}

/**
 * A copied move pasted so its first key lands at `t`. Keys already on the
 * track inside the pasted stretch are replaced; keys before and after it
 * stay. Keys that would run past the end of the scene are left off and
 * counted in `dropped`.
 */
export function pasteMove<K extends Key>(
  keys: K[], clip: (Key | CamKey)[], to: "camera" | "object", t: number, duration: number, fps: number,
  opts: { lens: number; ids: Set<string> },
): { keys: K[]; dropped: number } {
  const src = sorted(clip as K[]);
  if (!src.length) return { keys, dropped: 0 };
  const start = snap(t, fps);
  const off = start - src[0].t;
  const placed = src
    .map((k) => fitKey(k, to, snap(k.t + off, fps), opts) as K)
    .filter((k) => k.t <= duration + EPS && k.t >= -EPS);
  const dropped = src.length - placed.length;
  if (!placed.length) return { keys, dropped };
  const end = placed[placed.length - 1].t;
  const half = 0.5 / fps;
  const kept = keys.filter((k) => k.t < start - half || k.t > end + half);
  return { keys: sorted([...kept, ...placed]), dropped };
}
