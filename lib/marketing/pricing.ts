/**
 * The pricing page, as data.
 *
 * Pure and free of JSX so the plan cards, the sticky compare header and the
 * comparison rows all read the SAME numbers. The prices used to exist only in
 * whichever component drew them, which is how a page ends up saying $79 in the
 * card and $89 in the table.
 *
 * THE ONE RULE HERE: a row is only listed if the thing it names is built and
 * reachable in the product today. A pricing table is the most literal promise
 * on the site, and a checkmark next to something that does not exist is not
 * optimism, it is a refund. Anything shipped-but-hidden (billing documents are
 * reachable from the project hub, but their second entry point on the delivery
 * page is behind BILLING_ENABLED) gets listed once, on the strength of the
 * entry point that works.
 */

export type PlanId = "solo" | "studio" | "production";

export type Plan = {
  id: PlanId;
  name: string;
  /** Who this one is for, in a handful of words. */
  tagline: string;
  /** Dollars per month, billed monthly. */
  monthly: number;
  /** Dollars per month, billed annually. Ten months for twelve, exactly. */
  annual: number;
  /** The "everything in X, plus" line. Null on the first tier. */
  builds: string | null;
  points: string[];
  /**
   * The middle card is raised and badged, and its column is tinted through the
   * comparison table. One only: two badged cards is the same as none, since the
   * badge works by making a choice on behalf of someone who does not want to
   * make one.
   */
  featured?: boolean;
};

/**
 * Annual is shown as a per-month figure and billed for the year, which is the
 * shape every buyer in this category already reads. The discount is stated as
 * TWO MONTHS FREE rather than a percentage: a count of months is concrete and
 * 16.7% is arithmetic. The numbers below are exactly that, so the claim needs
 * no asterisk (35 x 10 / 12 = 29.17, and so on down).
 */
export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    tagline: "One producer running their own jobs.",
    monthly: 35,
    annual: 29,
    builds: null,
    points: [
      "1 seat",
      "3 active projects, archived jobs do not count",
      "250GB storage",
      "150 Runner turns a month",
      "The whole production toolkit, nothing held back",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "A team running several jobs at once.",
    monthly: 95,
    annual: 79,
    builds: "Solo",
    featured: true,
    points: [
      "5 seats, then $18 each",
      "Unlimited active projects",
      "1TB storage",
      "600 Runner turns a month",
      "Budget, cost ledger and margin",
      "Clients, deals and the CRM timeline",
    ],
  },
  {
    id: "production",
    name: "Production",
    tagline: "A full production company, several teams deep.",
    monthly: 215,
    annual: 179,
    builds: "Studio",
    points: [
      "15 seats, then $14 each",
      "5TB storage",
      "2,500 Runner turns a month",
      "Onboarding and setup session",
      "Priority support",
    ],
  },
];

export function planPrice(plan: Plan, annual: boolean): number {
  return annual ? plan.annual : plan.monthly;
}

/** Per-seat cost at the included allowance, for the card's small print. */
export const SEAT_NOTE =
  "A seat is someone in your studio. Crew you book onto a job and clients reviewing work never need one, on any plan.";

/* -------------------------------------------------------------------------- */
/* Compare features                                                            */
/* -------------------------------------------------------------------------- */

/** true draws a tick, false draws nothing, a string prints itself. */
export type Cell = boolean | string;

export type CompareRow = {
  label: string;
  /** Order matches PLANS. */
  cells: [Cell, Cell, Cell];
};

export type CompareBand = {
  name: string;
  /**
   * The band's one-line pitch. This is the part of a comparison table that
   * earns its length: it turns a wall of ticks into a second features page for
   * a reader who arrived at pricing before they read anything else.
   */
  blurb: string;
  hue: string;
  /** 20x20 stroked path, matching the icon language used across the site. */
  icon: string;
  rows: CompareRow[];
};

const ALL: [Cell, Cell, Cell] = [true, true, true];
const PAID: [Cell, Cell, Cell] = [false, true, true];
const TOP: [Cell, Cell, Cell] = [false, false, true];

/**
 * Ordered so the argument lands in sequence: four bands of solid ticks first
 * (the entire craft of running a job, at every price), then the two bands that
 * hold a reason to move up, then the limits.
 */
export const COMPARE: CompareBand[] = [
  {
    name: "Plan",
    blurb: "The brief, every file, and the version history that keeps them straight.",
    hue: "indigo",
    icon: "M5 3h7l3 3v11H5z M12 3v3h3 M7.5 10h5 M7.5 13h4",
    rows: [
      { label: "Active projects", cells: ["3", "Unlimited", "Unlimited"] },
      { label: "Brief and creative direction", cells: ALL },
      { label: "Asset library with version history", cells: ALL },
      { label: "Documents: permits, specs, insurance", cells: ALL },
      { label: "Task board with assignees, files and checklists", cells: ALL },
      { label: "Project calendar and studio-wide slate", cells: ALL },
      { label: "Activity log and notifications", cells: ALL },
    ],
  },
  {
    name: "Visualize",
    blurb: "Boards, shot lists and generated work, all filed with the job they belong to.",
    hue: "purple",
    icon: "M3 5h6v5H3z M11 5h6v5h-6z M3 12h6v3H3z M11 12h6v3h-6z",
    rows: [
      { label: "Storyboards", cells: ALL },
      { label: "Shot lists", cells: ALL },
      { label: "Moodboards and freeform boards", cells: ALL },
      { label: "Read a PDF treatment into a shot list or storyboard", cells: ALL },
      { label: "AI pipeline: script, sequence and shot cockpit", cells: ALL },
      { label: "Keyboard-first triage of a generated batch", cells: ALL },
      { label: "Provenance on every take: platform, model, seed, prompt", cells: ALL },
      { label: "Reusable elements for characters, looks and locations", cells: ALL },
      { label: "Import takes from a generation tool by link", cells: ALL },
    ],
  },
  {
    name: "Review",
    blurb: "Where a client says yes, and where you can prove afterwards when they did.",
    hue: "green",
    icon: "M10 3a7 7 0 100 14 7 7 0 000-14z M7 10l2 2 4-4",
    rows: [
      { label: "Client review portal, no login for the client", cells: ALL },
      { label: "Pinned comments on stills, PDFs and documents", cells: ALL },
      { label: "Timecode and range comments on video", cells: ALL },
      { label: "Drawn markup on the frame", cells: ALL },
      { label: "Threaded replies and reactions", cells: ALL },
      { label: "Side by side version compare", cells: ALL },
      { label: "Due dates with automatic reminders", cells: ALL },
      { label: "Batch review: send options and get a pick back", cells: ALL },
      { label: "Internal sign-off, kept separate from the client review", cells: ALL },
    ],
  },
  {
    name: "Produce",
    blurb: "Shoot day, and everything that has to be true before it starts.",
    hue: "amber",
    icon: "M7 4H5.5v12h9V4H13 M7.6 2.9h4.8v2.3H7.6z M8 9h4 M8 12h4",
    rows: [
      { label: "Call sheet builder with saved templates", cells: ALL },
      { label: "Per-recipient links with view and confirm tracking", cells: ALL },
      { label: "Automatic confirmation chasing before the day", cells: ALL },
      { label: "Crew meal rounds with a group order link", cells: ALL },
      { label: "Crew, talent and vendor roster", cells: ALL },
      { label: "Talent profiles: wardrobe, dietary, representation", cells: ALL },
      { label: "Props with options and client sign-off", cells: ALL },
      { label: "Gear and crew booking", cells: ALL },
      { label: "Client binder: one link, only what you tick", cells: ALL },
      { label: "PDF export on every production document", cells: ALL },
    ],
  },
  {
    name: "The money",
    blurb: "What the job cost, what the client was billed, and what that leaves.",
    hue: "blue",
    icon: "M10 3.6v12.8 M12.9 6.6c-.5-.9-1.6-1.4-2.9-1.4-1.7 0-3 .9-3 2.1 0 2.9 6 1.6 6 4.5 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.6-3-1.5",
    rows: [
      { label: "Budget: bid against actual, line by line", cells: PAID },
      { label: "Cost ledger with the invoice attached to each entry", cells: PAID },
      { label: "Read a supplier invoice and fill the cost for you", cells: PAID },
      { label: "Deposits and payment schedules", cells: PAID },
      { label: "Margin on the job", cells: PAID },
      { label: "Estimates, proposals and invoices in your own numbering", cells: PAID },
      { label: "Proposals signed online, with the audit trail", cells: PAID },
      { label: "Agreements: NDAs, SOWs, change orders", cells: PAID },
    ],
  },
  {
    name: "Clients and pipeline",
    blurb: "The work you have not won yet, and the relationships that bring it back.",
    hue: "pink",
    icon: "M12.5 16v-1.4a2.8 2.8 0 00-2.8-2.8H6.3a2.8 2.8 0 00-2.8 2.8V16 M8 9.4a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2 M16.5 16v-1.4a2.8 2.8 0 00-2.1-2.7",
    rows: [
      { label: "Clients and contacts", cells: ALL },
      { label: "Deal pipeline board", cells: PAID },
      { label: "Relationship timeline with email logged automatically", cells: PAID },
      { label: "Follow-up tasks and reminders", cells: PAID },
      { label: "AI-drafted outreach", cells: PAID },
    ],
  },
  {
    name: "Runner",
    blurb: "The assistant that reads your studio and proposes, never writes on its own.",
    hue: "cyan",
    icon: "M4 6.5h12v8H4z M10 3v3.5 M7 10v1.5 M13 10v1.5 M2 8.5v4 M18 8.5v4",
    rows: [
      { label: "Ask anything about the studio, answered from live data", cells: ALL },
      { label: "Proposes a change as a card you confirm", cells: ALL },
      { label: "Turns a month", cells: ["150", "600", "2,500"] },
      { label: "Conversation history, private to you", cells: ALL },
    ],
  },
  {
    name: "Connections",
    blurb: "Nobody has to stop using the tools they already work in.",
    hue: "orange",
    icon: "M8.5 11.5a3 3 0 004.2 0l2.3-2.3a3 3 0 00-4.2-4.2l-1 1 M11.5 8.5a3 3 0 00-4.2 0L5 10.8a3 3 0 004.2 4.2l1-1",
    rows: [
      { label: "Gmail threads linked to a project", cells: ALL },
      { label: "Slack channels and Google Chat spaces", cells: ALL },
      { label: "Reply from the job, attachments and all", cells: ALL },
      { label: "Google Drive import", cells: ALL },
      { label: "Google Calendar, two way", cells: ALL },
      { label: "Figma frame import", cells: ALL },
    ],
  },
  {
    name: "Your studio",
    blurb: "Who is in it, how much room you have, and whose name is on the page.",
    hue: "indigo",
    icon: "M3 16.5V8l7-4.5L17 8v8.5z M8 16.5v-5h4v5",
    rows: [
      { label: "Seats included", cells: ["1", "5", "15"] },
      { label: "Additional seats", cells: [false, "$18 each", "$14 each"] },
      { label: "Crew and reviewers on a project", cells: ["Unlimited", "Unlimited", "Unlimited"] },
      { label: "Clients reviewing work", cells: ["Unlimited", "Unlimited", "Unlimited"] },
      { label: "Storage", cells: ["250GB", "1TB", "5TB"] },
      { label: "Roles: owner, admin, member, reviewer", cells: ALL },
      { label: "Your logo on the app and every document", cells: ALL },
      { label: "Light, paper and dark themes", cells: ALL },
      { label: "Onboarding and setup session", cells: TOP },
      { label: "Priority support", cells: TOP },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Eight, not fourteen. Every one of these is an objection that stops a purchase
 * rather than a billing mechanic somebody can find in their account. The first
 * slot goes to seats because it is the question this whole category gets asked
 * most, and answering it in an accordion means half the readers never see it.
 */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as a seat, and are clients and crew free?",
    a: "A seat is someone in your studio: a producer, a coordinator, anyone working across your jobs. People you bring onto a single job, a DP or an editor or an AD, get access to that job only and use no seat. Clients reviewing work need no account at all. Both are unlimited on every plan.",
  },
  {
    q: "What happens when I hit the project limit on Solo?",
    a: "Nothing locks and nothing is deleted. Archiving a finished job takes it out of the count, so three active projects means three at once rather than three ever. If you are genuinely running four jobs at the same time, that is the moment Studio starts paying for itself.",
  },
  {
    q: "What is a Runner turn?",
    a: "One question and the answer to it. Runner reading four things across the studio and coming back with a number is a single turn, not four. Everything else that uses AI here is unmetered: reading a supplier invoice, pulling deliverables out of a signed SOW, and polishing a message before you send it are all included on every plan.",
  },
  {
    q: "What counts toward storage?",
    a: "Files you upload or import: assets and their versions, cuts, generated takes, documents. Conversations you link from Gmail, Slack or Chat stay where they already live and count for nothing. Archived projects do not count either, so a studio with years of finished work behind it is not paying for the archive.",
  },
  {
    q: "Can I change plans in the middle of a month?",
    a: "Yes, in either direction, and the difference is prorated. An upgrade takes effect straight away rather than at the next renewal, because the reason people upgrade is usually a job starting on Monday.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. No contract, no notice period, and no call to sit through. An annual plan runs to the end of the term you have already paid for.",
  },
  {
    q: "What happens to my work if I stop paying?",
    a: "Your studio goes read-only rather than dark. Every project still opens and every file still downloads for 90 days, and nothing is deleted inside that window. Holding a client's masters hostage to a renewal is not a business we want to be in.",
  },
  {
    q: "Do you offer a student or education rate?",
    a: "Yes. Write to us from your institution address and we will sort it out.",
  },
];
