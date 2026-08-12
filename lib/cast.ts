// References: the images a generation is built from, and the handles the
// platform gave them. Spec: docs/ai-pipeline.md, "The cast layer".
//
// ONE object on purpose. An earlier version split this into entities, looks and
// compositions, which modelled the domain correctly and cost more than it
// returned: generating a single shot meant maintaining a hand-typed mirror of
// the platform's element library, in a vocabulary this app invented, on a page
// away from the work. A reference is exactly what the platform has. Nothing to
// translate.
//
// Pure module. No "use server", no Supabase imports, so the rules below can be
// unit tested and used on both sides.

/**
 * A light label for grouping and colour. It carries NO behaviour.
 *
 * The set MIRRORS Higgsfield's own New Element dialog (Auto / Character /
 * Location / Prop), deliberately. The operator names and categorises a thing
 * once over there and once here; using a different vocabulary in the second
 * place makes them translate for no reason. "Auto" means uncategorised: their
 * server classifies from the image, we simply do not insist.
 */
export type RefKind = "auto" | "character" | "location" | "element" | "crowd";

export const REF_KINDS: {
  key: RefKind;
  label: string;
  plural: string;
  hue: string;
  hint: string;
  /** Shown in the category picker. `crowd` is legacy data only. */
  pick: boolean;
}[] = [
  {
    key: "auto",
    label: "Auto",
    plural: "Uncategorised",
    hue: "cyan",
    hint: "Not sorted yet",
    pick: true,
  },
  {
    key: "character",
    label: "Character",
    plural: "Characters",
    hue: "purple",
    hint: "A person the audience has to recognise",
    pick: true,
  },
  {
    key: "location",
    label: "Location",
    plural: "Locations",
    hue: "green",
    hint: "A place, or one state of it",
    pick: true,
  },
  {
    key: "element",
    label: "Prop",
    plural: "Props",
    hue: "blue",
    hint: "Wardrobe, a prop, a product",
    pick: true,
  },
  {
    key: "crowd",
    label: "Extras",
    plural: "Extras",
    hue: "amber",
    hint: "Background people",
    pick: false,
  },
];

export function refKind(value: string | null | undefined): RefKind {
  const found = REF_KINDS.find((k) => k.key === value);
  return found ? found.key : "auto";
}

export function kindMeta(kind: string) {
  return REF_KINDS.find((k) => k.key === kind) ?? REF_KINDS[0];
}

/** The categories offered when creating. */
export const PICKABLE_KINDS = REF_KINDS.filter((k) => k.pick);

/**
 * The handle a platform will most likely give this, from its name.
 *
 * Higgsfield derives an element's @name from what you type in its New Element
 * dialog, normalising spaces to hyphens. So when the reference is named the
 * same in both places, which is the sane way to work, the handle needs no
 * separate typing at all. Offered as a default the operator can overwrite,
 * never forced, because the platform is still the authority on what it called
 * the thing.
 */
export function suggestedHandle(name: string): string {
  return normalizeHandle(name);
}

/** Platforms that support named reference elements. */
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

/** Our own identifier. Safe in a filename, a URL and a query. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * The platform's identifier, kept VERBATIM apart from whitespace and a leading
 * @. This is RECORDED EXTERNAL STATE, not a slug we invent: the prompt only
 * resolves if we emit the exact string the platform gave back.
 *
 * Two corrections are baked in here. An early version lowercased and replaced
 * hyphens, which turned "Maya-Scene-1-Wardrobe" into something that reads right
 * and resolves to nothing. A later one refused any character outside a fixed
 * alphabet, which made "LOC-01/B" unrecordable even though that is genuinely
 * what Higgsfield names an element. We impose no charset.
 */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "-").slice(0, 60);
}

/** Display form. Handles are stored bare and shown with the @. */
export function displayHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

// ------------------------------------------------------------- shaped reads --

export type CastHandle = {
  id: string;
  platform: string;
  handle: string;
};

export type CastSheet = {
  id: string;
  url: string;
  /**
   * A resized copy for the grid. Null when there is no stored file to resize
   * (an external link) or when resizing is unavailable, and the caller falls
   * back to `url`.
   */
  thumbUrl: string | null;
};

export type CastReference = {
  id: string;
  project_id: string | null;
  kind: RefKind;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;
  /** The reusable prompt that generates this one. The recipe, not a log. */
  prompt: string | null;
  handles: CastHandle[];
  /** Newest first. */
  sheets: CastSheet[];
};

/** Which references a shot uses. */
export type CastUse = {
  shot_id: string;
  entity_id: string;
};

export type CastShot = { id: string; position: number; title: string };

// ------------------------------------------------------------ prompt checks --

/**
 * The ONE check worth making, and the reason is that it is invisible without
 * us: a handle in the prompt that no reference owns does not error on the
 * platform, it silently resolves to nothing and the model improvises. Every
 * other check this file used to run fired on correct setups often enough to
 * teach the operator to ignore all of them.
 *
 * Leaving a reference out of a prompt is a choice, not a mistake, so it is
 * reported by the chip showing as unused rather than as a warning.
 */
export type PromptIssue = { handle: string };

// Only used to find tokens the shot does NOT own. Whether a handle we DO own
// appears is answered by literal containment below, because a regex has to
// guess an alphabet and platforms keep widening theirs.
const HANDLE_IN_TEXT = /@([a-z0-9_./-]+)/gi;

/** Is this exact handle written in the prompt? Case-insensitive, any charset. */
export function mentions(text: string, handle: string): boolean {
  return text.toLowerCase().includes(`@${handle.toLowerCase()}`);
}

/** Every handle this shot's references own, for the platform being targeted. */
export function handlesFor(
  refs: CastReference[],
  platform: string | null
): { ref: CastReference; handle: string }[] {
  const out: { ref: CastReference; handle: string }[] = [];
  for (const ref of refs) {
    const h = platform
      ? ref.handles.find((x) => x.platform === platform)
      : ref.handles[0];
    if (h) out.push({ ref, handle: h.handle });
  }
  return out;
}

export function lintPrompt(
  text: string,
  refs: CastReference[],
  platform: string | null
): PromptIssue[] {
  if (refs.length === 0) return [];

  const known = new Set(
    handlesFor(refs, platform).map((x) => x.handle.toLowerCase())
  );
  // A handle for another platform is still a handle the operator recorded, so
  // it is not a leftover. Only a token nothing owns at all is.
  for (const ref of refs) {
    for (const h of ref.handles) known.add(h.handle.toLowerCase());
  }

  const issues: PromptIssue[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(HANDLE_IN_TEXT)) {
    const token = m[1].toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    if (known.has(token)) continue;
    // A token that merely starts a handle we own is that handle clipped by the
    // tokenizer, not a stray reference.
    if (Array.from(known).some((k) => k.startsWith(token))) continue;
    issues.push({ handle: token });
  }
  return issues;
}
