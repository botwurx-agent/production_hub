// The cast layer: characters, elements, locations and extras for a generated
// job, plus the looks that dress them and the platform handles that make a
// prompt resolve. Spec: docs/ai-pipeline.md, "The cast layer".
//
// Pure module. No "use server", no imports from the Supabase client, so the
// normalisation rules below can be unit tested and used on both sides.

export type EntityKind = "character" | "element" | "location" | "crowd";

export const ENTITY_KINDS: {
  key: EntityKind;
  label: string;
  plural: string;
  hue: string;
  hint: string;
  /**
   * Whether missing a platform handle is worth warning about. Extras are
   * deliberately NOT identity-locked: you want three plausible people, not the
   * same face three times. Flagging them for a missing sheet would produce
   * constant false alarms and train the operator to ignore every warning,
   * including the ones that matter.
   */
  needsHandle: boolean;
}[] = [
  {
    key: "character",
    label: "Character",
    plural: "Characters",
    hue: "purple",
    hint: "Someone the audience has to recognise from shot to shot",
    needsHandle: true,
  },
  {
    key: "element",
    label: "Element",
    plural: "Elements",
    hue: "blue",
    hint: "A garment, prop or product that has to be exact",
    needsHandle: true,
  },
  {
    key: "location",
    label: "Location",
    plural: "Locations",
    hue: "green",
    hint: "A set or place, with its scout sheet",
    needsHandle: true,
  },
  {
    key: "crowd",
    label: "Extras",
    plural: "Extras",
    hue: "amber",
    hint: "Background people, deliberately not locked to one face",
    needsHandle: false,
  },
];

export function entityKind(value: string | null | undefined): EntityKind {
  const found = ENTITY_KINDS.find((k) => k.key === value);
  return found ? found.key : "character";
}

export function kindMeta(kind: string) {
  return ENTITY_KINDS.find((k) => k.key === kind) ?? ENTITY_KINDS[0];
}

/** Platforms that support named reference elements, for the handle rows. */
export const HANDLE_PLATFORMS = [
  "Higgsfield",
  "Midjourney",
  "Runway",
  "Kling",
  "Luma",
  "Sora",
  "Veo",
  "Other",
];

/**
 * Our identifier: search, display, and prompt composition. Lowercase and
 * underscore-only so it is safe in a filename, a URL and a prompt.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * The platform's identifier, normalised. This is RECORDED EXTERNAL STATE, not
 * something we invent: the prompt only resolves if we emit the string the
 * platform gave back. We normalise casing and strip a leading @ because the
 * same handle typed three times by hand comes out three different ways, and two
 * near-identical handles are worse than one.
 */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Display form. Handles are stored bare and shown with the @. */
export function displayHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

/**
 * Looks are named for THEMSELVES, never for a scene. A scene-bound name starts
 * lying the moment the outfit reappears in another scene: you either regenerate
 * an identical sheet under a second handle, or you reference "scene1" from
 * scene 4. Where a look appears is the shot assignment's job.
 *
 * Advisory rather than enforced, because a studio may have a naming convention
 * we have not thought of, and a hard block on a name is a bad trade.
 */
export function looksSceneBound(name: string): boolean {
  return /\b(scene|shot|sc|sh)\s*[-_]?\s*\d+/i.test(name);
}

// ------------------------------------------------------------- shaped reads --

export type CastHandle = {
  id: string;
  platform: string;
  handle: string;
  entity_id: string | null;
  look_id: string | null;
};

export type CastLook = {
  id: string;
  entity_id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  itemIds: string[];
  handles: CastHandle[];
};

export type CastEntity = {
  id: string;
  project_id: string | null;
  kind: EntityKind;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;
  looks: CastLook[];
  handles: CastHandle[];
  /** Signed URLs for this entity's sheets, newest first. */
  sheets: string[];
};

export type CastAssignment = {
  id: string;
  shot_id: string;
  entity_id: string;
  look_id: string | null;
  count: number | null;
  notes: string | null;
};

export type CastShot = { id: string; position: number; title: string };

/** One cell's worth of trouble, for the continuity grid. */
export type CastWarning =
  | { kind: "no-look"; entityId: string; shotId: string }
  | { kind: "no-sheet"; entityId: string }
  | { kind: "no-handle"; entityId: string; platform: string }
  | { kind: "look-change"; entityId: string; shotId: string; fromShotId: string };

/**
 * The four things the continuity grid exists to make visible. Computed here
 * rather than in the component so it can be tested and reused by the prompt
 * linter later.
 *
 * `platform` is the one being targeted; a handle for a different platform does
 * not help a prompt written for this one.
 */
export function castWarnings(
  entities: CastEntity[],
  shots: CastShot[],
  assignments: CastAssignment[],
  platform: string | null
): CastWarning[] {
  const out: CastWarning[] = [];
  const byId = new Map(entities.map((e) => [e.id, e]));

  for (const e of entities) {
    const meta = kindMeta(e.kind);
    if (!meta.needsHandle) continue;
    if (e.sheets.length === 0) out.push({ kind: "no-sheet", entityId: e.id });
    if (platform) {
      const has = e.handles.some((h) => h.platform === platform);
      if (!has) out.push({ kind: "no-handle", entityId: e.id, platform });
    }
  }

  // Ordered walk per entity so a wardrobe change between consecutive appearances
  // is detectable. Only flagged between shots the entity is actually in: a gap
  // is not a change.
  const order = new Map(shots.map((s, i) => [s.id, i]));
  const byEntity = new Map<string, CastAssignment[]>();
  for (const a of assignments) {
    const list = byEntity.get(a.entity_id) ?? [];
    list.push(a);
    byEntity.set(a.entity_id, list);
  }

  for (const [entityId, list] of byEntity) {
    const entity = byId.get(entityId);
    if (!entity) continue;
    const sorted = [...list].sort(
      (a, b) => (order.get(a.shot_id) ?? 0) - (order.get(b.shot_id) ?? 0)
    );
    for (const a of sorted) {
      // A look is only meaningful if the entity has any defined.
      if (!a.look_id && entity.looks.length > 0) {
        out.push({ kind: "no-look", entityId, shotId: a.shot_id });
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.look_id && curr.look_id && prev.look_id !== curr.look_id) {
        out.push({
          kind: "look-change",
          entityId,
          shotId: curr.shot_id,
          fromShotId: prev.shot_id,
        });
      }
    }
  }

  return out;
}
