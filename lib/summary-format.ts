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
//
// IT DEGRADED ALL THE WAY TO PROSE FOR MONTHS, which is worth recording because
// the failure was silent and looked like the feature had never been built. The
// model writes the groups AS BULLETS ("- Waiting on: ..."), and the header test
// ran on the raw line, so classify() was handed "- Waiting on" and matched
// nothing. Every group fell into `rest` and rendered as five flat grey
// paragraphs. A parser whose whole job is tolerating how a model actually
// writes has to strip the bullet BEFORE it asks what the line is.
//
// The second one only showed up once the first was fixed: the model separates a
// group's items with SEMICOLONS, not with dashes, so a recognised group was one
// run-on line and no easier to skim than the paragraph it replaced.

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
 * Items written inline after the label are split back apart.
 *
 * TWO SEPARATORS, because the model uses both. A dash needs a space on BOTH
 * sides, so a hyphen inside a real phrase ("re-shoot the hero") does not break
 * an item in two. A semicolon is how it actually lists things most of the time
 * ("backdrops sent to printer (Steve, Aug 31); shoot completed Sep 4").
 *
 * COMMAS ARE DELIBERATELY NOT A SEPARATOR. "Veronica, Fred, Vanessa, Greg" is
 * one fact about one call sheet, and splitting there would turn a single item
 * into eight fragments, which is worse than the run-on line this fixes.
 *
 * Bracket and quote aware, so a semicolon inside "(a; b)" or inside a quoted
 * remark stays put.
 */
function splitInline(text: string): string[] {
  const body = text.trim();
  if (!body) return [];

  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const c = body[i];

    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "\u201c") {
      quote = c === "\u201c" ? "\u201d" : '"';
      buf += c;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);

    if (depth === 0) {
      if (c === ";") {
        parts.push(buf);
        buf = "";
        continue;
      }
      // A dash or bullet fenced by spaces, consumed with its trailing space.
      const dash = /^[-\u2013\u2022]$/.test(c);
      if (dash && /\s/.test(body[i - 1] ?? "") && /\s/.test(body[i + 1] ?? "")) {
        parts.push(buf);
        buf = "";
        i++;
        continue;
      }
    }
    buf += c;
  }
  parts.push(buf);

  return parts.map((p) => tidyItem(unbullet(p))).filter(Boolean);
}

/**
 * A list item is a fragment, so the full stop the model puts on the last one
 * reads as a typo next to its unpunctuated siblings. Only ever ONE trailing
 * period, and never from an ellipsis, which is doing a job.
 */
function tidyItem(text: string): string {
  let t = text.trim();
  if (t.endsWith(".") && !t.endsWith("..")) t = t.slice(0, -1).trim();
  return capitalize(t);
}

/**
 * An item split out of the middle of a sentence starts lowercase, which reads
 * as a broken sentence once it is a row of its own.
 *
 * SKIPPED WHEN THE FIRST WORD IS ALREADY MIXED CASE, so "iOS delivery" and
 * "vFX notes" keep the capitalisation somebody chose on purpose.
 */
function capitalize(text: string): string {
  const first = text.split(/\s/)[0] ?? "";
  if (!/^[a-z]/.test(text)) return text;
  if (/[A-Z]/.test(first)) return text;
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * The attribution a summary item trails ("(Steve, Aug 31)") is evidence, not
 * the point, and at five groups of it the eye has to read every word to find
 * the substance. Split off so it can be set quieter.
 *
 * ONLY a bracket that CLOSES the item, and only when there is a real phrase in
 * front of it, so an item that is mostly parenthetical is left whole.
 */
export function splitTrailingNote(item: string): { main: string; note: string | null } {
  const m = item.match(/^(.*\S)\s*(\([^()]*\))$/);
  if (!m) return { main: item, note: null };
  const main = m[1].trim();
  if (main.length < 12) return { main: item, note: null };
  return { main, note: m[2] };
}

export function parseSummary(content: string): ParsedSummary {
  const lines = (content || "").split("\n").map((l) => l.trim());

  const leadParts: string[] = [];
  const groups: SummaryGroup[] = [];
  const rest: string[] = [];
  let current: SummaryGroup | null = null;

  for (const line of lines) {
    if (!line) continue;

    const isBullet = /^\s*[-\u2022*\u00b7]\s+/.test(line);
    // THE BULLET COMES OFF FIRST. A group header is "Label:" possibly followed
    // by its items on the same line, and the model writes that header as a
    // bullet as often as not; asking what the line is before stripping the
    // marker is what sent every group to `rest`.
    const body = isBullet ? unbullet(line) : line;

    const colon = body.indexOf(":");
    if (colon > 0) {
      const found = classify(body.slice(0, colon));
      if (found) {
        current = { label: found.label, hue: found.hue, items: [] };
        groups.push(current);
        current.items.push(...splitInline(body.slice(colon + 1)));
        continue;
      }
    }

    if (isBullet) {
      const item = tidyItem(body);
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
