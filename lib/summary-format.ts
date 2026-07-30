// Turns the AI project summary from a wall of text into something with shape.
//
// The model is already asked for structure: one status sentence, then labelled
// groups ("What's done:", "Waiting on:", "Next action:") with "- " items. That
// structure was being thrown away by rendering the whole thing as pre-wrapped
// text, so a busy producer got a grey paragraph to hunt through, which is the
// opposite of a twenty-second read.
//
// Parsing rather than changing the prompt to emit JSON, for two reasons: the
// summaries already stored in project_summaries are plain text and would
// otherwise render worse than before, and a model that drifts from a requested
// format should degrade to readable prose rather than to an error. Nothing is
// ever dropped: anything unrecognised comes back in `rest` and is still shown.

export type SummaryGroup = {
  /** The label as written, e.g. "Waiting on". */
  label: string;
  /** Hue token for the chip, chosen by meaning. */
  hue: string;
  items: string[];
};

export type ParsedSummary = {
  /** The opening one-line status read. */
  lead: string;
  groups: SummaryGroup[];
  /** Anything that did not fit the shape, so no text is ever lost. */
  rest: string[];
};

// Colour is a status signal here, not decoration: these labels ARE states.
// Anything unrecognised stays neutral rather than being assigned a meaning.
const HUES: { match: RegExp; hue: string; label: string }[] = [
  { match: /^what'?s?\s*done$|^done$|^completed$/i, hue: "green", label: "Done" },
  { match: /^in progress$|^underway$/i, hue: "blue", label: "In progress" },
  { match: /^waiting on$|^waiting for$|^blocked on$/i, hue: "amber", label: "Waiting on" },
  { match: /^next actions?$|^next$/i, hue: "indigo", label: "Next action" },
  { match: /^watch$|^watch out$|^risks?$/i, hue: "red", label: "Watch" },
];

function classify(raw: string): { hue: string; label: string } | null {
  const cleaned = raw.trim().replace(/[:：]\s*$/, "").trim();
  if (!cleaned || cleaned.length > 24) return null;
  for (const h of HUES) {
    if (h.match.test(cleaned)) return { hue: h.hue, label: h.label };
  }
  return null;
}

/** Strips a leading bullet marker of any of the shapes the model might use. */
function unbullet(line: string): string {
  return line.replace(/^\s*[-•*·]\s+/, "").trim();
}

/**
 * Items written inline after the label ("Waiting on: - a - b") are split back
 * apart. The separator has to be a dash with space on BOTH sides, so a hyphen
 * inside a real phrase ("re-shoot the hero") does not break the item in two.
 */
function splitInline(text: string): string[] {
  const body = text.trim();
  if (!body) return [];
  return body
    .split(/\s+[-•]\s+/)
    .map((p) => unbullet(p))
    .filter(Boolean);
}

export function parseSummary(content: string): ParsedSummary {
  const lines = (content || "").split("\n").map((l) => l.trim());

  const leadParts: string[] = [];
  const groups: SummaryGroup[] = [];
  const rest: string[] = [];
  let current: SummaryGroup | null = null;

  for (const line of lines) {
    if (!line) continue;

    // A group header is "Label:" possibly followed by its items on the same
    // line, which is how the model writes it about half the time.
    const colon = line.indexOf(":");
    if (colon > 0) {
      const found = classify(line.slice(0, colon));
      if (found) {
        current = { label: found.label, hue: found.hue, items: [] };
        groups.push(current);
        current.items.push(...splitInline(line.slice(colon + 1)));
        continue;
      }
    }

    const isBullet = /^\s*[-•*·]\s+/.test(line);
    if (isBullet) {
      const item = unbullet(line);
      if (!item) continue;
      if (current) current.items.push(item);
      else rest.push(item);
      continue;
    }

    // Plain prose. Before any group it is the opening status read; after one it
    // is a trailing note, and either way it is kept.
    if (groups.length === 0) leadParts.push(line);
    else rest.push(line);
  }

  return {
    lead: leadParts.join(" ").trim(),
    // A group the model announced but never filled is noise.
    groups: groups.filter((g) => g.items.length > 0),
    rest,
  };
}
