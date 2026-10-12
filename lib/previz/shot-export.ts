// A Scene builder camera, written as a shot list row. Pure, so the mapping can
// be tested; the builder renders the picture and the action writes the row.
//
// The shot list speaks its own vocabulary (components/production/
// shot-board-editor.tsx SHOT_SIZES, SHOT_TYPES, MOVEMENTS), and every word put
// into a row here is one of those, so a row sent from the builder reads the
// same as a row typed by hand. The lens, the stop and what the camera is on
// have no column, so they go into the row's notes as ONE line starting
// "Previz:", which a later send replaces rather than stacking a second copy.

import { toLocal, type CamKey, type Move } from "./camera-move";

export const PREVIZ_PREFIX = "Previz:";

/** The camera's movement in the shot list's words, from its move. */
export function movementWord(start: CamKey, move: Move | null): string {
  if (!move) return "Static";
  const e = move.end;
  // Read against where the lens points at the start, so "push in" means
  // toward the frame whatever the track's heading.
  const { lx, ly, lz } = toLocal(start, e.pos);
  const ax = Math.abs(lx);
  const ay = Math.abs(ly);
  const az = Math.abs(lz);
  const moved = Math.max(ax, ay, az) > 0.05;
  if (moved) {
    if (az >= ax && az >= ay) return lz < 0 ? "Push In" : "Pull Out";
    if (ax >= ay) return "Tracking";
    return "Crane";
  }
  const pan = Math.abs(((((e.yaw - start.yaw) % 360) + 540) % 360) - 180);
  const tilt = Math.abs(e.pitch - start.pitch);
  if (pan > 1 || tilt > 1) return pan >= tilt ? "Pan" : "Tilt";
  const zoom = e.focal / start.focal;
  if (zoom > 1.03 || zoom < 0.97) return "Zoom";
  return "Static";
}

/** "1a " and "1A" are the same shot. */
export function normCode(code: string | null | undefined): string {
  return (code ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Puts the previz line into a row's notes: a previous previz line is
 * replaced, anything the producer wrote is kept, above it.
 */
export function mergeNotes(existing: string | null | undefined, line: string): string {
  const kept = (existing ?? "")
    .split("\n")
    .filter((l) => !l.trim().startsWith(PREVIZ_PREFIX));
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  return kept.length ? `${kept.join("\n")}\n${line}` : line;
}

export type PrevizFacts = {
  body: string;
  focal: number;
  stop: number;
  /** The lens height, already written in the setup's units. */
  height: string;
  /** The subject distance, already written in the setup's units. */
  distance: string;
  support: string;
  /** "Push in, pan" and so on, or null for no move. */
  moveName: string | null;
  durationS: number | null;
  setupName: string;
};

/** The one notes line: what the shot list has no column for. */
export function previzLine(f: PrevizFacts): string {
  const parts = [
    `${f.body}, ${Math.round(f.focal)}mm at f/${f.stop}`,
    `lens ${f.height} high, ${f.distance} to focus`,
    `on ${f.support}`,
  ];
  if (f.moveName && f.moveName !== "Locked off") {
    parts.push(f.durationS ? `${f.moveName.toLowerCase()} over ${roundS(f.durationS)}s` : f.moveName.toLowerCase());
  }
  const setup = f.setupName.replace(/\s+/g, " ").trim();
  if (setup) parts.push(`setup "${setup.slice(0, 60)}"`);
  return `${PREVIZ_PREFIX} ${parts.join(" · ")}`;
}

const roundS = (s: number) => (Math.round(s * 10) / 10).toString();

/** What a send writes into one row. Fields the builder knows, nothing else. */
export type ShotRowOut = {
  code: string;
  title: string;
  shotSize: string;
  shotType: string;
  movement: string;
  notesLine: string;
  /** Where the rendered frame was stored, in the project's scene folder. */
  path: string | null;
};

export type ShotRowIn = {
  code: string | null;
  description: string | null;
  notes: string | null;
};

/**
 * The patch a send makes to a row that already carries this code. The picture,
 * the size, the angle and the movement are the camera's to say, so they are
 * replaced; the description is the producer's, so it is only filled in when
 * blank; the notes keep everything but the old previz line.
 */
export function updatePatch(row: ShotRowIn, out: ShotRowOut) {
  return {
    shot_size: out.shotSize,
    shot_type: out.shotType,
    movement: out.movement,
    notes: mergeNotes(row.notes, out.notesLine),
    ...(row.description?.trim() ? {} : { description: out.title || null }),
    ...(out.path ? { storage_path: out.path, mime_type: "image/jpeg", image_name: `${out.code}_previz.jpg`, asset_id: null } : {}),
  };
}

/** Matches each outgoing row to an existing row by code, first match wins. */
export function planSend<T extends ShotRowIn & { id: string }>(existing: T[], out: ShotRowOut[]) {
  const byCode = new Map<string, T>();
  for (const r of existing) {
    const k = normCode(r.code);
    if (k && !byCode.has(k)) byCode.set(k, r);
  }
  const used = new Set<string>();
  return out.map((o) => {
    const hit = byCode.get(normCode(o.code));
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      return { out: o, update: hit };
    }
    return { out: o, update: null as T | null };
  });
}
