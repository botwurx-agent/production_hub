// The words sent with a Scene builder frame when it is made photoreal. Pure, so
// it can be tested. The producer sees and edits this before anything is
// generated; it is a starting point, not a hidden instruction.
//
// The picture carries the composition, so the prompt's job is the two things a
// grey render cannot say: that everything in it must stay where it is, and what
// the grey shapes are meant to be.

export type RealPromptInput = {
  shotTitle: string;
  setKind: "stage" | "room";
  floor?: string | null;
  items: { kind: string; name: string }[];
  talent: { poseName: string }[];
};

// Rigging, practical light fittings and backdrops say nothing a photograph
// should show by name; the render already shows them.
const SKIP = /^(grid|spreader|polecat)$/i;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function realStillPrompt(p: RealPromptInput): string {
  const lines: string[] = [];
  lines.push(
    "Turn this grey 3D previz render into a photoreal still from a commercial shoot.",
    "Keep the camera exactly as it is: the same angle, height, lens perspective and framing. Keep every person and object where it is, at the same size, in the same pose.",
    "Replace the grey placeholder figures with real people and the grey blocks with the real furniture and props they stand for. Keep the light falling the way the render shows it.",
  );

  const title = p.shotTitle.replace(/\s+/g, " ").trim();
  if (title) lines.push(`The shot: ${title}.`);

  const names = Array.from(
    new Set(
      p.items
        .filter((i) => !SKIP.test(i.kind))
        .map((i) => i.name.replace(/\s+/g, " ").trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 14);
  if (p.setKind === "room") {
    const floor = p.floor ? `, ${p.floor.toLowerCase()} floor` : "";
    lines.push(`Location: a real interior${floor}${names.length ? `, with ${names.join(", ")}` : ""}.`);
  } else if (names.length) {
    lines.push(`On set: ${names.join(", ")}.`);
  }

  if (p.talent.length) {
    const poses = p.talent.map((t) => t.poseName.toLowerCase()).join(", ");
    lines.push(`${p.talent.length} ${plural(p.talent.length, "person", "people")} (${poses}).`);
  }

  lines.push("Natural skin, real materials, cinematic lighting. No text, no logos, no watermark.");
  return lines.join(" ");
}
