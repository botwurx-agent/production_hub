// Guided tours.
//
// The distinction that keeps these honest, and that section 4.1 forces: a tour
// here is ORIENTATION, never INSTRUCTION. It answers "what is here and where
// does it live", which is a wayfinding problem this app has because it is
// large. It must never answer "how do I fill in this form", because a form
// that needs explaining is a form that needs fixing, and a tour over the top
// of it hides the bug rather than paying for it.
//
// Practical rule when adding a step: if you find yourself writing the word
// "click", stop. That is instruction. Say what a thing is FOR and move on.

export type TourStep = {
  /**
   * The value of a data-tour attribute in the DOM. A step whose anchor is not
   * on the page is SKIPPED, never shown pointing at nothing. That is what
   * makes a tour safe to keep: a refactor that removes an element degrades the
   * tour by one step instead of breaking it.
   *
   * Empty string means a centred card with no anchor, for an opening or
   * closing note.
   */
  anchor: string;
  title: string;
  body: string;
  /** Preferred side of the anchor. The runner flips when there is no room. */
  place?: "top" | "bottom" | "left" | "right";
};

export type Tour = {
  id: string;
  /** Shown in the replay menu. */
  label: string;
  steps: TourStep[];
};

export const TOURS: Tour[] = [
  {
    id: "welcome",
    label: "Take the tour",
    steps: [
      {
        anchor: "",
        title: "Welcome to Studio Flows",
        body: "Thirty seconds on where things live. You can skip this and come back to it from your account menu whenever.",
      },
      {
        anchor: "setup",
        title: "Start here",
        body: "These five steps set the studio up. They tick themselves off as you do the real thing, so there is nothing to mark complete, and the whole block disappears once they are done.",
        place: "bottom",
      },
      {
        anchor: "nav",
        title: "The whole studio, in order",
        body: "Pipeline is work you are bidding on. Projects is work you won. Clients holds the companies behind both, Boards is where you think, and Communication pulls your email and chat threads onto the job they belong to.",
        place: "right",
      },
      {
        anchor: "runner",
        title: "Runner",
        body: "Ask it anything about your jobs, your money or what is going cold, and tell it what to log. It reads the studio and proposes changes as cards you confirm, so it never changes anything on its own.",
        place: "right",
      },
      {
        anchor: "notifications",
        title: "When a client responds",
        body: "Approvals, comments and confirmations land here, so a client signing off on a cut does not depend on you refreshing a page to find out.",
        place: "bottom",
      },
      {
        anchor: "",
        title: "That is the shape of it",
        body: "Open a project and the same tour is waiting there for the parts of a job. Nothing else will interrupt you.",
      },
    ],
  },
  {
    id: "project-hub",
    label: "Tour this project",
    steps: [
      {
        anchor: "lifecycle",
        title: "Where the job stands",
        body: "Pre-production, production, post, delivered. This is the one place the stage is set, and everything else on the page reads from it.",
        place: "bottom",
      },
      {
        anchor: "band-plan",
        title: "The job, in the order you do it",
        body: "The cards below are grouped by phase rather than by feature, so the page reads like the job runs: plan it, visualise it, review it, produce it. Each card shows live data and opens its own page.",
        place: "right",
      },
      {
        anchor: "band-review",
        title: "Two kinds of review",
        body: "Assets is the whole library. Review is only what is actually in the round, and it is where a share link goes out to a client who has no login and comes back as pinned comments and a decision.",
        place: "right",
      },
      {
        anchor: "band-produce",
        title: "The paperwork side",
        body: "Roster, dates, call sheets, budget, agreements and delivery. The budget is the one worth knowing about: costs come in as invoices with their own payment schedules, so it can tell you what is still owed rather than just what you guessed.",
        place: "right",
      },
      {
        anchor: "attention",
        title: "What is waiting on you",
        body: "Anything stalled on this job surfaces here, so the thing that needs a nudge is not buried three pages in.",
        place: "left",
      },
    ],
  },
];

export function findTour(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}

/** localStorage key recording that a tour has run for this browser. */
export function tourSeenKey(id: string): string {
  return `tour.seen.${id}`;
}
