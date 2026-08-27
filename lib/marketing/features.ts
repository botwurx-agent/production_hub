import { FEATURE_SLUGS, type FeatureSlug } from "@/lib/marketing/feature-slugs";

/**
 * The feature IA as data: one array drives the nav dropdown, the /features
 * overview, each feature page, the cross-page mesh, the footer column, and the
 * home page's "more about" links, so none of them can drift apart on a name or
 * a route.
 *
 * RESTRUCTURED 2026-08-27 (operator's call): a page per FUNCTIONALITY at a
 * ROOT-LEVEL KEYWORD SLUG, not a page per argument under /features. Thirteen
 * pages, each built to own one search term ("call sheet software", "shot list
 * software"), because that is what people type and the URL is the first
 * ranking signal. /features stays as the overview index; the old
 * /features/<slug> pages 301 in next.config.mjs.
 *
 * The page SHAPE is swiped from how the category leader structures theirs,
 * then made ours: a keyword eyebrow over a CREATIVE h1 (the keyword lives in
 * the title tag, the voice lives in the headline), one real product shot as
 * early evidence, a tick grid that carries long-tail depth cheaply, one
 * differentiator band per page, and a closing mesh where every page links to
 * every other page grouped by the product's own phase bands. What we refuse
 * from that template: decorative color washes (our color is signal), invented
 * testimonials and logo walls (gaps stay gaps until real customers fill them),
 * and illustrated fake screenshots (our proof is the demo studio or a
 * token-drawn motif that clearly reads as illustration).
 *
 * Every claim in every list names something built and reachable in the app
 * today, the same rule the pricing table follows. No SMS, no auto-weather, no
 * feature we do not have, no matter how good it looks on a competitor's grid.
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

/** One cell of the long-tail tick grid. */
export type FeatureTick = {
  t: string;
  d: string;
};

/** The one thing on this page a competitor's page cannot say. */
export type FeatureDiff = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
};

/** Which band a page sits in, for the nav dropdown and the mesh. */
export type PageBand = "plan" | "visualize" | "review" | "produce" | "money" | "ai";

export const PAGE_BANDS: { key: PageBand; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "visualize", label: "Visualize" },
  { key: "review", label: "Review" },
  { key: "produce", label: "Produce" },
  { key: "money", label: "The money" },
  { key: "ai", label: "AI" },
];

export type FeatureDef = {
  slug: FeatureSlug;
  /** Short label for the nav dropdown, footer, and mesh. */
  nav: string;
  /** One-line hint under the dropdown label. */
  hint: string;
  /** Identity hue for the eyebrow, wash, motif, and placeholder tint. */
  hue: string;
  /** The search term: title tag and hero eyebrow. */
  keyword: string;
  /** The full <title>, keyword-first. */
  metaTitle: string;
  /** The voice: a short creative h1. The keyword stays in the eyebrow. */
  h1: string;
  /** Page lede; also the meta description. */
  lede: string;
  /** The wound, named before the relief. Two sentences. */
  problem: string;
  /** Real screenshots only. Empty means the motif leads the hero. */
  shots: FeatureShot[];
  blocks: FeatureBlock[];
  /** Heading over the tick grid. */
  moreTitle: string;
  ticks: FeatureTick[];
  diff: FeatureDiff;
  band: PageBand;
  /** Slugs of the two features to cross-link at the foot of the page. */
  related: FeatureSlug[];
};

export const FEATURES: FeatureDef[] = [
  /* ---------------------------------------------------------------- Plan */
  {
    slug: "production-hub",
    nav: "Production hub",
    hint: "The whole job on one page",
    hue: "indigo",
    keyword: "Production hub",
    metaTitle: "Production Hub Software: Every Job in One Place",
    h1: "One home for the whole job.",
    lede: "A project in Studio Flows is not a folder of files. It is the production itself: the brief, the boards, the crew, the money and the delivery, organized into the phases a real job moves through.",
    problem: "The brief is in email, the boards are in Figma, the budget is a spreadsheet, and the approval is in a text message. You are the only person who knows where all of it is, and that knowledge does not scale past you.",
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
          "Cards carry live data: the brief's first lines, asset thumbnails, the budget bar, review status",
          "A needs-attention rail that surfaces the one thing waiting on you",
          "An AI project summary: where the job stands, in five lines",
          "A right-rail activity feed, so 'what happened while I was on set' has an answer",
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
        title: "It speaks production",
        body: "Stages, bands and labels use the industry's own words, and they adapt to the kind of job.",
        points: [
          "A live-action job reads Shoot; an AI job reads Concept and Generation",
          "New projects start from a type: live action, commercial, AI video, CGI/VFX",
          "The lifecycle stepper is the control, not a decoration: click a stage to move the job",
          "Create a client inline while creating the job, no detour",
        ],
      },
    ],
    moreTitle: "More the hub carries",
    ticks: [
      { t: "The brief", d: "Creative direction and attachments, on the job they direct." },
      { t: "Asset library", d: "Every file with version history, nothing named FINAL_v2." },
      { t: "Documents", d: "Permits, specs and insurance, with the email they arrived in." },
      { t: "Project calendar", d: "Milestones and producer-entered dates, month and agenda." },
      { t: "KPI row", d: "Days to shoot, days to due, open approvals, unread messages." },
      { t: "First-run checklist", d: "Five real steps derived from real data, not a 'seen it' flag." },
      { t: "Guided tours", d: "Orientation cards over the real UI, replayable from the menu." },
      { t: "Dual theme + paper", d: "Light, dark, and a warm paper theme for long review sessions." },
      { t: "Soft archive", d: "Nothing is ever hard-deleted; finished jobs leave your way, not the record." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Modeled on production, not on software.",
      body: "Most tools hand you generic boards and ask you to rebuild your craft inside them. This one already knows what a job is: it has a shoot date, a client, a review round and a margin, and every page assumes that.",
      points: [
        "The data spine runs Lead to Client to Project to Delivery, connected end to end",
        "Nothing is retyped between modules: the shot list feeds the call sheet, the roster feeds the budget",
        "Color is a status signal in chips, never a decorative wash",
      ],
    },
    band: "plan",
    related: ["production-task-management", "call-sheet-software"],
  },
  {
    slug: "production-task-management",
    nav: "Task boards",
    hint: "Who is on it, and what is waiting",
    hue: "purple",
    keyword: "Task management",
    metaTitle: "Task Management Built for Production Teams",
    h1: "Who's on it, and what's waiting.",
    lede: "A kanban that tells the truth about production work: a Waiting column for everything sitting with a client or a vendor, phases that speak your job's language, and cards that carry people, files and checklists.",
    problem: "Generic task tools have two states: yours and done. On a real job half the work is waiting on somebody outside the building, and a board that cannot say so misreports where the job actually stands.",
    shots: [],
    blocks: [
      {
        title: "A board with a Waiting column",
        body: "To do, In progress, Waiting, Done. Waiting is the one that earns its place: location holds, client approvals, vendor quotes. Drag a card as the work moves.",
        points: [
          "Native drag and drop between columns, position remembered",
          "Overdue chips computed server-side, so they never flicker or lie",
          "Undated tasks sort last: tomorrow's delivery beats a vague intention",
          "Add a card straight into any column",
        ],
      },
      {
        title: "Or group by the job's phases",
        body: "One toggle re-columns the same cards into the phases of the job, and the columns rename themselves to the project's type.",
        points: [
          "A live-action job reads Pre-pro, Shoot, Post, Delivery",
          "An AI job reads Concept and Generation, automatically",
          "An Anytime column holds work that belongs to no phase",
          "Board or list: the board answers 'where is everything', the list answers 'what is next'",
        ],
      },
      {
        title: "Cards that hold the work",
        body: "A card is not a title. It is the people on it, the files behind it, and the steps inside it.",
        points: [
          "Several assignees per card, because a delivery is the editor and the producer",
          "Files with image previews on the card face: the location photo is visible without a click",
          "Named checklists, several per card, with progress",
          "Notes to the team, threaded on the card",
        ],
      },
    ],
    moreTitle: "More the board does",
    ticks: [
      { t: "Invite from the picker", d: "Realize you need a colleague mid-card, invite them right there." },
      { t: "Pending invites shown", d: "An invited person is named under the picker until they accept." },
      { t: "Crew can write", d: "Collaborators on the job can add and check off tasks, not just read them." },
      { t: "Due dates", d: "With overdue in red, on the card and in the list." },
      { t: "List view", d: "The same cards as a prioritized run-down for phones and mornings." },
      { t: "Hub card", d: "Open task count on the project's front page." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Waiting is a first-class answer.",
      body: "On a commercial job, a huge share of open work is not blocked by your team at all. It is sitting with an agency, a location owner, or a client who has the cut. A board that pushes all of that into 'in progress' tells the producer a comfortable lie.",
      points: [
        "Waiting is its own column, so the morning question 'what do I chase' has a view",
        "Phase grouping shows the same work the way the job actually flows",
        "Assignees, files and checklists live on the card, not in four other tools",
      ],
    },
    band: "plan",
    related: ["production-hub", "crew-management-software"],
  },

  /* ----------------------------------------------------------- Visualize */
  {
    slug: "storyboard-software",
    nav: "Storyboards",
    hint: "Frames that keep their shape",
    hue: "purple",
    keyword: "Storyboard software",
    metaTitle: "Storyboard Software for Production Teams",
    h1: "The board, off the PDF.",
    lede: "Build storyboards frame by frame, or drop in the director's PDF and watch it become one: panels cropped exactly, captions split into scene, action and camera, frames drawn in the shape they were drawn in.",
    problem: "The board arrives as a PDF, and turning it into something the job can use means retyping every caption and cropping every panel by hand. So nobody does, and the board stays a dead attachment.",
    shots: [],
    blocks: [
      {
        title: "Import the director's PDF",
        body: "The importer reads where the document itself placed every picture, so panels are exact, not guessed. Nothing is created until you have looked at what was found.",
        points: [
          "Panels come from the file's own placed images, so designed decks with no gutters still read",
          "Captions split into scene, action, sound and camera notes by the board's own labels",
          "Running footers and page numbers stay out of the captions",
          "A confirm grid shows every panel and its text before anything is written",
        ],
      },
      {
        title: "Frames that keep their shape",
        body: "Every board carries its own frame aspect, detected from the imported panels or set by hand, so a 4:5 social board is never cropped into a landscape strip.",
        points: [
          "Nine shapes from anamorphic scope to 9:16 vertical",
          "Detection reads the shape off the panels and stays quiet when they disagree",
          "Nothing is ever cropped on screen: an odd frame letterboxes",
          "The editor grid, the review canvas and the PDF all agree",
        ],
      },
      {
        title: "A working editor, not a viewer",
        body: "Scene, description, sound and notes on every frame, reorder by hand, swap images from the project's assets or a fresh upload.",
        points: [
          "Several storyboards per project: hero board, cutdowns, versions",
          "Full undo and redo, per board",
          "One-click PDF with the job's cover block: client, director, job number",
          "Frames feed the shot list: matching rows pick up their pictures automatically",
        ],
      },
    ],
    moreTitle: "More the storyboard does",
    ticks: [
      { t: "Client review with pins", d: "Share a link, no login; notes land pinned on the frame they mean." },
      { t: "Internal sign-off", d: "A greenlight round for the team, kept separate from the client's." },
      { t: "Email it", d: "Send the review link from the app, with an optional respond-by date." },
      { t: "Present view", d: "A clean, dark-covered export that looks like it came from a studio." },
      { t: "Per-frame sources", d: "Pull a frame from the asset library or upload straight into the slot." },
      { t: "Cover block", d: "Fill the job facts once; the shot list and storyboard exports share them." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "The PDF import actually reads the document.",
      body: "Panel detection replays the PDF's own drawing operations to find each picture's exact rectangle, and captions are matched by geometry, by where the words sit on the page, never by asking a model to count panels and hoping it counts like we cut.",
      points: [
        "Verified against real director's boards, not synthetic pages",
        "Doubled text layers, template furniture and footers are handled, because real exports have all three",
        "A wrong guess costs one click in the confirm step, never a bad import",
      ],
    },
    band: "visualize",
    related: ["shot-list-software", "video-review-software"],
  },
  {
    slug: "shot-list-software",
    nav: "Shot lists",
    hint: "Build, import, present",
    hue: "blue",
    keyword: "Shot list software",
    metaTitle: "Shot List Software: Build, Import, Present",
    h1: "Every shot, accounted for.",
    lede: "Shot lists with size, angle and movement on every row, a frame from the storyboard beside each one, and a presentation view that goes out with the job's cover on it.",
    problem: "The shot list lives in a spreadsheet, the storyboard lives in a PDF, and on the day nobody is sure which row goes with which frame. The two documents describe the same shots and have never met.",
    shots: [],
    blocks: [
      {
        title: "Rows built for set",
        body: "Each shot carries the fields a crew actually reads: code, description, size, angle, movement, day.",
        points: [
          "Shot sizes, angles and movements from real production vocabulary, free text welcome",
          "A frame beside every row, picked from the project's assets or uploaded",
          "Select rows to duplicate, move between lists, or delete in bulk",
          "Several lists per project: day one, day two, the scout",
        ],
      },
      {
        title: "The storyboard fills it in",
        body: "Shots and frames are two views of the same beat, so the app connects them instead of asking you to.",
        points: [
          "Import a director's PDF and rows arrive with their matched frame attached",
          "Matched by the printed shot number first, position only when the document agrees",
          "'Add frames to N rows' fills an existing list from any storyboard, blanks only",
          "Nothing you placed by hand is ever overwritten",
        ],
      },
      {
        title: "Out the door properly",
        body: "The present view is a real production document: dark cover, job facts, numbered lists.",
        points: [
          "One-click PDF, or email a review link straight from the editor",
          "The cover block (client, director, job number) is shared with the storyboard export",
          "Clients pin comments on the list itself through a no-login link",
          "Internal sign-off before anything reaches the client",
        ],
      },
    ],
    moreTitle: "More the shot list does",
    ticks: [
      { t: "PDF import", d: "A treatment or deck becomes rows: description, size, movement read out of the text." },
      { t: "Undo and redo", d: "Snapshot history on every edit, keyboard shortcuts included." },
      { t: "Codes and days", d: "Shot codes survive import; day tags split the list for the schedule." },
      { t: "Present selector", d: "Export all lists or just one." },
      { t: "Review pipeline", d: "Send the list into the project's review page beside the assets." },
      { t: "Hub card", d: "Shot count on the project's front page, one click from anywhere." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "One import, both documents.",
      body: "A director's package is routinely one PDF holding a board and a list. Drop it in once: the storyboard gets the frames, the shot list gets the rows, and each row points at the frame it was printed next to. Nobody declares what the file is; the app reads it and shows you.",
      points: [
        "The confirm step shows each row's matched frame before anything is written",
        "Unmatched rows arrive honestly blank, one click to fix, never guessed",
        "The original PDF is filed in Documents either way, so the source survives the import",
      ],
    },
    band: "visualize",
    related: ["storyboard-software", "call-sheet-software"],
  },
  {
    slug: "moodboard-maker",
    nav: "Moodboards",
    hint: "Where the look comes together",
    hue: "pink",
    keyword: "Moodboard maker",
    metaTitle: "Moodboard Maker for Creative Production",
    h1: "Where the look comes together.",
    lede: "A freeform canvas for references, notes and direction: drag anything anywhere, connect ideas with arrows, pull images from Figma, Drive or the project itself, and share the board as a link.",
    problem: "The look of the job gets decided across a Pinterest board, a Figma file and a folder of screenshots, and none of them is attached to the job. Three weeks later nobody can find the frame everyone agreed on.",
    shots: [],
    blocks: [
      {
        title: "A real canvas",
        body: "Freeform, zoomable, and fast: cards go where you drop them and stay there.",
        points: [
          "Images, rich-text notes, to-do cards and link cards with automatic previews",
          "Columns that stack cards, and drag-into to file them",
          "Connection arrows between cards, and free lines with labels and arrowheads",
          "Dots, grid or plain background; drag tools straight off the rail",
        ],
      },
      {
        title: "Fed from everywhere",
        body: "The references already live somewhere. The board reaches them instead of asking you to re-upload your taste.",
        points: [
          "Import frames from Figma by pasting a file link",
          "Browse and pull files from Google Drive",
          "Pick from the project's own asset library",
          "Drop files from the desktop, several at once",
        ],
      },
      {
        title: "Attached to the job, or above it",
        body: "A moodboard can belong to one project or float studio-wide, and either way it can face the client.",
        points: [
          "Project moodboards sit in the Visualize band of the job's hub",
          "Studio-wide boards for the look you keep coming back to",
          "Share a read-only link, no login on the other end",
          "Send it to client review and collect pinned comments on the board itself",
        ],
      },
    ],
    moreTitle: "More the canvas does",
    ticks: [
      { t: "Undo and redo", d: "Sixty steps of history, keyboard shortcuts, per board." },
      { t: "Link unfurling", d: "Paste a URL, get a titled card with the page's own preview image." },
      { t: "Rich text notes", d: "Bold, lists, links and a color panel, edited in place." },
      { t: "Z-order and resize", d: "Layer and size cards like a layout, not a grid." },
      { t: "Copy and paste", d: "Duplicate a card or carry it between boards." },
      { t: "Tabs", d: "Several boards side by side, one canvas each." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "It is connected, not another silo.",
      body: "A standalone moodboard tool is one more place the job leaks into. This canvas lives inside the production: it reads the project's assets, it reaches Figma and Drive where the references already are, and its output goes into the same review flow as everything else.",
      points: [
        "The frame everyone agreed on is findable, on the job, forever",
        "Client feedback arrives as pins on the board, not adjectives in an email",
        "No exports, no re-uploads, no 'which version of the board is this'",
      ],
    },
    band: "visualize",
    related: ["storyboard-software", "ai-video-production"],
  },

  /* -------------------------------------------------------------- Review */
  {
    slug: "video-review-software",
    nav: "Client review",
    hint: "Approvals your clients will use",
    hue: "green",
    keyword: "Video review & approval",
    metaTitle: "Video Review and Approval Software for Client Work",
    h1: "Notes that land on the frame.",
    lede: "Send a link. No login, no account, no explaining. The client pins a comment to a spot on the still, a moment in the cut, or a page of the PDF, draws on the frame when words are slow, and approves on the record.",
    problem: "Feedback arrives as 'the logo feels off' in an email, three texts and a phone call, about a file called final_v3_new. Nobody knows which frame they meant, which version they saw, or whether it was ever actually approved.",
    shots: [
      {
        shot: "client-review-portal",
        caption: "studio-flows.com/r/shared-link",
        alt: "The client review portal: a hero frame with numbered comment pins and the comment rail beside it.",
      },
    ],
    blocks: [
      {
        title: "Comments with coordinates",
        body: "Every note lands where it belongs, so 'fix this' has a this.",
        points: [
          "Numbered pins on stills; timecode and range comments on video",
          "PDFs get pins page by page, with zoom that re-renders instead of blurring",
          "Drawn markup: arrows, boxes, ellipses, freehand, five colors",
          "Threaded replies, reactions, edit and delete on your own notes",
        ],
      },
      {
        title: "A player made for judging work",
        body: "The video canvas behaves like the review tools editors already respect, without the seat price.",
        points: [
          "Playback speed, loop, broadcast timecode, frame stepping, J-K-L shuttle",
          "Rule-of-thirds and safe-area guides",
          "Crop masks for 1:1, 4:5 and 9:16: does the product survive the cutdown",
          "Download the exact frame you are arguing about",
        ],
      },
      {
        title: "Versions with memory",
        body: "Every round keeps its notes, and the open round is always explicit.",
        points: [
          "Switch versions inside the portal; older rounds are clearly read-only",
          "Side-by-side compare for stills: before and after a revision",
          "Approve or request changes in one click, timestamped, on the record",
          "Internal team sign-off runs separately, before the client ever sees it",
        ],
      },
    ],
    moreTitle: "More review can do",
    ticks: [
      { t: "Due dates", d: "Set a respond-by date; the portal shows it, amber then red." },
      { t: "Automatic reminders", d: "Overdue reviews get a nudge, capped and spaced, stopping on response." },
      { t: "Batch review", d: "Send a set of options and get back stars, notes, and one pick per reviewer." },
      { t: "Doc review", d: "Shot lists, storyboards, moodboards and props run through the same canvas." },
      { t: "Client binder", d: "One link holding everything you tick, and nothing you do not." },
      { t: "Filter and search", d: "The comment rail filters open versus resolved, sorts by timecode, searches text." },
      { t: "Reactions", d: "A curated emoji set, because sometimes the note is just agreement." },
      { t: "Notifications", d: "Every client action lands in the studio's bell, attributed." },
      { t: "Stable viewing", d: "The review canvas holds a neutral ground; the theme never shifts under artwork." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "A link, not a login.",
      body: "The fastest way to kill a review round is asking a brand manager to create an account. Here the client clicks, types their name, and reviews. The crop masks are the other tell: every commercial job ships social cutdowns now, and 'does it survive the 9:16 crop' comes up in every session.",
      points: [
        "Zero client onboarding, on every plan, forever",
        "Feedback flows back into the project, attributed and pinned",
        "Approvals are records with timestamps, not vibes in a thread",
      ],
    },
    band: "review",
    related: ["production-communication", "ai-video-production"],
  },
  {
    slug: "production-communication",
    nav: "Communication",
    hint: "Gmail, Slack and Chat, filed with the job",
    hue: "cyan",
    keyword: "Production communication",
    metaTitle: "Production Communication: Gmail, Slack and Chat on the Job",
    h1: "The thread, filed with the job.",
    lede: "Nobody is going to move their client onto a new chat app, so we do not ask. Link the Gmail thread, the Slack channel and the Chat space to the project, then read and reply to all of it from the job it belongs to.",
    problem: "The job's real record is scattered across an inbox, two Slack channels and a text thread. Finding 'the email where they approved the budget' means twenty minutes of searching three apps, and it was sent to your colleague anyway.",
    shots: [
      {
        shot: "project-communication",
        caption: "app.studio-flows.com/projects/bright-water/communication",
        alt: "The Communication page: linked Gmail threads, Slack channels and a Google Chat space, all on one project.",
      },
    ],
    blocks: [
      {
        title: "Three tools, one page",
        body: "Connect Google and Slack once in Settings, then link any conversation to the project, client or lead it belongs to.",
        points: [
          "Gmail threads, Slack channels, Google Chat spaces, side by side",
          "Read the full conversation without leaving the job",
          "Reply and post from the project page; it sends as you",
          "Unread counts per conversation, so nothing sits unseen",
        ],
      },
      {
        title: "Attachments become work",
        body: "The PDF in the email is never just a PDF. It is an asset, a document, or a cost, and it files itself as one.",
        points: [
          "Pull an attachment into the project's assets or documents in one click",
          "An emailed invoice becomes a budget cost, with the amount read for you to check",
          "Documents keep their provenance: who sent it, when, in which thread",
          "Attach outgoing files from your device, the project's assets, or Drive",
        ],
      },
      {
        title: "Send it well",
        body: "The composer helps without ever sending for you.",
        points: [
          "A Polish button rewrites your draft: polish, shorten, warm up, or firm up",
          "Undo restores your exact words; nothing sends until you press Send",
          "Oversized Drive files go out as links automatically, the way Gmail itself does it",
          "A warning names unshared Drive files before they embarrass you",
        ],
      },
    ],
    moreTitle: "More it handles",
    ticks: [
      { t: "Client and lead threads", d: "Conversations link to accounts and deals too, not just projects." },
      { t: "CRM auto-logging", d: "Linked email rolls into the account's relationship timeline by itself." },
      { t: "Visual attachments", d: "Attachment cards with previews, not a paperclip and a prayer." },
      { t: "Size limits, honestly", d: "Caps are enforced where they exist and explained before you hit send." },
      { t: "Notifications", d: "The unread badge reaches the dashboard, per project." },
      { t: "Nothing moves", d: "The mail stays in Gmail, the messages stay in Slack. We connect, we never copy." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Connect, don't replace.",
      body: "Every 'all-in-one' tool fails the same way: it asks your client to change how they communicate, and they will not. Studio Flows leaves every conversation where it lives and pulls the reading and the replying into the job, which is the part you actually needed.",
      points: [
        "Zero behavior change asked of clients, agencies or crew",
        "The job's record assembles itself from where work already happens",
        "Leave anytime and every thread is still exactly where it always was",
      ],
    },
    band: "review",
    related: ["video-review-software", "crew-management-software"],
  },

  /* ------------------------------------------------------------- Produce */
  {
    slug: "call-sheet-software",
    nav: "Call sheets",
    hint: "Sent, seen, confirmed, chased",
    hue: "amber",
    keyword: "Call sheet software",
    metaTitle: "Call Sheet Software: Build, Send, Track, Chase",
    h1: "Sent. Seen. Confirmed.",
    lede: "Build the call sheet on the sheet itself, send every person their own link, and watch confirmations come in. The chasing happens without you: unconfirmed crew get nudged automatically as the day gets close.",
    problem: "You send the call sheet at 9pm and spend the next morning texting 'did you get it?' to fourteen people. Two say yes, one saw the old version, and the gaffer never opened it at all.",
    shots: [
      {
        shot: "project-callsheet",
        caption: "app.studio-flows.com/projects/bright-water/callsheet",
        alt: "A call sheet with per-recipient confirmed chips beside the crew roster.",
      },
    ],
    blocks: [
      {
        title: "Edit the sheet, on the sheet",
        body: "No form on the left and preview on the right. The call sheet you edit is the call sheet they receive, in the industry layout crews already read.",
        points: [
          "A proper masthead: logo, production title, big call time, key times and weather block",
          "Reorderable body blocks: schedule, locations, contacts, cast, crew, notes",
          "Custom text blocks for the day's one-off information",
          "Save any layout as a template and start the next sheet from it",
        ],
      },
      {
        title: "Every person, their own link",
        body: "Recipients come off the project roster, and each gets a personal link that reports back.",
        points: [
          "Viewed and confirmed tracked per person, timestamped",
          "Three tallies at a glance: confirmed, viewed but silent, never opened",
          "Those are different problems, and the panel treats them differently",
          "A confirm bar on the sheet itself; one tap and they are counted",
        ],
      },
      {
        title: "The chasing happens without you",
        body: "Within three days of the shoot, unconfirmed recipients get an automatic reminder. Confirming stops it instantly.",
        points: [
          "At most one nudge a day, capped at two: after that it is a phone call",
          "A manual 'remind unconfirmed' button, sharing the same cap so nobody gets doubled",
          "The email says 'tomorrow' or 'in 2 days', not a bare date",
          "A sheet whose date has passed is left in peace",
        ],
      },
    ],
    moreTitle: "More call sheet features",
    ticks: [
      { t: "Several sheets per job", d: "Day one, day two, the scout, each with its own status and recipients." },
      { t: "Crew meal rounds", d: "Paste the group-order link, set a cutoff, and the app chases stragglers." },
      { t: "One-click PDF", d: "Print-perfect export in the industry layout, colors intact." },
      { t: "Sent status, automatic", d: "Emailing a sheet moves it from draft to sent by itself." },
      { t: "Recipients from the roster", d: "Check names off the project's crew and client contacts, no retyping." },
      { t: "Accent color", d: "Your sheet, your color, saved with your templates." },
      { t: "Drag to reorder", d: "Body blocks move by grip handle, hidden blocks return from the palette." },
      { t: "Confirmation on the hub", d: "The project's front page shows confirmed over total, amber until whole." },
      { t: "Meal notation on the sheet", d: "The printed sheet carries the meal plan; the live link stays private." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "It closes the loop.",
      body: "Most call sheet tools stop at 'sent'. The entire point of a call sheet is fourteen humans standing in the right place at 6am, so this one tracks the loop to the end: seen, confirmed, and chased when neither happens, on a schedule polite enough that your crew does not hate the tool.",
      points: [
        "Bounded chasing: never before the window, never after the day, never more than twice",
        "Who has not answered is one click, not a spreadsheet cross-check",
        "Confirmations flow back into the studio's notifications, attributed",
      ],
    },
    band: "produce",
    related: ["crew-management-software", "shot-list-software"],
  },
  {
    slug: "crew-management-software",
    nav: "Crew & talent",
    hint: "One roster per job",
    hue: "orange",
    keyword: "Crew management",
    metaTitle: "Crew and Talent Management Software for Production",
    h1: "One roster per job.",
    lede: "Crew, talent, extras, clients and vendors on one per-job roster, with the details each kind of person actually needs: positions and rates for crew, wardrobe and dietary for talent, and files for everyone.",
    problem: "The crew list is a spreadsheet, the talent's measurements are in a text thread with wardrobe, and the W-9 is somewhere in email. Every department is asking you, because you are the only index.",
    shots: [],
    blocks: [
      {
        title: "A roster with folders",
        body: "One list per job, organized the way a call sheet thinks: Crew, Talent, Extras, Clients, Vendors, each tab counted.",
        points: [
          "Positions from real production vocabulary, seeded per category, free text welcome",
          "Day rates on crew, visible to the studio and never to the crew themselves",
          "Pull people in from the client's contact list without retyping",
          "Vendors get their own folder: CGI houses, color, sound, rentals",
        ],
      },
      {
        title: "Talent is not a name and a number",
        body: "An actor's record holds what the departments actually come asking for.",
        points: [
          "Headshot, billing name, representation and agent contact",
          "Wardrobe measurements as real fields, sized how wardrobe writes them",
          "Dietary notes with allergies first, because a truncated line should lead with the hospital risk",
          "Files on the person: W-9s, releases, agreements",
        ],
      },
      {
        title: "The roster feeds everything",
        body: "Enter a person once and they follow the job around.",
        points: [
          "Call sheet recipients check straight off the roster",
          "The budget's vendor picker knows the agreed day rate and does the math against the invoice",
          "Crew meal rounds read the roster, and dietary is on record",
          "Invite crew into the job itself: they see this project and nothing else",
        ],
      },
    ],
    moreTitle: "More it holds",
    ticks: [
      { t: "Project-only access", d: "A DP or editor sees their job, never your studio, your clients, or your money." },
      { t: "Reviewer role", d: "View-and-comment access for people who should not be able to edit." },
      { t: "Gear alongside crew", d: "The kit list with day rates, tracked next to the people running it." },
      { t: "Props with sign-off", d: "Sourced options per prop, and the client picks through the review portal." },
      { t: "Category colors", d: "Cards carry their folder's color, so a glance sorts the roster." },
      { t: "Rate protection by design", d: "Money fields live in studio-only tables, enforced at the database, not the UI." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Everyone sees exactly enough.",
      body: "Crew need the call sheet and the storyboard. Wardrobe needs the measurements. Nobody outside the studio needs the rates, and here they cannot see them: money lives in tables the database itself refuses to serve to project collaborators. That is enforced access, not a hidden column.",
      points: [
        "Invite a freelancer to one job in one click; the rest of the studio does not exist for them",
        "Rates, budgets and agreements are structurally invisible to non-staff",
        "The same roster serves the call sheet, the budget and the meal run, typed once",
      ],
    },
    band: "produce",
    related: ["call-sheet-software", "production-budgeting-software"],
  },

  /* --------------------------------------------------------------- Money */
  {
    slug: "production-budgeting-software",
    nav: "Budget & costs",
    hint: "Bid against actual, line by line",
    hue: "blue",
    keyword: "Production budgeting",
    metaTitle: "Production Budgeting Software: Bid vs. Actual, Margin, Costs",
    h1: "Know what the job made.",
    lede: "Bid against actual on every line, every cost backed by the invoice it came from, deposits and payment schedules tracked to the dollar, and a margin band that answers the only question that matters.",
    problem: "The budget says you are $4,200 over, and nobody can say why, who, or against which invoice. 'Actual' is a number somebody typed three weeks ago, and the job closes without anyone knowing what it made.",
    shots: [
      {
        shot: "project-budget",
        caption: "app.studio-flows.com/projects/bright-water/budget",
        alt: "The budget page: bid against actual, the cost ledger beneath it, and the margin band.",
      },
    ],
    blocks: [
      {
        title: "Actuals with receipts",
        body: "A cost is not a typed number. It is a ledger entry with a vendor, an invoice, a status and a document attached.",
        points: [
          "Every budget line's actual is the sum of the costs filed against it",
          "The invoice PDF rides on the cost; three weeks later the number still explains itself",
          "Unassigned costs still count toward the total, because the money left either way",
          "Fast manual lines still work: a line with no costs keeps its typed figure",
        ],
      },
      {
        title: "What is owed, exactly",
        body: "A cost is a commitment; payments are events against it. Deposits stop being a guess.",
        points: [
          "Split any cost into deposit and balance with two due dates",
          "Part-paid commitments report only their remainder, everywhere",
          "A dashboard widget rolls up unpaid costs across every live job",
          "Overdue is computed against the server's calendar, so it cannot lie after midnight",
        ],
      },
      {
        title: "The margin band",
        body: "Billed against cost, on one page, from real documents on both sides.",
        points: [
          "Billed comes from the job's actual invoices, never from estimates or hopes",
          "Margin as a percentage of revenue, the way a studio quotes it",
          "The bar turns red on a loss, quietly, before the retro does",
          "Agreements (NDAs, SOWs, change orders) file alongside, with both signatures tracked",
        ],
      },
    ],
    moreTitle: "More the money layer does",
    ticks: [
      { t: "AI invoice reading", d: "Attach a supplier invoice and the form fills itself, for you to check." },
      { t: "Rate checking", d: "Days times agreed rate against the invoiced amount, flagged when they disagree." },
      { t: "Cost from an email", d: "An invoice in a linked Gmail thread becomes a cost in two clicks." },
      { t: "Vendor from the roster", d: "Costs pick their vendor from the job's crew, with the agreed rate shown." },
      { t: "Status that means something", d: "Received, approved, paid, advancing by click or by schedule." },
      { t: "SOW reading", d: "A received SOW's deliverables and fees become project rows, proposed first." },
      { t: "Crew cannot see it", d: "Budgets and costs are structurally invisible to project collaborators." },
      { t: "Hub card", d: "The bid-versus-actual bar on the project's front page." },
      { t: "One source of truth", d: "The page, the hub and the dashboard all compute from the same ledger." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Provenance, all the way down.",
      body: "Any spreadsheet can subtract bid from actual. The difference is that every number here can explain itself: click the cost, see the invoice, see the payment schedule, see who the vendor was and what rate you agreed. The budget stops being a claim and becomes a record.",
      points: [
        "An AI assist reads the documents, a human confirms every figure",
        "The same roll-ups feed the page, the hub card and the dashboard, so they cannot disagree",
        "Built by an operator who runs real jobs on it, not imagined from a spec",
      ],
    },
    band: "money",
    related: ["production-invoicing", "crew-management-software"],
  },
  {
    slug: "production-invoicing",
    nav: "Estimates & invoices",
    hint: "From estimate to signed to paid",
    hue: "green",
    keyword: "Estimates, proposals & invoices",
    metaTitle: "Estimates, Proposals and Invoices for Production Studios",
    h1: "From estimate to signed to paid.",
    lede: "The paper trail of a real job, in order: an estimate, a proposal signed online with a full audit trail, and an invoice, each in your numbering, your layout and your color, sent as a link, an email or a PDF.",
    problem: "The estimate is a spreadsheet export, the agreement is a DocuSign subscription you pay for twice a year, and the invoice is a Word template from 2019. Three documents, three tools, zero connection to the job.",
    shots: [
      {
        shot: "project-invoices",
        caption: "app.studio-flows.com/projects/bright-water/invoices",
        alt: "The document workspace: an estimate, a signed proposal, and an invoice, with the document edited in place beside them.",
      },
    ],
    blocks: [
      {
        title: "Three documents, one flow",
        body: "Estimates get sent. Proposals get signed. Invoices get paid. Each type has its own numbering series and its own job.",
        points: [
          "EST, PROP and INV series that count themselves",
          "Line items with per-line tax, discounts, notes and terms",
          "Bill-To fills from the client's contacts",
          "Edited in place: the document you type on is the document they receive",
        ],
      },
      {
        title: "Signed online, on the record",
        body: "A proposal carries a signature pad: typed or drawn, either is legally a signature, and the trail proves it.",
        points: [
          "Signer name, email, IP and timestamp recorded with the signature",
          "A signed document freezes; it cannot be quietly edited afterwards",
          "Attach supporting files to the proposal: scope docs, references, terms",
          "No per-envelope fees, no separate e-sign subscription",
        ],
      },
      {
        title: "Delivered three ways",
        body: "However the client works, the document reaches them, and you know when it did.",
        points: [
          "A share link with view tracking",
          "Sent by email from the app, with your message",
          "A print-perfect PDF for the ones who insist",
          "What was sent is frozen as a snapshot, so 'that is not what I saw' has an answer",
        ],
      },
    ],
    moreTitle: "More the documents do",
    ticks: [
      { t: "Style editor", d: "Three templates, your accent color, serif or sans, saved as studio defaults." },
      { t: "Your logo", d: "Uploaded once in Settings, on every document after." },
      { t: "Delivery tracking page", d: "Final deliverables and billing status, per job." },
      { t: "Feeds the margin", d: "Invoices are the Billed side of the budget's margin band, automatically." },
      { t: "Signed docs notify", d: "An accepted proposal lands in the studio's notifications." },
      { t: "Public and safe", d: "Share pages are tokened, rate-limited, and never expose the studio." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "The documents know the job.",
      body: "A generic invoicing tool starts from zero on every document. Here the client is already on the job, the totals feed the margin band, and the signed proposal sits beside the budget it authorized. The paperwork is part of the production, not an app you visit afterwards.",
      points: [
        "One flow from 'they asked for a price' to 'they signed' to 'they paid'",
        "Numbers reconcile against the budget without a copy-paste",
        "E-signature included, not an integration you rent",
      ],
    },
    band: "money",
    related: ["production-budgeting-software", "production-hub"],
  },

  /* ------------------------------------------------------------------ AI */
  {
    slug: "ai-video-production",
    nav: "AI pipeline",
    hint: "Organize the fan-out, keep the receipts",
    hue: "purple",
    keyword: "AI video production",
    metaTitle: "AI Video Production Pipeline: Organize, Triage, Pick",
    h1: "A hundred takes. One pick. On record.",
    lede: "Generation tools hand you a hundred candidates and no way to judge them. Studio Flows organizes the fan-out: script to sequence to shot, keyboard-first triage, provenance on every clip, and a paper trail from prompt to picked take.",
    problem: "The job generated four hundred clips across three platforms, the picks live in someone's downloads folder, and nobody can say which prompt, model or seed made the one the client loved. The work exists; the record does not.",
    shots: [
      {
        shot: "project-pipeline",
        caption: "app.studio-flows.com/projects/lumen-concept-reel/pipeline",
        alt: "The AI pipeline: generated candidates for a shot, with provenance on every clip.",
      },
    ],
    blocks: [
      {
        title: "Structure over the chaos",
        body: "A script, a sequence, and a cockpit per shot. Every candidate lands somewhere, attached to the beat it was made for.",
        points: [
          "Script editor beside the sequence strip, read while you build",
          "Image, video and voiceover stages per shot, with input modes for i2v, v2v and text-first",
          "Reusable elements with @handles, so a character and a look hold across shots",
          "A one-check prompt linter: a handle in the prompt that no element owns gets flagged",
        ],
      },
      {
        title: "Triage at keyboard speed",
        body: "A full-screen, neutral-dark lane for judging a batch: narrow a hundred down to a shortlist down to the one.",
        points: [
          "Arrow through candidates; x rejects, s stars, Enter picks the take",
          "Compare up to four near-identical takes side by side",
          "Filter by kept, starred, rejected, or by model",
          "Decisions save optimistically; nothing waits on a spinner",
        ],
      },
      {
        title: "Provenance is the product",
        body: "Every clip knows where it came from, which is the difference between a folder of files and a body of work.",
        points: [
          "Platform, model, seed, prompt and source link on every generation",
          "Paste up to forty share links and clips import with provenance auto-detected",
          "Aspect, resolution and duration read from the actual file, not typed",
          "Lineage tracked: which references and frames drove which take",
        ],
      },
    ],
    moreTitle: "More the pipeline does",
    ticks: [
      { t: "Batch review links", d: "Send a curated set of options; reviewers star, comment and pick, you decide." },
      { t: "Master cut versions", d: "The assembled cut lives in the same version spine, with timecoded review." },
      { t: "Editor handoff", d: "One link hands the picked takes over, files named to survive a Finder sort." },
      { t: "Sequence review", d: "Clients review the order itself, not just the shots." },
      { t: "Prompt library", d: "Saved prompts and style fragments, studio-wide or per project." },
      { t: "Voiceover stage", d: "Generated reads filed against the clip they play over, not a loose MP3." },
      { t: "Per-shot review", d: "The pin canvas on frames, the timecode scrubber on takes." },
      { t: "Hybrid jobs", d: "Generated and live-action shots share one sequence; method is per shot." },
      { t: "Costs tracked", d: "Spend per generation recorded, visible to the studio only." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "Above the tools, not inside one.",
      body: "Generation platforms churn; the studios that win will be the ones whose process survives the churn. Studio Flows does not generate anything. It organizes what you generate anywhere, keeps the provenance, and runs the same review and approval discipline over AI work that it runs over a live shoot.",
      points: [
        "Platform-agnostic by design: paste links from wherever you generate",
        "The client review flow treats a generated take like any other cut",
        "When the tools change next quarter, your pipeline and your records do not",
      ],
    },
    band: "ai",
    related: ["video-review-software", "storyboard-software"],
  },
  {
    slug: "runner",
    nav: "Runner",
    hint: "It proposes. You decide.",
    hue: "cyan",
    keyword: "AI production assistant",
    metaTitle: "Runner: The AI Production Assistant That Never Acts Alone",
    h1: "It proposes. You decide.",
    lede: "Runner reads the studio's real data to answer what is stalled, who owes what, and where a job stands. When it wants to change anything, it writes a card listing every value and waits for you to press Create.",
    problem: "AI assistants fail producers in one of two ways: they hallucinate answers, or they take actions nobody asked for. A production is a chain of commitments; a tool that invents or improvises inside it is worse than no tool.",
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
          "No deletes, no sends without a named list of who receives",
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
    moreTitle: "More about how it behaves",
    ticks: [
      { t: "Scoped conversations", d: "Threads belong to a project or the studio, and stale ones retire themselves." },
      { t: "Suggested questions", d: "Seeded from real state: an overdue vendor by name, a stalled job by name." },
      { t: "Dictation", d: "The browser's own speech input; no audio ever leaves your machine." },
      { t: "Private threads", d: "Your conversation log is yours; colleagues cannot read it." },
      { t: "Credential firewall", d: "Tokens, share links and signatures are unreadable to it by construction." },
      { t: "Sensible limits", d: "Burst and daily caps, so a held-down Enter key cannot run up a bill." },
    ],
    diff: {
      eyebrow: "The difference",
      title: "The card is the contract.",
      body: "Runner cannot write to your studio. It can only propose, and a proposal is a card you can read in two seconds: every field, every value, Create or Cancel. Confirming runs the exact same code your own buttons run, with the same permissions. There is no second, looser path into your data.",
      points: [
        "Zero unattended writes, by architecture rather than by promise",
        "Every answer traceable to the page that shows the same number",
        "Boring by design, which is what you want near your money",
      ],
    },
    band: "ai",
    related: ["production-budgeting-software", "production-hub"],
  },
];

export function featureBySlug(slug: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

export function featureHref(f: Pick<FeatureDef, "slug">): string {
  return `/${f.slug}`;
}

export function featuresInBand(band: PageBand): FeatureDef[] {
  return FEATURES.filter((f) => f.band === band);
}

/* -------------------------------------------------------------------------- */
/* The module layer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * THE MODULE LAYER (operator, 2026-08-24): the ~two dozen project features,
 * each named and linkable. With the 2026-08-27 restructure most modules
 * GRADUATED to their own keyword page (marked `own: true`, where the whole
 * page is the showcase); the rest remain anchored blocks on the page that
 * argues for them. The inventory stays complete either way, because "does it
 * do call sheets" must be answerable from the nav and the mesh by name.
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
  /** Slug of the feature page the module lives on. */
  page: string;
  /** True when the module IS the page: link to the root, render no block. */
  own?: boolean;
  hue: string;
  /** One-line pitch, shown in the inventory and under the block title. */
  blurb: string;
  points: string[];
};

export function moduleHref(m: ModuleDef): string {
  return m.own ? `/${m.page}` : `/${m.page}#${m.key}`;
}

/** The anchored blocks a page renders. Own-page modules are the page. */
export function modulesForPage(slug: string): ModuleDef[] {
  return MODULES.filter((m) => m.page === slug && !m.own);
}

export const MODULES: ModuleDef[] = [
  // ---- Plan ----
  {
    key: "brief",
    name: "Brief",
    band: "plan",
    page: "production-hub",
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
    page: "production-hub",
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
    page: "production-hub",
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
    page: "production-task-management",
    own: true,
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
    page: "crew-management-software",
    own: true,
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
    page: "production-hub",
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
    page: "crew-management-software",
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
    page: "storyboard-software",
    own: true,
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
    page: "shot-list-software",
    own: true,
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
    page: "moodboard-maker",
    own: true,
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
    page: "ai-video-production",
    own: true,
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
    page: "ai-video-production",
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
    page: "video-review-software",
    own: true,
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
    page: "video-review-software",
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
    page: "ai-video-production",
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
    page: "ai-video-production",
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
    page: "production-communication",
    own: true,
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
    page: "call-sheet-software",
    own: true,
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
    page: "crew-management-software",
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
    page: "crew-management-software",
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
    page: "production-budgeting-software",
    own: true,
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
    page: "production-invoicing",
    own: true,
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
    page: "production-invoicing",
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
    page: "production-budgeting-software",
    hue: "amber",
    blurb: "NDAs, MSAs, SOWs and change orders, both signatures tracked.",
    points: [
      "Masters on the client, SOWs on the job, linked",
      "Which side has signed, stated instead of hunted for",
      "Expiry flagged before a lapsed NDA surprises anyone",
    ],
  },
];
