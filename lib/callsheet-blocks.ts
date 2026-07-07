// The call sheet is an ordered list of blocks. Fixed blocks map to the
// structured call_sheets columns; custom "text" blocks carry their own content.
// Shared by the builder (edit-in-place) and the print/export view (read-only).

export type CallSheetBlock = {
  id: string;
  type: string; // header|schedule|locations|contacts|company|cast|crew|notes|text
  hidden?: boolean;
  title?: string; // custom text blocks
  body?: string; // custom text blocks
};

// Fixed (built-in) block types + their labels, in the default order.
export const FIXED_BLOCKS: { type: string; label: string }[] = [
  { type: "header", label: "Header" },
  { type: "schedule", label: "Schedule & times" },
  { type: "locations", label: "Locations & safety" },
  { type: "contacts", label: "Key contacts" },
  { type: "company", label: "Production company" },
  { type: "cast", label: "Cast & talent" },
  { type: "crew", label: "Crew" },
  { type: "notes", label: "Notes" },
];

export const FIXED_TYPES = FIXED_BLOCKS.map((b) => b.type);

export function defaultLayout(): CallSheetBlock[] {
  return FIXED_BLOCKS.map((b) => ({ id: b.type, type: b.type }));
}

// Turn the stored jsonb into a clean block list, falling back to the default.
export function normalizeLayout(raw: unknown): CallSheetBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultLayout();
  const out: CallSheetBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    if (typeof b.type !== "string") continue;
    out.push({
      id: typeof b.id === "string" ? b.id : b.type,
      type: b.type,
      hidden: Boolean(b.hidden),
      title: typeof b.title === "string" ? b.title : undefined,
      body: typeof b.body === "string" ? b.body : undefined,
    });
  }
  return out.length ? out : defaultLayout();
}
