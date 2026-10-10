/**
 * The client portal: one link per project listing everything already shared
 * with the client, sorted by what is waiting on them.
 *
 * Pure and not `server-only`, so the status rules are testable and the page
 * and the studio's preview cannot disagree about them.
 *
 * THE PORTAL HOLDS NOTHING OF ITS OWN. Every item is a live review link the
 * studio already created one at a time, so a deliverable nobody has shared
 * never appears, the same "default off" rule the binder follows.
 */

export type PortalItemState = "waiting" | "changes" | "approved";

/**
 * Where an item stands for the CLIENT, from their own decision through their
 * link. For an asset that is the decision on the CURRENT version, so a new
 * version after a change request reads as waiting on them again, which is
 * exactly what has happened.
 */
export function clientItemState(
  decision: string | null | undefined
): PortalItemState {
  if (decision === "approved") return "approved";
  if (decision === "changes_requested") return "changes";
  return "waiting";
}

export const STATE_LABEL: Record<PortalItemState, string> = {
  waiting: "Waiting on you",
  changes: "Changes requested",
  approved: "Approved",
};

/** The sentence under a section heading, written to the client. */
export const STATE_HINT: Record<PortalItemState, string> = {
  waiting: "Open each one to comment, then approve or request changes.",
  changes: "You asked for changes. The studio is working on them.",
  approved: "Signed off. Nothing more needed from you.",
};

export const STATE_ORDER: PortalItemState[] = ["waiting", "changes", "approved"];

export type PortalItemBase = {
  state: PortalItemState;
  dueDate: string | null;
  sharedAt: string;
  title: string;
};

/**
 * True when a due date has passed and the client still owes a decision.
 * `todayIso` comes from the server, like the slate and the payment schedule,
 * so the page cannot disagree with itself after hydration.
 */
export function isOverdue(
  item: Pick<PortalItemBase, "state" | "dueDate">,
  todayIso: string
): boolean {
  if (item.state !== "waiting" || !item.dueDate) return false;
  return item.dueDate.slice(0, 10) < todayIso.slice(0, 10);
}

/**
 * Items grouped by state in STATE_ORDER, empty groups dropped. Inside a
 * group: the earliest due date first (undated last, since a date nobody set
 * cannot be the most urgent), then the most recently shared.
 */
export function groupPortalItems<T extends PortalItemBase>(
  items: T[]
): { state: PortalItemState; items: T[] }[] {
  return STATE_ORDER.map((state) => ({
    state,
    items: items
      .filter((i) => i.state === state)
      .sort((a, b) => {
        const ad = a.dueDate ?? "";
        const bd = b.dueDate ?? "";
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad < bd ? -1 : 1;
        }
        if (a.sharedAt !== b.sharedAt) return a.sharedAt < b.sharedAt ? 1 : -1;
        return a.title.localeCompare(b.title);
      }),
  })).filter((g) => g.items.length > 0);
}

/** "2 things are waiting on you", or null when nothing is. */
export function waitingSummary(items: PortalItemBase[]): string | null {
  const n = items.filter((i) => i.state === "waiting").length;
  if (n === 0) return null;
  return n === 1 ? "1 thing is waiting on you" : `${n} things are waiting on you`;
}
