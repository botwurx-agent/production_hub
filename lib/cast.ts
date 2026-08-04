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
  /**
   * Whether being in a shot with no look chosen is worth flagging.
   *
   * A person is always wearing something, so a character in a shot with no
   * look is genuinely unanswered. A place, a prop and a garment all have a
   * legitimate BASE state: the empty room, the plain glass, the jacket as it
   * comes. Their own sheet and handle describe that state, and a look is the
   * departure from it. Flagging those would mean every shot using the base
   * bedroom carries a warning for being correct.
   */
  needsLook: boolean;
}[] = [
  {
    key: "character",
    label: "Character",
    plural: "Characters",
    hue: "purple",
    hint: "Someone the audience has to recognise from shot to shot",
    needsHandle: true,
    needsLook: true,
  },
  {
    key: "element",
    label: "Element",
    plural: "Elements",
    hue: "blue",
    hint: "A garment, prop or product that has to be exact",
    needsHandle: true,
    needsLook: false,
  },
  {
    key: "location",
    label: "Location",
    plural: "Locations",
    hue: "green",
    hint: "A set or place, with its scout sheet",
    needsHandle: true,
    needsLook: false,
  },
  {
    key: "crowd",
    label: "Extras",
    plural: "Extras",
    hue: "amber",
    hint: "Background people, deliberately not locked to one face",
    needsHandle: false,
    needsLook: false,
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
  // Kept VERBATIM apart from whitespace and a leading @, because a handle is
  // recorded external state, not a slug we invent. Higgsfield names an element
  // "Maya-Scene-1-Wardrobe": hyphens, capitals and all, and that exact string
  // is what a prompt has to carry. An earlier version lowercased it and turned
  // every hyphen into an underscore, which produced a handle that looks right,
  // resolves to nothing, and spends credits before anyone notices.
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "-").slice(0, 60);
}

/**
 * Whether a handle can survive being written into a prompt, and why not.
 *
 * This is NOT us imposing a house style on recorded external state. A prompt
 * carries a handle as a bare @token, so anything outside letters, numbers, dot,
 * dash and underscore ends the token early: a handle stored as "LOC-01/A" is
 * read by the platform, and by our own linter, as "LOC-01". The result is a
 * warning that can never be cleared and a reference that silently does not
 * resolve, which is the failure this whole field exists to prevent. Better to
 * refuse it while the operator is looking at it.
 */
export function handleProblem(handle: string): string | null {
  if (!handle) return "Enter the handle the platform gave you.";
  const bad = handle.match(/[^A-Za-z0-9_.-]/g);
  if (!bad) return null;
  const shown = Array.from(new Set(bad)).join(" ");
  return `A prompt cannot carry ${shown} inside a handle, so this would stop resolving at that character. Use letters, numbers, dot, dash or underscore (Higgsfield turns spaces into dashes).`;
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

/** A reference sheet: an ai_generations row owned by an entity or a look. */
export type CastSheet = {
  id: string;
  url: string;
  /**
   * For a look's combined sheet: the names of the sheets it was generated
   * from, resolved through ai_generation_refs. Empty when the lineage was not
   * recorded, which is the case for anything uploaded before the sources
   * existed.
   */
  from?: string[];
};

export type CastLook = {
  id: string;
  entity_id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The reusable prompt that generates this look's combined sheet. */
  prompt: string | null;
  position: number;
  itemIds: string[];
  handles: CastHandle[];
  sheets: CastSheet[];
};

export type CastEntity = {
  id: string;
  project_id: string | null;
  kind: EntityKind;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;
  /** The reusable prompt that generates this entity's sheets. */
  prompt: string | null;
  looks: CastLook[];
  handles: CastHandle[];
  /** This entity's own sheets, newest first. Look sheets live on the look. */
  sheets: CastSheet[];
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
      // A handle on a LOOK counts for the entity it belongs to. A location
      // whose two variations are each uploaded separately never has an element
      // of its own, and is always referenced through one of them, so demanding
      // a handle on the bare entity would be a warning that can never be
      // cleared: the same false-alarm problem that keeps extras exempt.
      const has =
        e.handles.some((h) => h.platform === platform) ||
        e.looks.some((l) => l.handles.some((h) => h.platform === platform));
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
      // Only where a missing look leaves a real question. See needsLook.
      if (!a.look_id && entity.looks.length > 0 && kindMeta(entity.kind).needsLook) {
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

// --------------------------------------------------------- the prompt linter --

/** What is in a shot, flattened for the composer. */
export type ShotCastMember = {
  entity: CastEntity;
  look: CastLook | null;
};

export type PromptIssue =
  /** Assigned to this shot, has a handle, but the prompt never mentions it. */
  | { kind: "unused"; label: string; handle: string }
  /** A handle in the prompt that belongs to nothing in this shot. */
  | { kind: "unknown"; handle: string }
  /** Assigned, needs a handle, has none on the platform being targeted. */
  | { kind: "no-handle"; label: string };

// Hyphens and dots are in here because platforms use them: Higgsfield turns a
// spaced element name into "Maya-Scene-1-Wardrobe". Matching is case-insensitive
// on both sides, so a capital in the prompt is not reported as an unknown
// handle, but what gets STORED and inserted keeps its original case.
const HANDLE_IN_TEXT = /@([a-z0-9_.-]+)/gi;

/**
 * Checks a prompt against the cast assigned to its shot, at the moment before
 * credits get spent. The grid answers the same questions for the whole job;
 * this answers them for the thing you are about to generate.
 *
 * Deliberately quiet when the shot has no cast assigned: with nothing to
 * compare against, every handle in the text would read as unknown, which is
 * noise rather than information and would train the operator to ignore it.
 */
export function lintPrompt(
  text: string,
  members: ShotCastMember[],
  platform: string | null
): PromptIssue[] {
  const issues: PromptIssue[] = [];
  if (members.length === 0) return issues;

  const found = new Set<string>();
  for (const m of text.matchAll(HANDLE_IN_TEXT)) found.add(m[1].toLowerCase());

  const known = new Set<string>();

  for (const { entity, look } of members) {
    const meta = kindMeta(entity.kind);
    const entityHandle = platform
      ? entity.handles.find((h) => h.platform === platform)
      : entity.handles[0];
    const lookHandle = look
      ? platform
        ? look.handles.find((h) => h.platform === platform)
        : look.handles[0]
      : undefined;

    if (entityHandle) {
      known.add(entityHandle.handle.toLowerCase());
      if (!found.has(entityHandle.handle.toLowerCase())) {
        issues.push({
          kind: "unused",
          label: entity.name,
          handle: entityHandle.handle,
        });
      }
    } else if (meta.needsHandle && !lookHandle) {
      // Only when the look does not speak for it either, for the same reason
      // castWarnings accepts a look's handle: some entities are only ever
      // referenced through one of their variations.
      issues.push({ kind: "no-handle", label: entity.name });
    }

    if (lookHandle && look) {
      known.add(lookHandle.handle.toLowerCase());
      if (!found.has(lookHandle.handle.toLowerCase())) {
        issues.push({
          kind: "unused",
          label: `${entity.name}, ${look.name}`,
          handle: lookHandle.handle,
        });
      }
    }
  }

  for (const handle of found) {
    if (!known.has(handle)) issues.push({ kind: "unknown", handle });
  }

  return issues;
}
