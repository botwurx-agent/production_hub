/**
 * The feature IA as data: one array drives the nav dropdown, the /features
 * overview, each /features/[slug] page, the footer column, and the home page's
 * "more about" links, so none of them can drift apart on a name or a route.
 *
 * Granularity is deliberate: a page per ARGUMENT (seven of them), not a page
 * per app module. The app has twenty-odd modules; twenty thin pages would
 * outrun the screenshots we can honestly take and read as padding. Each page
 * here rolls up the modules that make one promise together, and can split
 * later if a single module earns its own landing page.
 *
 * Every claim in `blocks` names something built and reachable in the app
 * today, the same rule the pricing table follows.
 */

export type FeatureShot = {
  /** Basename in public/marketing/shots, without extension. */
  shot: string;
  caption: string;
  alt: string;
};

export type FeatureBlock = {
  title: string;
  body: string;
  points: string[];
};

export type FeatureDef = {
  slug: string;
  /** Short label for the nav dropdown and footer. */
  nav: string;
  /** One-line hint under the dropdown label. */
  hint: string;
  /** Identity hue for the dot, wash, and placeholder tint. */
  hue: string;
  /** Page h1. */
  title: string;
  /** Page lede; also the meta description. */
  lede: string;
  shots: FeatureShot[];
  blocks: FeatureBlock[];
  /** Slugs of the two features to cross-link at the foot of the page. */
  related: string[];
};

export const FEATURES: FeatureDef[] = [
  {
    slug: "project-hub",
    nav: "Project hub",
    hint: "The whole job on one page",
    hue: "indigo",
    title: "One home for the whole job.",
    lede: "A project in Studio Flows is not a folder of files. It is the production itself: the brief, the boards, the crew, the money and the delivery, organized into the phases a real job moves through.",
    shots: [
      {
        shot: "projects-board",
        caption: "app.studio-flows.com/projects",
        alt: "The projects board: every job on one board, moving from pre-pro to delivered.",
      },
    ],
    blocks: [
      {
        title: "Open a job, see everything",
        body: "The hub lays the job out in the order the work happens: Plan, Visualize, Review, Produce. Every card shows live state, so the page answers questions before you click.",
        points: [
          "A lifecycle stepper that speaks your job's language: an AI job reads Concept and Generation, a live-action job reads Shoot",
          "Cards carry live data: the brief's first lines, asset thumbnails, the budget bar, review status",
          "A needs-attention rail that surfaces the one thing waiting on you",
          "An AI project summary: where the job stands, in five lines",
        ],
      },
      {
        title: "Every job across the studio",
        body: "The projects page reads three ways: a board by stage, a list, and the slate, a timeline with one lane per job so the month reads at a glance.",
        points: [
          "Board columns per stage, color as signal, never decoration",
          "The slate flags days carrying more than one shoot",
          "A job past its due date draws an overdue bar that runs to today",
          "Archived jobs keep everything and stay out of your way",
        ],
      },
      {
        title: "Tasks, boards, and the paperwork",
        body: "The connective tissue every job needs, living with the job instead of in three other apps.",
        points: [
          "A task board with drag-and-drop, several assignees, named checklists, files and notes per card",
          "Freeform moodboards: notes, shapes, arrows, columns, links, video, images from Drive and Figma",
          "A documents page that remembers who sent each file, when, and in which email",
          "Per-project contacts organized into crew, talent, clients and vendors",
        ],
      },
    ],
    related: ["client-review", "production"],
  },
  {
    slug: "client-review",
    nav: "Client review",
    hint: "Approvals without the login wall",
    hue: "green",
    title: "Client review without the login wall.",
    lede: "Send a link. The client opens it in the browser, pins notes to the exact frame or the exact second, and approves on the record. No account, no tutorial, no excuse.",
    shots: [
      {
        shot: "client-review-portal",
        caption: "studio-flows.com/r/shared-link",
        alt: "The client review portal: a hero frame with numbered comment pins and the comment rail beside it.",
      },
    ],
    blocks: [
      {
        title: "Notes that land where they belong",
        body: "A note here is attached to the thing it is about, not floating in an email three replies deep.",
        points: [
          "Numbered pins on a still, timecode and range comments on a cut",
          "Page-by-page pins on a PDF, so a board reads like a board",
          "Draw on the frame: arrows, boxes, freehand, when words are slower than a circle",
          "Threads, replies and reactions, with edit and delete on your own notes",
        ],
      },
      {
        title: "A player built for finishing",
        body: "The review player carries the tools a commercial actually gets judged with.",
        points: [
          "Broadcast timecode, J/K/L shuttle, frame stepping, loop and speed",
          "Safe-area guides and 1:1, 4:5 and 9:16 crop masks: does the product survive the crop",
          "Zoom to 4x with pan, and a one-click frame export",
          "The same canvas serves stills, video, PDFs and whole documents",
        ],
      },
      {
        title: "Versions and the sign-off",
        body: "Nothing gets lost between rounds, and the decision is a record instead of a hallway remark.",
        points: [
          "Every version kept, with the notes that belong to it",
          "Switch versions inside the portal, or compare two side by side",
          "Approve or request changes in one click, on the record",
          "Due dates with automatic reminders, bounded so clients are nudged, never nagged",
        ],
      },
    ],
    related: ["communication", "ai-pipeline"],
  },
  {
    slug: "communication",
    nav: "Communication",
    hint: "Gmail, Slack and Chat, filed with the job",
    hue: "cyan",
    title: "The conversation, filed with the job.",
    lede: "Nobody moves their client onto a new chat app, so we do not ask. Gmail, Slack and Google Chat stay exactly where they are: Studio Flows links the thread to the project, and the job's whole conversation reads in one place.",
    shots: [
      {
        shot: "project-communication",
        caption: "app.studio-flows.com/projects/bright-water/communication",
        alt: "The Communication page: linked Gmail threads, Slack channels and a Google Chat space, all on one project.",
      },
    ],
    blocks: [
      {
        title: "Read and reply in place",
        body: "The linked thread is live, not a copy. You answer the client from the job, and the reply lands in the real thread.",
        points: [
          "Gmail threads, Slack channels and Chat spaces side by side on one page",
          "Reply with attachments from your device, the project's assets, or Drive",
          "An unread count per conversation, so nothing sits unseen",
          "Files too big to attach go out as a link instead, automatically",
        ],
      },
      {
        title: "Attachments become work",
        body: "The thing a client emails you is almost never just a file. One click files it where it actually belongs.",
        points: [
          "Add an attachment to the project's assets, versioned like everything else",
          "File a PDF into project documents, with who sent it and when",
          "Log an emailed invoice as a cost: AI reads the amount, vendor and dates into a draft you confirm",
          "Provenance kept everywhere, so 'which email did this come in' has an answer",
        ],
      },
      {
        title: "Polish before you send",
        body: "A rewrite button, not an autopilot. Nothing runs until you press it and nothing sends itself.",
        points: [
          "Four one-press intents: Polish, Shorten, Warm up, Firm up",
          "The rewrite replaces your draft in place, with undo back to your exact words",
          "You read it, you edit it, you press Send",
        ],
      },
    ],
    related: ["project-hub", "budget"],
  },
  {
    slug: "production",
    nav: "Call sheets & shot lists",
    hint: "Shoot-day paper that runs itself",
    hue: "amber",
    title: "Call sheets that confirm themselves.",
    lede: "Build the sheet on the sheet, send each person their own link, and watch the confirmations come back. The chasing happens without you.",
    shots: [
      {
        shot: "project-callsheet",
        caption: "app.studio-flows.com/projects/bright-water/callsheet",
        alt: "A call sheet with per-recipient confirmed chips beside the crew roster.",
      },
    ],
    blocks: [
      {
        title: "The call sheet",
        body: "You edit the real sheet, in the industry layout crew expect, not a form that becomes one later.",
        points: [
          "Masthead, schedule, locations, contacts, cast and crew, edited in place",
          "Reorder blocks by drag, add custom ones, save the layout as a template",
          "Your logo and accent color, and a one-click PDF",
          "Several sheets per job, one per shoot day",
        ],
      },
      {
        title: "Who has answered",
        body: "The sheet tracks itself: who opened it, who confirmed, who needs a nudge. You read a number instead of a thread.",
        points: [
          "Per-person links with viewed and confirmed tracking",
          "Automatic reminders as the shoot gets close: never before three days out, capped, and they stop the moment someone confirms",
          "Confirmed, viewed-but-quiet, and never-opened, each one click apart",
          "Crew lunch: paste the group-order link, set a cutoff, we chase the stragglers",
        ],
      },
      {
        title: "Shot lists and storyboards",
        body: "The planning documents feed each other, so nothing is retyped between them.",
        points: [
          "Shot rows with size, type and movement, in lists you can duplicate and reorder",
          "Structured storyboard frames with scene, description and sound",
          "Import a client's PDF deck: frames, captions and shots read out of the file",
          "Matching print covers, so the paperwork leaves the studio looking related",
        ],
      },
    ],
    related: ["project-hub", "budget"],
  },
  {
    slug: "budget",
    nav: "Budget & invoicing",
    hint: "What it cost, what you billed",
    hue: "blue",
    title: "The money, both directions.",
    lede: "What the job cost and what you billed, on the same page as the job. Every number backed by the document behind it, down to the margin the job actually made.",
    shots: [
      {
        shot: "project-budget",
        caption: "app.studio-flows.com/projects/bright-water/budget",
        alt: "The budget page: bid against actual, the cost ledger beneath it, and the margin band.",
      },
      {
        shot: "project-invoices",
        caption: "app.studio-flows.com/projects/bright-water/invoices",
        alt: "The document workspace: an estimate, a signed proposal, and an invoice, with the document edited in place beside them.",
      },
    ],
    blocks: [
      {
        title: "Costs with receipts",
        body: "Actual is a ledger, not a number you typed once. Three weeks later you can still say where every dollar went.",
        points: [
          "Bid against actual, line by line, with the variance in front of you",
          "Every cost carries the invoice it came from",
          "AI reads an emailed invoice into a draft cost you confirm before anything is saved",
          "Day rates checked against what was agreed, flagged when an invoice runs over",
        ],
      },
      {
        title: "Deposits and what is still owed",
        body: "A cost is a commitment and the payments against it are tracked separately, because that is how vendors actually bill.",
        points: [
          "Split any cost into a deposit and balance with two due dates",
          "Still-owed is exact: a part-paid commitment reports only its remainder",
          "A studio-wide unpaid view, sorted by the next payment due",
          "Agreements filed alongside: NDAs, MSAs, SOWs, with both signatures tracked",
        ],
      },
      {
        title: "Documents clients sign",
        body: "Estimates, proposals and invoices generated in the app, in your numbering and your style, delivered however the client works.",
        points: [
          "Proposals signed online, typed or drawn, with the audit trail behind it",
          "Sent as a link, an email, or a one-click PDF",
          "Three templates, your accent color, your terms",
          "Margin on the job once both sides are in: billed against cost, stated plainly",
        ],
      },
    ],
    related: ["production", "communication"],
  },
  {
    slug: "ai-pipeline",
    nav: "AI pipeline",
    hint: "Run AI video like a production",
    hue: "purple",
    title: "Run AI video like a production.",
    lede: "Generation tools hand you a hundred candidates and no way to run a job on them. Studio Flows is the production layer over the tools: script to shots to takes to the master cut, with provenance on everything.",
    shots: [
      {
        shot: "project-pipeline",
        caption: "app.studio-flows.com/projects/lumen-concept-reel/pipeline",
        alt: "The AI pipeline: generated candidates for a shot, with provenance on every clip.",
      },
    ],
    blocks: [
      {
        title: "From script to sequence",
        body: "The job keeps a production's shape even when the camera is a model: a script, a sequence of shots, and stages each shot moves through.",
        points: [
          "A script editor beside the sequence strip, read while you build",
          "Per-shot image and video stages, with references attached where they were used",
          "Flexible input modes: start and end frames, image to video, video to video, text to video",
          "Voiceover as its own stage, so the read stays paired with its clip",
        ],
      },
      {
        title: "Triage the fan-out",
        body: "Judging a batch of forty clips is the real work. The triage view makes it minutes, keyboard first.",
        points: [
          "Full-screen triage: reject, star, tag start or end, pick the take, all from the keys",
          "Compare up to four near-identical takes side by side",
          "Import a whole batch by pasting links: platform, resolution and duration stamped automatically",
          "Provenance on every clip: platform, model, seed, prompt",
        ],
      },
      {
        title: "Consistency, and the pick",
        body: "The pieces that keep a job coherent across a hundred generations, and the handoff when it is done.",
        points: [
          "Reusable elements with handles, so a character and a look hold across shots",
          "A prompt and style library shared across the project",
          "Send a no-login link where a client stars and picks between takes",
          "Master cut versions reviewed on the same timecode canvas as everything else",
        ],
      },
    ],
    related: ["client-review", "project-hub"],
  },
  {
    slug: "runner",
    nav: "Runner, the assistant",
    hint: "Asks nothing, answers everything",
    hue: "pink",
    title: "An assistant that never goes behind your back.",
    lede: "Runner reads the studio's real data to answer what is stalled, who owes what, and where a job stands. When it wants to change anything, it writes a card listing every value and waits for you to press Create.",
    shots: [
      {
        shot: "runner-panel",
        caption: "Runner",
        alt: "The Runner panel proposing a cost as a card, every value listed, with Create and Cancel.",
      },
    ],
    blocks: [
      {
        title: "Answers from live data",
        body: "Not a chatbot with opinions: every answer is read out of the same tables the pages render.",
        points: [
          "'What is still waiting on a client?', answered by name",
          "'Which vendors are we late paying?', with the amounts",
          "Questions nobody wrote a report for, answered anyway",
          "Opens over whatever you are reading, scoped to the project you are on",
        ],
      },
      {
        title: "Proposes, never commits",
        body: "The contract is the feature: the model assists, the human commits, every time.",
        points: [
          "Every change is a card listing every value that would be saved",
          "Nothing writes until you press Create, and Cancel costs nothing",
          "Confirming runs the same actions the buttons run, with the same permissions",
          "No deletes, no sends, nothing that leaves the building",
        ],
      },
      {
        title: "AI through the whole app",
        body: "The same assist-and-confirm contract shows up wherever it saves real time.",
        points: [
          "An emailed invoice read into a cost draft you check before saving",
          "A received SOW read into deliverables, proposed as a checklist",
          "Project summaries and drafted client updates, always yours to edit",
          "The Polish button in every composer, with undo to your exact words",
        ],
      },
    ],
    related: ["budget", "ai-pipeline"],
  },
];

export function featureBySlug(slug: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

/**
 * THE MODULE LAYER (operator, 2026-08-24): the ~two dozen project features,
 * each with its own named, linkable showcase. The seven pages above are the
 * shelves; every module lives on one of them as an anchored block, is listed
 * by name in the nav dropdown, and appears in the /features inventory grouped
 * by the app's own hub bands (Plan / Visualize / Review / Produce), which is
 * itself the pitch: the marketing site mirrors the product's real structure.
 *
 * Anchored blocks rather than 24 standalone pages, deliberately: a module page
 * with no screenshot of its own reads as padding, and the site's standing rule
 * is real shots only. A module that later earns its own landing page graduates
 * by adding a FeatureDef; its link here just changes target.
 */

export type ModuleBand = "plan" | "visualize" | "review" | "produce";

export const MODULE_BANDS: { key: ModuleBand; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "visualize", label: "Visualize" },
  { key: "review", label: "Review" },
  { key: "produce", label: "Produce" },
];

export type ModuleDef = {
  /** Anchor id on its page, and the stable key. */
  key: string;
  name: string;
  band: ModuleBand;
  /** Slug of the feature page the module's showcase lives on. */
  page: string;
  hue: string;
  /** One-line pitch, shown in the inventory and under the block title. */
  blurb: string;
  points: string[];
};

export function moduleHref(m: ModuleDef): string {
  return `/features/${m.page}#${m.key}`;
}

export function modulesForPage(slug: string): ModuleDef[] {
  return MODULES.filter((m) => m.page === slug);
}

export const MODULES: ModuleDef[] = [
  // ---- Plan ----
  {
    key: "brief",
    name: "Brief",
    band: "plan",
    page: "project-hub",
    hue: "indigo",
    blurb: "The creative direction, attached to the job it directs.",
    points: [
      "The brief and its attachments live on the project, not in a search",
      "The first thing anyone joining the job reads",
      "Its opening lines show on the hub card, so the job introduces itself",
    ],
  },
  {
    key: "assets",
    name: "Assets & versions",
    band: "plan",
    page: "project-hub",
    hue: "blue",
    blurb: "The project's full library, where nothing is named FINAL_v2.",
    points: [
      "Upload from the device, or import from Drive and Figma",
      "Every file keeps its version history, with the notes per version",
      "Statuses move a file into the review cycle when it is ready",
    ],
  },
  {
    key: "documents",
    name: "Documents",
    band: "plan",
    page: "project-hub",
    hue: "cyan",
    blurb: "Permits, certificates and specs, filed with their provenance.",
    points: [
      "One click files a PDF straight out of the linked email",
      "Each document remembers who sent it, when, and in which thread",
      "Page-one previews, so a folder of PDFs reads at a glance",
    ],
  },
  {
    key: "tasks",
    name: "Tasks",
    band: "plan",
    page: "project-hub",
    hue: "green",
    blurb: "A drag-and-drop board for everything the job owes.",
    points: [
      "Columns by status or by phase, and a Waiting column for work sitting with others",
      "Several assignees, named checklists, files and notes per card",
      "A list view for the days when the question is what is next",
    ],
  },
  {
    key: "contacts",
    name: "Project contacts",
    band: "plan",
    page: "project-hub",
    hue: "amber",
    blurb: "One roster per job: crew, talent, clients and vendors.",
    points: [
      "Positions, day rates, and notes per person",
      "Talent profiles carry wardrobe sizes, dietary needs and representation",
      "Pull people in from the client's contacts without retyping",
    ],
  },
  {
    key: "calendar",
    name: "Project calendar",
    band: "plan",
    page: "project-hub",
    hue: "purple",
    blurb: "The job's own dates, month and agenda.",
    points: [
      "Pre-pro, shoot, review and delivery events, color coded",
      "Shoot and due dates appear as milestones on their own",
      "Multi-day events span the range, the way a shoot actually does",
    ],
  },
  {
    key: "people",
    name: "People & access",
    band: "plan",
    page: "project-hub",
    hue: "pink",
    blurb: "Studio members, project collaborators, and review-only access.",
    points: [
      "Invite a freelancer to one job, not the whole studio",
      "Collaborators never see rates, budgets, or other clients",
      "A reviewer tier that can comment and approve but not edit",
    ],
  },

  // ---- Visualize ----
  {
    key: "storyboards",
    name: "Storyboards",
    band: "visualize",
    page: "production",
    hue: "purple",
    blurb: "Structured frame grids with scene, description and sound.",
    points: [
      "Frames from upload, project assets, or a client's PDF deck",
      "Several boards per job, each its own ordered grid",
      "Print and share views dressed to match the shot list",
    ],
  },
  {
    key: "shot-list",
    name: "Shot lists",
    band: "visualize",
    page: "production",
    hue: "amber",
    blurb: "Shot rows a producer can sort a day by.",
    points: [
      "Size, type and movement per shot, free text welcome",
      "Duplicate, reorder, and move shots between lists",
      "Read out of a treatment PDF instead of retyped",
    ],
  },
  {
    key: "moodboard",
    name: "Moodboards",
    band: "visualize",
    page: "production",
    hue: "pink",
    blurb: "A freeform canvas for the look.",
    points: [
      "Images, notes, shapes, arrows, columns, links and video",
      "Import from Drive and Figma, or paste from anywhere",
      "Share a view-only link, or send it for pinned review",
    ],
  },
  {
    key: "pipeline",
    name: "AI pipeline",
    band: "visualize",
    page: "ai-pipeline",
    hue: "purple",
    blurb: "Script to shots to takes, with provenance on everything.",
    points: [
      "Per-shot image and video stages, references attached where used",
      "Keyboard-first triage of a generation batch",
      "Platform, model, seed and prompt kept on every clip",
    ],
  },
  {
    key: "elements",
    name: "Elements",
    band: "visualize",
    page: "ai-pipeline",
    hue: "indigo",
    blurb: "Reusable characters, locations and looks, with handles.",
    points: [
      "A library of named elements with the handle the platform uses",
      "A usage map: which shots each element appears in",
      "Prompt checks that catch a handle no reference owns",
    ],
  },

  // ---- Review ----
  {
    key: "review",
    name: "Review & approvals",
    band: "review",
    page: "client-review",
    hue: "green",
    blurb: "Pins, timecodes and sign-off, on every version.",
    points: [
      "Internal review and client review, kept separate",
      "Pinned comments on stills, timecoded notes on cuts, pages on PDFs",
      "Approve or request changes on the record",
    ],
  },
  {
    key: "binder",
    name: "Client binder",
    band: "review",
    page: "client-review",
    hue: "indigo",
    blurb: "Everything the client asked to see, on one link.",
    points: [
      "A checklist over the project: everything is off until you say so",
      "Boards, shot lists, call sheets and contacts, rendered as approved",
      "One link for the client, one PDF when they want paper",
    ],
  },
  {
    key: "batch-review",
    name: "Batch review",
    band: "review",
    page: "ai-pipeline",
    hue: "pink",
    blurb: "Send a set of candidates, collect stars and a pick.",
    points: [
      "Curate which candidates go out, keep the rest private",
      "The reviewer stars a shortlist and marks one pick, no login",
      "Their feedback lands back on the shot, yours to act on",
    ],
  },
  {
    key: "master-cut",
    name: "Master cut",
    band: "review",
    page: "ai-pipeline",
    hue: "blue",
    blurb: "The assembled cut, versioned and reviewed like everything else.",
    points: [
      "Upload each cut as a version, from a file or a link",
      "Timecoded feedback on the same player the client uses",
      "Round by round, until the sign-off",
    ],
  },
  {
    key: "communication",
    name: "Communication",
    band: "review",
    page: "communication",
    hue: "cyan",
    blurb: "Gmail, Slack and Google Chat, linked to the job.",
    points: [
      "Read and reply without leaving the project",
      "Attachments filed into assets, documents or the budget in one click",
      "The conversation stays where it always lived",
    ],
  },

  // ---- Produce ----
  {
    key: "callsheet",
    name: "Call sheets",
    band: "produce",
    page: "production",
    hue: "amber",
    blurb: "Industry-layout sheets that chase their own confirmations.",
    points: [
      "Edited in place, in the layout crew expect",
      "Per-person links with viewed and confirmed tracking",
      "Automatic nudges as the shoot gets close, bounded so nobody is nagged",
    ],
  },
  {
    key: "gear",
    name: "Gear & crew",
    band: "produce",
    page: "production",
    hue: "blue",
    blurb: "The checklist of kit and people, with day rates.",
    points: [
      "Confirmed counts at a glance",
      "Day rates per line, visible to the studio only",
      "Feeds the budget, where the day count lives",
    ],
  },
  {
    key: "props",
    name: "Props",
    band: "produce",
    page: "production",
    hue: "green",
    blurb: "Sourcing options per prop, and a client pick.",
    points: [
      "Each prop holds its options; picking one settles it",
      "Client sign-off through the same review portal",
      "The pinned comment lands on the third glass, not on an email",
    ],
  },
  {
    key: "budget",
    name: "Budget",
    band: "produce",
    page: "budget",
    hue: "blue",
    blurb: "Bid against actual, backed by a cost ledger.",
    points: [
      "Every cost carries its invoice",
      "Deposits and payment schedules, tracked to the day",
      "Margin on the job once billing is in",
    ],
  },
  {
    key: "invoices",
    name: "Invoices & estimates",
    band: "produce",
    page: "budget",
    hue: "green",
    blurb: "Estimates, proposals and invoices, signed online.",
    points: [
      "Your numbering, your template, your accent",
      "Proposals signed in the browser, with the audit trail",
      "Delivered as a link, an email, or a PDF",
    ],
  },
  {
    key: "delivery",
    name: "Delivery & billing",
    band: "produce",
    page: "budget",
    hue: "cyan",
    blurb: "Deliverables and billing status, through handoff.",
    points: [
      "Deliverables with quantities and due dates",
      "Read out of a signed SOW instead of retyped",
      "Billing status beside the work it bills for",
    ],
  },
  {
    key: "agreements",
    name: "Agreements",
    band: "produce",
    page: "budget",
    hue: "amber",
    blurb: "NDAs, MSAs, SOWs and change orders, both signatures tracked.",
    points: [
      "Masters on the client, SOWs on the job, linked",
      "Which side has signed, stated instead of hunted for",
      "Expiry flagged before a lapsed NDA surprises anyone",
    ],
  },
];
