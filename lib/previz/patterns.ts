// Breakup: the things a grip puts between a hard light and the set to throw a
// pattern (a cucoloris, a branch, venetian blinds, a window frame). Pure, so
// the numbers can be tested; the drawing lives in light-build.ts.
//
// Two facts a gaffer works with, and the only two modelled here:
//   1. HOW MUCH LIGHT GETS THROUGH. The meter does not trace every hole (one
//      ray per light would flicker between a leaf and a gap as anything moved),
//      it takes the share a pattern lets through on average.
//   2. WHETHER THE PATTERN READS. A shadow edge is blurred by the source's
//      size times (pattern to subject) / (source to pattern). When that blur is
//      bigger than the pattern's own features, the pattern washes out into a
//      plain dimming. That is why a cookie wants a hard source and wants to sit
//      close to the subject, and the readout says so in those words.

export type PatternKind = "cookie" | "branch" | "blinds" | "windowpane";

export type PatternInfo = {
  name: string;
  /** One line for the inspector: what it is for. */
  hint: string;
};

export const PATTERNS: Record<PatternKind, PatternInfo> = {
  cookie: {
    name: "Cucoloris (cookie)",
    hint: "A board cut with organic holes, for a soft breakup that reads as light through foliage or nothing in particular.",
  },
  branch: {
    name: "Branch (dingle)",
    hint: "A real leafy branch on a C-stand arm. Leaf shadow is the most natural breakup there is.",
  },
  blinds: {
    name: "Venetian blinds",
    hint: "Slats throw hard stripes. Open them for more light and thinner shadows, close them toward a few lines.",
  },
  windowpane: {
    name: "Window pattern",
    hint: "A cut-out of a window frame: the panes land on a wall as if the sun were coming through a window that is not there.",
  },
};

/** A branch's leaf size for a branch about `sideM` across (light-build draws it). */
export function leafSizeM(sideM: number): number {
  return Math.max(0.05, Math.min(0.11, sideM * 0.07));
}

/**
 * The size of the shapes a pattern `sideM` across is made of, in metres: the
 * scale its shadow's blur is compared against. Matches how light-build.ts
 * draws each one.
 */
export function featureM(kind: PatternKind, sideM: number): number {
  switch (kind) {
    case "cookie": return sideM * 0.1;
    case "branch": return leafSizeM(sideM);
    case "blinds": return (sideM / Math.max(6, Math.round(sideM / 0.05))) * 0.5;
    case "windowpane": return sideM * 0.07;
  }
}

export function isPattern(kind: string): kind is PatternKind {
  return Object.prototype.hasOwnProperty.call(PATTERNS, kind);
}

/** Blinds open, as a share from closed (0.1) to wide open (1). */
export function clampOpen(v: number | undefined | null): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0.6;
  return Math.min(1, Math.max(0.1, n));
}

/** Share of light a pattern lets through, on average across it. */
export function patternTransmission(kind: PatternKind, open?: number | null): number {
  switch (kind) {
    case "cookie": return 0.45;
    case "branch": return 0.55;
    case "blinds": return 0.9 * clampOpen(open);
    case "windowpane": return 0.8;
  }
}

/** A small deterministic generator, so one board always draws the same holes. */
export function rng(seed: number): () => number {
  let s = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** A stable seed from an id, for patterns that have never been reshuffled. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Blur of the shadow edge on the subject, in metres: the penumbra a source
 * `sourceM` across throws past an edge `patternToSubjectM` in front of the
 * subject and `sourceToPatternM` from the source.
 */
export function shadowBlurM(sourceM: number, sourceToPatternM: number, patternToSubjectM: number): number {
  if (!(sourceToPatternM > 0) || !(patternToSubjectM >= 0)) return Infinity;
  return Math.max(0, sourceM) * (patternToSubjectM / sourceToPatternM);
}

export type PatternLook = "crisp" | "soft" | "dapple" | "washed";

/** How the pattern lands, from the blur against the pattern's own features. */
export function patternLook(blurM: number, featureM: number): PatternLook {
  const r = blurM / featureM;
  if (!Number.isFinite(r)) return "washed";
  if (r < 0.5) return "crisp";
  if (r < 1.5) return "soft";
  if (r < 3) return "dapple";
  return "washed";
}

export const LOOK_WORDS: Record<PatternLook, string> = {
  crisp: "Crisp: the pattern lands sharp",
  soft: "Soft edged, still clearly the pattern",
  dapple: "A soft dapple, the shapes only hinted",
  washed: "Washed out: it only dims, no pattern reads",
};

/** What to change to sharpen it, when it is not already crisp. */
export function sharpenAdvice(look: PatternLook): string | null {
  if (look === "crisp") return null;
  return "To sharpen it: move it closer to the subject, pull the light further back, or make the source smaller (take off diffusion or the softbox).";
}

