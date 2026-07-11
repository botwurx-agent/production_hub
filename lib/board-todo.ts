// A board to-do / checklist card stores its rows as JSON in board_items.text.
// Shared so both the canvas render and the contextual TodoPanel operate on the
// same shape.

export type TodoRow = { id: string; text: string; done: boolean };

export function parseTodo(text: string | null): TodoRow[] {
  if (!text) return [];
  try {
    const a = JSON.parse(text);
    if (!Array.isArray(a)) return [];
    return a
      .filter((r) => r && typeof r.text === "string")
      .map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        text: r.text as string,
        done: Boolean(r.done),
      }));
  } catch {
    return [];
  }
}

export function serializeTodo(rows: TodoRow[]): string {
  return JSON.stringify(rows);
}
