// Props: the model behind migration 0092.
//
// Pure, so the status and roll-up logic can be unit tested without a database.

export const PROP_STATUS = {
  needed: { label: "Needed", hue: "red" },
  options: { label: "Options in", hue: "amber" },
  approved: { label: "Approved", hue: "blue" },
  booked: { label: "Booked", hue: "purple" },
  on_set: { label: "On set", hue: "green" },
} as const;

export type PropStatus = keyof typeof PROP_STATUS;

export const PROP_STATUS_ORDER: PropStatus[] = [
  "needed",
  "options",
  "approved",
  "booked",
  "on_set",
];

export function isPropStatus(v: string): v is PropStatus {
  return v in PROP_STATUS;
}

export function propStatus(v: string | null | undefined): PropStatus {
  return v && isPropStatus(v) ? v : "needed";
}

/**
 * Categories an art department actually works in.
 *
 * Free text underneath, like contacts.type: every job carves this up a little
 * differently and a new one should not cost a migration. The list exists to
 * make the common case one click, not to be a wall.
 */
export const PROP_CATEGORIES = [
  "Glassware",
  "Tableware",
  "Linens",
  "Furnishings",
  "Set dressing",
  "Hero product",
  "Practical",
  "Hand prop",
  "Signage / graphics",
  "Food styling",
  "Plants",
  "Other",
];

export type PropOption = {
  id: string;
  name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  url: string | null;
  source: string | null;
  notes: string | null;
};

export type Prop = {
  id: string;
  name: string;
  category: string | null;
  qty: number;
  notes: string | null;
  source: string | null;
  contact_id: string | null;
  status: string;
  picked_option_id: string | null;
  options: PropOption[];
};

/**
 * The option a prop settled on, or null while it is still a question.
 *
 * Resolved by lookup rather than trusted from picked_option_id alone, because
 * the FK is ON DELETE SET NULL and an option can be removed after it was
 * picked. Anything reading a stale id would draw a photo that no longer exists.
 */
export function pickedOption(p: Prop): PropOption | null {
  if (!p.picked_option_id) return null;
  return p.options.find((o) => o.id === p.picked_option_id) ?? null;
}

/**
 * What a producer scanning the page wants: how much of this is still open.
 *
 * `settled` counts booked and on-set together, since both mean the prop is no
 * longer a problem. `awaiting` is the number with options gathered but nothing
 * chosen, which is the pile that needs a decision from someone else and is
 * therefore the one worth surfacing.
 */
export function summarizeProps(props: Prop[]): {
  total: number;
  needed: number;
  awaiting: number;
  settled: number;
  undecided: number;
} {
  let needed = 0;
  let awaiting = 0;
  let settled = 0;
  let undecided = 0;

  for (const p of props) {
    const s = propStatus(p.status);
    if (s === "needed") needed++;
    if (s === "options") awaiting++;
    if (s === "booked" || s === "on_set") settled++;
    // Counted separately from status: a prop can be marked approved while the
    // pick was later deleted, and that is a real gap worth showing rather than
    // hiding behind a green chip.
    if (p.options.length > 0 && !pickedOption(p)) undecided++;
  }

  return { total: props.length, needed, awaiting, settled, undecided };
}

/** Groups props by category for the page, preserving the order given. */
export function groupByCategory(props: Prop[]): { category: string; items: Prop[] }[] {
  const groups = new Map<string, Prop[]>();
  for (const p of props) {
    const key = p.category?.trim() || "Uncategorised";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}
