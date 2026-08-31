import { newItemFields, type DroppableKind } from "@/lib/board-defaults";

/**
 * Drag a picture of the CARD, not a picture of the button.
 *
 * HTML5 drag-and-drop uses the dragged element itself as the drag image unless
 * you say otherwise, and the dragged element here is a 40px icon in the rail.
 * So dragging a note showed a small grey glyph with a tooltip stuck to it: a
 * label for the tool rather than a preview of the thing being placed. You could
 * not see what size it would be or where its edges would fall until you let go.
 *
 * This draws the actual card instead, at its real size, translucent, so the
 * drag reads as carrying the card to a spot rather than as carrying an icon
 * that will later become one.
 *
 * MECHANICS WORTH KNOWING, because each one is a way this silently does
 * nothing:
 * - setDragImage must be given an element that is IN THE DOCUMENT and
 *   rendered. `display:none` produces no image at all, so the ghost is placed
 *   far off-screen instead.
 * - The browser snapshots it synchronously during dragstart, so it can be
 *   removed on the next tick and never blinks on screen.
 * - The snapshot is taken once. Nothing about the ghost can animate or update
 *   during the drag.
 */
export function setCardDragImage(
  e: React.DragEvent,
  kind: DroppableKind,
  shape?: string,
) {
  if (typeof document === "undefined" || !e.dataTransfer.setDragImage) return;
  const f = newItemFields(kind, shape);

  const ghost = document.createElement("div");
  ghost.style.cssText = [
    "position:fixed",
    // Off-screen rather than hidden: it has to render to be snapshotted.
    "left:-10000px",
    "top:0",
    `width:${f.w}px`,
    `height:${f.h}px`,
    "border-radius:12px",
    "border:1px solid var(--border)",
    "box-shadow:0 8px 24px rgba(0,0,0,.14)",
    "opacity:0.75",
    "box-sizing:border-box",
    "padding:12px",
    "font:600 13px/1.3 var(--font-sans, system-ui)",
    "color:var(--text-muted)",
    `background:${cardBackground(kind, f.hue)}`,
  ].join(";");
  ghost.textContent = LABEL[kind] ?? "";
  document.body.appendChild(ghost);

  // Grab it by the middle, so the card sits under the cursor rather than
  // hanging off to one side of it.
  e.dataTransfer.setDragImage(ghost, f.w / 2, f.h / 2);
  // The snapshot is already taken; the node has done its job.
  window.setTimeout(() => ghost.remove(), 0);
}

const LABEL: Partial<Record<DroppableKind, string>> = {
  note: "Note",
  todo: "To-do",
  column: "Column",
  heading: "Heading",
};

/** Close enough to the real card to read as it while it is moving. */
function cardBackground(kind: DroppableKind, hue: string | null): string {
  if (kind === "color") return "var(--accent)";
  if (kind === "shape") return "var(--surface-2)";
  if (kind === "heading") return "transparent";
  return hue ? `var(--h-${hue}-bg, var(--surface))` : "var(--surface)";
}
