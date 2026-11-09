/**
 * The help center's content: every article, its category, and its steps.
 *
 * ONE FILE IS THE WHOLE HELP CENTER, the same call lib/marketing/features.ts
 * makes for the feature pages: the index, the filter chips, each article page,
 * the sitemap and the search all read from here, so an article cannot appear
 * in one place and be missing from another.
 *
 * THE RULES FOR WRITING ONE, so the help center stays trustworthy:
 * - Every step names a control that exists today, in the words on the button.
 *   A help article that describes a button nobody can find is worse than none.
 * - A step is one action and what happens after it. If a step needs a second
 *   paragraph, it is two steps.
 * - Media is REAL: a screenshot from scripts/capture-shots.mjs or a clip from
 *   scripts/capture-demos.mjs. A step may NAME a capture that has not been
 *   taken yet; the page leaves it out until the file lands, rather than
 *   shipping a placeholder (the /moodboard-maker lesson).
 * - No em dashes, per CLAUDE.md.
 */

export type HelpCategoryId =
  | "start"
  | "projects"
  | "visualize"
  | "review"
  | "shoot"
  | "money"
  | "sales"
  | "comms"
  | "ai"
  | "team";

export type HelpCategory = {
  id: HelpCategoryId;
  label: string;
  blurb: string;
  /** Identity hue (a --h-* token), same vocabulary as the feature pages. */
  hue: string;
};

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "start", label: "Getting started", blurb: "Your account, your studio and finding your way around.", hue: "indigo" },
  { id: "projects", label: "Projects", blurb: "Starting a job, the project hub, briefs, assets and tasks.", hue: "purple" },
  { id: "visualize", label: "Plan & visualize", blurb: "Shot lists, storyboards, moodboards and the scene builder.", hue: "pink" },
  { id: "review", label: "Client review", blurb: "Sharing work, pinned comments, versions and approvals.", hue: "green" },
  { id: "shoot", label: "Shoot day", blurb: "Schedules, call sheets, contacts, gear and deliverables.", hue: "amber" },
  { id: "money", label: "Money", blurb: "Budgets, costs, paying vendors, estimates and invoices.", hue: "blue" },
  { id: "sales", label: "Clients & pipeline", blurb: "Accounts, deals, follow-ups and request links.", hue: "cyan" },
  { id: "comms", label: "Communication", blurb: "Gmail, Slack and Google Chat inside the project.", hue: "cyan" },
  { id: "ai", label: "AI tools", blurb: "Runner, the AI pipeline, and connecting Claude or ChatGPT.", hue: "purple" },
  { id: "team", label: "Team & settings", blurb: "Inviting people, roles, branding and connections.", hue: "orange" },
];

export type HelpMedia = {
  /** Basename under public/marketing/shots, e.g. "project-budget" or "close/review-comment". */
  shot?: string;
  /** Basename under public/marketing/demos (a screen recording). */
  clip?: string;
  alt: string;
};

export type HelpStep = {
  title: string;
  body: string;
  media?: HelpMedia;
};

export type HelpArticle = {
  slug: string;
  category: HelpCategoryId;
  title: string;
  /** One sentence: what you will be able to do after reading. */
  summary: string;
  /** Rough minutes to follow along, shown on the card. */
  minutes: number;
  /** Extra words the search should match (synonyms people actually type). */
  keywords?: string[];
  /** The article's lead picture, shown above the steps. */
  hero?: HelpMedia;
  steps: HelpStep[];
  tips?: string[];
  /** A marketing feature page to send people to for the bigger picture. */
  feature?: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
  /* ------------------------------------------------------------ Getting started */
  {
    slug: "create-your-account",
    category: "start",
    title: "Create your account and studio",
    summary: "Sign up, confirm your email and land in your own studio.",
    minutes: 2,
    hero: { shot: "signup", alt: "The Create your studio form" },
    keywords: ["sign up", "register", "login", "password", "confirm email"],
    steps: [
      {
        title: "Sign up",
        body: "Go to app.studio-flows.com and choose Sign up. Enter your name, email, a password and your studio's name. The studio name is what appears on call sheets, emails and documents, and you can change it later in Settings.",
      },
      {
        title: "Confirm your email",
        body: "We send a confirmation link to the address you used. Open it and you are signed in. If it does not arrive, check spam, then use the resend link on the login page.",
      },
      {
        title: "Follow the setup checklist",
        body: "Your dashboard opens with a short checklist: add a client, start a project, add your logo, connect a tool and invite your team. Each step ticks itself off when it is really done, and the whole block hides once you have finished.",
      },
    ],
    tips: [
      "Forgot your password? Use Forgot password on the login page and we will email you a reset link.",
      "If someone invited you, sign up from their invite link instead, so you join their studio rather than creating a new one.",
    ],
  },
  {
    slug: "find-your-way-around",
    category: "start",
    title: "Find your way around",
    summary: "The sidebar, the dashboard, notifications and the guided tour.",
    minutes: 3,
    hero: { shot: "dashboard", alt: "The dashboard with project counts, My day, Needs you, the calendar and tasks" },
    keywords: ["navigation", "sidebar", "dashboard", "tour", "dark mode", "theme"],
    steps: [
      {
        title: "Use the sidebar",
        body: "The left sidebar holds everything studio-wide: Dashboard, Projects, Clients, Pipeline, Boards, Communication, Reports and Settings. Collapse it to icons with the control at the bottom when you want more room. On a phone it opens from the menu button at the top.",
      },
      {
        title: "Read the dashboard",
        body: "The dashboard shows what needs you today: KPI tiles, a production calendar, tasks, unpaid invoices, upcoming dates and recent activity. Use Customize to show or hide widgets.",
      },
      {
        title: "Check notifications",
        body: "The bell at the top right shows client comments, approvals, call sheet confirmations and new job requests. Click one to jump to it. Read state is personal, so clearing your bell does not clear a colleague's.",
      },
      {
        title: "Take the tour",
        body: "Open your avatar menu and choose Take the tour for a quick walk through the page you are on. Run it on a project page to get the project version.",
      },
    ],
    tips: ["Switch between light, paper and dark themes from the theme menu in the top bar. Paper is a warm in-between made for long review sessions."],
  },

  /* ------------------------------------------------------------ Projects */
  {
    slug: "start-a-project",
    category: "projects",
    title: "Start a project",
    summary: "Create a job, tie it to a client and pick the kind of production.",
    minutes: 2,
    hero: { shot: "project-hub", alt: "A project hub with its stage stepper, counts, AI summary and module cards" },
    keywords: ["new project", "create job", "wizard", "project type", "ai video", "live action"],
    steps: [
      {
        title: "Press New project",
        body: "On the Projects page, press New project. Step one asks what kind of production it is: general, live action, commercial, AI video or CGI/VFX. The type tailors which tools the project hub surfaces, but nothing is ever locked away.",
      },
      {
        title: "Fill in the details",
        body: "Give it a title, pick the client, and add a shoot date and a due date if you know them. If the client is new, choose + Add a new client and create them without leaving the form.",
      },
      {
        title: "Open the project hub",
        body: "Saving opens the project's hub: every tool for the job grouped into Plan, Visualize, Review and Produce, each card showing live data so you can see where things stand at a glance.",
      },
    ],
    tips: ["You can also start a project from a client's page, which fills the client in for you."],
    feature: "production-hub",
  },
  {
    slug: "move-a-project-through-stages",
    category: "projects",
    title: "Move a project through its stages",
    summary: "Change a project's stage from the board or the hub, and archive it when it wraps.",
    minutes: 2,
    keywords: ["status", "stage", "pre-production", "post", "delivered", "archive", "board", "slate", "timeline"],
    hero: { shot: "projects-board", alt: "Project cards in stage columns" },
    steps: [
      {
        title: "Change the stage",
        body: "On the Projects board, click a card's stage chip and choose the new stage. On the project itself, click a step in the lifecycle stepper at the top of the hub. Stage names adapt to the project type, so an AI job reads Concept and Generation.",
      },
      {
        title: "Switch views",
        body: "Projects has three views: Board, List and Slate. Slate is a studio-wide timeline with one lane per project, so you can spot two shoots landing on the same day.",
      },
      {
        title: "Archive a finished job",
        body: "On the project hub press Archive and confirm. Archiving hides the project from the board and dashboard but keeps everything. Find it again with the Archived toggle on the Projects page, or on the client's page.",
      },
    ],
    feature: "production-hub",
  },
  {
    slug: "brief-and-assets",
    category: "projects",
    title: "Add the brief and upload assets",
    summary: "Store the creative brief and keep every file and version in one library.",
    minutes: 3,
    hero: { shot: "project-assets", alt: "The asset library with an upload area and versioned files" },
    keywords: ["upload", "files", "versions", "library", "drive", "figma", "documents"],
    steps: [
      {
        title: "Write or paste the brief",
        body: "From the project hub open Brief. Write it in place or paste it from the client's email. It saves as you go and shows as a snippet on the hub card.",
      },
      {
        title: "Upload assets",
        body: "Open Assets and drag files onto the page, or use the add menu to import from Google Drive or a Figma file. Large files upload straight to storage, so video is fine.",
      },
      {
        title: "Upload a new version",
        body: "On an asset card, add a new version when the next cut or revision comes in. Older versions stay in the version history, so nothing is ever lost.",
      },
      {
        title: "File paperwork in Documents",
        body: "Permits, insurance certificates and delivery specs belong in Documents, not Assets. Documents keeps where each file came from, such as the email it arrived in.",
      },
    ],
    tips: ["Click any file to open it in the viewer. Office and PDF files preview in place; formats no browser can show, like Apple Pages, offer a download instead."],
  },
  {
    slug: "task-board",
    category: "projects",
    title: "Run the job's task board",
    summary: "Track who is doing what, with columns by status or by phase.",
    minutes: 3,
    keywords: ["tasks", "kanban", "to do", "assign", "checklist", "waiting"],
    hero: { shot: "project-tasks", alt: "A project task board with To do, In progress, Waiting and Done columns" },
    steps: [
      {
        title: "Add a task",
        body: "Open Tasks from the project hub and press add in any column. Type a title and press Enter. Cards land in the column you added them to.",
      },
      {
        title: "Drag to move it",
        body: "Drag a card between To do, In progress, Waiting and Done. Waiting is for work sitting with a client, an agency or a vendor, so the board shows where the job really is.",
      },
      {
        title: "Open a card for detail",
        body: "Click a card to add notes, a due date, a phase, one or more assignees, named checklists, files and comments.",
      },
      {
        title: "Group by phase or switch to a list",
        body: "Use the toggles at the top to group by phase (pre-production, production, post, delivery) instead of status, or to read the same tasks as a list.",
      },
    ],
    tips: ["Need someone on a task who is not on the project yet? Use Invite someone inside the assignee picker."],
    feature: "production-task-management",
  },

  /* ------------------------------------------------------------ Plan & visualize */
  {
    slug: "build-a-shot-list",
    category: "visualize",
    title: "Build a shot list",
    summary: "Create shot lists with size, type, movement and a picture per shot.",
    minutes: 4,
    keywords: ["shots", "coverage", "camera movement", "shot size", "import pdf"],
    hero: { shot: "project-shot-list", alt: "A shot list with thumbnails, descriptions and camera details" },
    steps: [
      {
        title: "Open the shot list",
        body: "From the project hub open Shot list. The left column holds the project's lists; press New shot list to add one. A new list starts with three empty rows.",
      },
      {
        title: "Fill in each shot",
        body: "Type the description, then pick Shot size, Shot type and Camera movement from the suggestions or type your own. Add a code and a shoot day so the schedule knows where it goes.",
      },
      {
        title: "Add a picture",
        body: "Use a row's picture slot to pick a project asset or upload a frame. If the project has a storyboard, Add frames to rows fills empty rows from it by shot number.",
      },
      {
        title: "Import from a PDF",
        body: "Got the director's treatment as a PDF? Use Import from a PDF to read it into rows you check before anything is saved.",
      },
      {
        title: "Export or share",
        body: "Use PDF to download it, Present for a clean full-screen view, Email to send it, or Send to review to put it through your review cycle.",
      },
    ],
    tips: [
      "Select several rows to duplicate, move or delete them together.",
      "Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z redoes.",
      "Fill in the Cover (client, director, job number) once and it prints on every export.",
    ],
    feature: "shot-list-software",
  },
  {
    slug: "make-a-storyboard",
    category: "visualize",
    title: "Make a storyboard",
    summary: "Build a frame-by-frame board, or import one from a PDF.",
    minutes: 3,
    keywords: ["frames", "boards", "aspect ratio", "import pdf", "present"],
    hero: { shot: "project-storyboards", alt: "A storyboard frame grid with captions" },
    steps: [
      {
        title: "Create a storyboard",
        body: "From the project hub open Storyboards and press New storyboard. Pick the frame shape (16:9, 4:5, 9:16 and so on) so every frame is drawn in the shape the job delivers.",
      },
      {
        title: "Add frames",
        body: "Upload a picture per frame or pick one from the project's assets, then add the scene, description, sound and notes under it.",
      },
      {
        title: "Import a board",
        body: "If the board arrived as a PDF, import it. We find each frame's picture and the caption printed beside it, and show you the result to check before saving. One import can fill both a storyboard and a shot list.",
      },
      {
        title: "Present it",
        body: "Use Present or PDF for a dressed export with the job's cover page, or send it to review for pinned client comments.",
      },
    ],
    feature: "storyboard-software",
  },
  {
    slug: "moodboards",
    category: "visualize",
    title: "Lay out a moodboard",
    summary: "Drag notes, images, links, to-dos and columns onto a freeform canvas.",
    minutes: 4,
    keywords: ["board", "canvas", "references", "notes", "arrows", "milanote"],
    hero: { shot: "project-moodboard", alt: "A moodboard canvas with images, notes and columns" },
    steps: [
      {
        title: "Drag a tool onto the board",
        body: "Note, heading, to-do, column and line live on the tool rail at the left. Drag one onto the canvas to place it exactly where you drop it.",
      },
      {
        title: "Add images and links",
        body: "Use Upload, Project assets, Drive or Figma on the rail, or drop files straight onto the canvas. Paste a link to get a card with the page's title and picture.",
      },
      {
        title: "Edit a card",
        body: "Select a card and the rail turns into that card's tools: text formatting, colour, size and more. Resize from any corner.",
      },
      {
        title: "Group and connect",
        body: "Drag cards into a column to stack them. Drag from a selected card's right-edge dot onto another card to draw an arrow between them.",
      },
    ],
    tips: [
      "Copy a card with Cmd/Ctrl+C and paste it onto another board with Cmd/Ctrl+V.",
      "Pinch or scroll with Cmd/Ctrl held to zoom.",
    ],
    feature: "moodboard-maker",
  },
  {
    slug: "scene-builder",
    category: "visualize",
    title: "Previz a setup in the scene builder",
    summary: "Build a 3D set with real cameras, lenses and lights, then send shots to the shot list.",
    minutes: 6,
    hero: { shot: "project-scene-builder", alt: "The scene builder's starting rooms: empty room, seamless, kitchen, bathroom and bedroom" },
    keywords: ["3d", "previz", "lighting", "lens", "camera", "diagram", "viewfinder"],
    steps: [
      {
        title: "Start a setup",
        body: "From the project hub open Scene builder and pick a starting room: an empty stage, seamless, a kitchen, bathroom or bedroom. Each starts with one person, one camera and one key light.",
      },
      {
        title: "Set the camera",
        body: "Pick a camera body and a lens. The frame is calculated from the real sensor and focal length, so a 35mm on an Alexa frames like a 35mm on an Alexa. Drive the camera with the controller pads or the keyboard.",
      },
      {
        title: "Light it",
        body: "Add fixtures from the rail, aim them, set the dimmer and colour temperature, and add modifiers or a diffusion frame. The exposure panel tells you what the subject reads at your stop.",
      },
      {
        title: "Dress the set",
        body: "Use + Add to the set for furniture, props, backdrops and rigging. Upload a product photo to wrap a real label onto a bottle or can.",
      },
      {
        title: "Send to the shot list",
        body: "Press Send to shot list to turn each camera into a shot list row with its frame, shot size and movement filled in.",
      },
    ],
    tips: ["On a phone, the Viewfinder page turns your camera into a director's viewfinder for any lens, and saves location stills you can build a scene from."],
    feature: "previz-software",
  },

  /* ------------------------------------------------------------ Client review */
  {
    slug: "share-for-client-review",
    category: "review",
    title: "Share work for client review",
    summary: "Send a no-login link where the client comments, draws and approves.",
    minutes: 3,
    keywords: ["approval", "feedback", "share link", "client portal", "frame.io"],
    hero: { shot: "client-review-portal", alt: "The client review page with pinned comments" },
    steps: [
      {
        title: "Move the asset into review",
        body: "On the asset, set its status to In review. It now appears on the project's Review page, grouped with everything else waiting on feedback.",
      },
      {
        title: "Press Share for review",
        body: "On the asset press Share for review and copy the link, or email it from the same window with an optional Respond by date. The client needs no account.",
      },
      {
        title: "Lock downloads if you need to",
        body: "Tick the lock to let the client watch and comment but not download until the work is approved. It unlocks by itself on approval.",
      },
      {
        title: "Watch feedback come back",
        body: "Comments and decisions land on the asset and in your notifications. If a due date passes, a reminder goes to the client automatically.",
      },
    ],
    tips: ["Use Client portal on the Review page to give the client one link for everything shared on the job."],
    feature: "video-review-software",
  },
  {
    slug: "pinned-and-timecode-comments",
    category: "review",
    title: "Leave pinned and timecoded comments",
    summary: "Pin notes on images and PDFs, comment at a frame on video, draw on the frame.",
    minutes: 3,
    keywords: ["annotate", "markup", "draw", "timecode", "voice note", "pins"],
    hero: { shot: "close/review-comment", alt: "A numbered pin with its comment beside it" },
    steps: [
      {
        title: "On an image or PDF, click to pin",
        body: "Click the picture where the note belongs. A numbered pin drops there and the comment box opens beside it. On a PDF, flip pages with the page chips.",
      },
      {
        title: "On video, pause and comment",
        body: "Pause on the moment and write your note; it is stamped with the timecode and shown as a marker on the timeline. Use Set out to comment on a stretch instead of one frame.",
        media: { shot: "close/review-stage", alt: "The review stage with markers on the timeline" },
      },
      {
        title: "Draw on the frame",
        body: "Press Draw to mark up with an arrow, line, box, circle or pen in five colours, then write the comment that goes with it.",
      },
      {
        title: "Reply, react and resolve",
        body: "Reply under any comment, add a reaction, and resolve it when it is dealt with. Filter the list to Open, Resolved or Mine.",
      },
    ],
    tips: [
      "Inside the app, switch on Team only to leave a note the client never sees.",
      "Press Voice to record a spoken note instead of typing.",
    ],
    feature: "video-review-software",
  },
  {
    slug: "versions-and-approvals",
    category: "review",
    title: "Compare versions and sign off",
    summary: "Upload the next cut, compare it with the last, and record approvals.",
    minutes: 3,
    hero: { shot: "project-review", alt: "The Review page grouping work by awaiting review and changes requested" },
    keywords: ["compare", "wipe", "v2", "revision rounds", "approve", "request changes"],
    steps: [
      {
        title: "Upload the revision as a new version",
        body: "Add the new cut to the same asset rather than a new one. The client's link now shows it, and their earlier comments stay readable on the older version.",
      },
      {
        title: "Compare",
        body: "Press Compare to view two versions side by side or under a wipe you drag across. Video plays both in sync.",
      },
      {
        title: "Approve or request changes",
        body: "Internally, use the sign-off on the review window. The client uses Approve or Request changes on their link. Either one is recorded against that version.",
      },
      {
        title: "Track revision rounds",
        body: "On the Review page, set how many client revision rounds the job includes. Each deliverable then says how many have been used, so the extra round never goes unnoticed.",
      },
    ],
    feature: "video-review-software",
  },

  /* ------------------------------------------------------------ Shoot day */
  {
    slug: "build-the-schedule",
    category: "shoot",
    title: "Build the shooting schedule",
    summary: "Turn the shot list into a day-by-day schedule whose times re-flow as you edit.",
    minutes: 4,
    keywords: ["stripboard", "shooting schedule", "call time", "lunch", "wrap", "prelight"],
    hero: { clip: "schedule-reflow", alt: "Lengthening a scene re-flows the afternoon and the wrap" },
    steps: [
      {
        title: "Build from the shot list",
        body: "Open Schedule from the project hub and press Build from the shot list. Shots are split into days by their Day column, with setups, lunch and wrap added. The window shows each day's wrap time before anything is written.",
      },
      {
        title: "Adjust the day",
        body: "Change a row's duration and everything after it moves. Pin a row (like lunch at 1:00) to hold its time; the schedule then shows how far the morning runs over or under it.",
        media: { shot: "project-schedule", alt: "A schedule day with call, setup and shoot rows, their durations and the scheduled wrap" },
      },
      {
        title: "Drag rows between days",
        body: "Drag a row to reorder it, or switch to the Board view to move work between days.",
      },
      {
        title: "Add prelight or travel days",
        body: "Use the arrow beside + Add a day to add a prelight, travel, company move or wrap day. Only shoot days are numbered.",
      },
      {
        title: "Share it",
        body: "Download a PDF of the whole schedule or a single day, or share it for client review.",
      },
    ],
    feature: "shooting-schedule-software",
  },
  {
    slug: "send-a-call-sheet",
    category: "shoot",
    title: "Make and send a call sheet",
    summary: "Build the sheet, send each person a private link, and see who has confirmed.",
    minutes: 5,
    keywords: ["callsheet", "crew call", "confirm", "reminder", "template", "duplicate"],
    hero: { shot: "project-callsheet", alt: "A call sheet with its masthead and schedule" },
    steps: [
      {
        title: "Create the sheet",
        body: "Open Call sheet from the project hub and press New call sheet. Edit it right on the page: click any field in the masthead or a block to change it.",
      },
      {
        title: "Arrange the blocks",
        body: "Drag blocks by their grip to reorder them, hide the ones you do not need, and use Add block for a custom section. Save the layout as a template for next time.",
      },
      {
        title: "Add recipients",
        body: "Press Send, then add people by name and email or tick them from the project's contacts.",
        media: { shot: "close/callsheet-send", alt: "The send panel listing recipients with viewed and confirmed columns" },
      },
      {
        title: "Send and track",
        body: "Send emails each person their own link. The panel shows who has viewed and who has confirmed, and Remind chases anyone outstanding. Unconfirmed crew are reminded automatically in the three days before the shoot.",
      },
    ],
    tips: [
      "Press Duplicate to start day 2's sheet from day 1's. People and call times carry over; the date, weather and confirmations do not.",
      "Download PDF prints the industry layout.",
    ],
    feature: "call-sheet-software",
  },
  {
    slug: "project-contacts",
    category: "shoot",
    title: "Manage the job's contacts",
    summary: "Keep crew, talent, extras, vendors and client contacts on one roster.",
    minutes: 3,
    keywords: ["crew", "talent", "roster", "day rate", "allergies", "wardrobe", "vendors"],
    hero: { shot: "project-contacts", alt: "The project contacts roster in folder tabs" },
    steps: [
      {
        title: "Add a person",
        body: "Open Project contacts and press add. Pick a category (crew, talent, extras, vendor, client), a position, and fill in their email, phone and day rate.",
      },
      {
        title: "Add talent details",
        body: "For talent and extras, the Talent details tab holds wardrobe measurements and representation. Everyone gets Catering for dietary needs and allergies.",
      },
      {
        title: "Attach files",
        body: "Use the Files tab for a headshot, W-9 or release.",
      },
      {
        title: "Pull from the client",
        body: "Press + From the client's name to copy one of their contacts onto the roster.",
      },
    ],
    tips: ["Day rates are only visible to studio members, never to project collaborators."],
    feature: "crew-management-software",
  },
  {
    slug: "gear-list",
    category: "shoot",
    title: "Track gear",
    summary: "List the kit for the job with quantities, rates and confirmations.",
    minutes: 2,
    keywords: ["equipment", "rental", "camera kit", "lighting"],
    hero: { shot: "project-gear", alt: "A gear list with quantities and day rates" },
    steps: [
      {
        title: "Add items",
        body: "Open Gear & crew from the project hub and add each item with a quantity and notes.",
      },
      {
        title: "Set day rates",
        body: "Add a rate per day to see each line's cost and the total per day.",
      },
      {
        title: "Confirm as you book",
        body: "Tick items off as they are confirmed so the count at the top always shows what is still open.",
      },
    ],
    feature: "gear-list-software",
  },
  {
    slug: "deliver-final-files",
    category: "shoot",
    title: "Deliver final files to the client",
    summary: "Track deliverables and send the client one link to download everything.",
    minutes: 3,
    hero: { shot: "project-delivery", alt: "The Deliverables page with each deliverable's stage and due date, and the final files" },
    keywords: ["delivery", "masters", "download link", "deliverables", "due date"],
    steps: [
      {
        title: "List the deliverables",
        body: "Open Deliverables from the project hub and add each one with its spec and due date. Each shows whether it is due soon, overdue, or delivered on time.",
      },
      {
        title: "Upload the finals",
        body: "Drop the final files onto Final files and choose which deliverable each belongs to. These stay separate from the working asset library.",
      },
      {
        title: "Send to client",
        body: "Press Send to client to copy or email one download link for the whole job. Files you add later appear on the same link.",
      },
      {
        title: "Mark delivered",
        body: "Set a deliverable's stage to Delivered. Today's date is stamped as the delivery date, and you can change it if it went out earlier.",
      },
    ],
  },

  /* ------------------------------------------------------------ Money */
  {
    slug: "budget-and-costs",
    category: "money",
    title: "Track the budget and log costs",
    summary: "Set the estimate, log every invoice and receipt, and see the margin.",
    minutes: 5,
    keywords: ["estimate", "actuals", "bid vs actual", "receipt", "invoice", "margin", "cost report"],
    hero: { shot: "project-budget", alt: "The budget page with estimate lines and the cost ledger" },
    steps: [
      {
        title: "Enter the estimate",
        body: "Open Budget from the project hub and add a line per category with its estimate. Until costs are attached you can type an actual figure by hand.",
      },
      {
        title: "Add a cost",
        body: "Press + Add a cost and drop in an invoice, estimate or receipt, or take a photo of it on your phone. The form fills itself from the document; check the amount and save.",
      },
      {
        title: "Assign it to a line",
        body: "Pick the budget line the cost belongs to. That line's actual becomes the sum of its costs, so the budget always explains itself.",
      },
      {
        title: "Split deposits",
        body: "For a 50% up front, balance later vendor, use Split on the cost to schedule the payments. Still owed then shows only what is left.",
      },
      {
        title: "Read the margin",
        body: "The margin band compares what you billed with what the job cost, in dollars and as a percentage.",
        media: { shot: "close/budget-margin", alt: "The margin band showing billed, cost and margin" },
      },
    ],
    tips: [
      "Receipts land as paid automatically. Invoices land as received until you mark them paid.",
      "Got the invoice by email? Use Log as a cost on the attachment in Communication.",
    ],
    feature: "production-budgeting-software",
  },
  {
    slug: "pay-vendors-with-bill",
    category: "money",
    title: "Pay vendors through BILL",
    summary: "Connect BILL, collect freelancers' payment details and pay a cost.",
    minutes: 5,
    keywords: ["bill.com", "ach", "pay crew", "freelancer", "vendor payment", "remittance"],
    steps: [
      {
        title: "Connect BILL",
        body: "An admin opens Settings, Connections and connects BILL with the studio's BILL login, then completes the one-time 2-step code. The password is stored encrypted.",
      },
      {
        title: "Ask crew for payment details at wrap",
        body: "On Project contacts press Payment setup to see how each person would be paid. Request payment details sends them BILL's invitation to add their own bank details. You never see their account number.",
      },
      {
        title: "Pay a cost",
        body: "On the budget, press Pay via BILL on a cost. The window shows the vendor, amount, bank account, the pay date and how the money travels before you press Pay. Just add the bill queues it to pay later.",
      },
      {
        title: "The vendor is told",
        body: "When you pay, the vendor gets an email from your studio naming the job and invoice number, so nobody has to chase.",
      },
    ],
    tips: ["Paying requires a BILL plan that includes making payments."],
    feature: "production-budgeting-software",
  },
  {
    slug: "estimates-and-invoices",
    category: "money",
    title: "Send estimates, proposals and invoices",
    summary: "Make a branded document, send it by email or link, and get proposals signed.",
    minutes: 4,
    keywords: ["invoice", "estimate", "proposal", "signature", "pdf", "freshbooks import"],
    hero: { shot: "project-invoices", alt: "An invoice being edited in place" },
    steps: [
      {
        title: "Create a document",
        body: "Open Invoices from the project and create an estimate, a proposal or an invoice. Edit it in place: bill-to, line items with tax, discount, notes and terms.",
      },
      {
        title: "Style it",
        body: "Pick a template, accent colour and font. Save it as the default for every new document.",
      },
      {
        title: "Send it",
        body: "Send by email, copy a link, or download a PDF. A proposal's link asks the client to sign it, typed or drawn, and records when they did.",
      },
      {
        title: "Already made it elsewhere?",
        body: "Use Import a PDF to turn an estimate or invoice exported from another tool into a draft here.",
      },
    ],
    feature: "production-invoicing",
  },
  {
    slug: "studio-reports",
    category: "money",
    title: "Read your studio reports",
    summary: "See revenue, margin, on-time delivery and client response times across jobs.",
    minutes: 2,
    hero: { shot: "reports", alt: "Studio reports with billed, cost, margin, on-time delivery and client response" },
    keywords: ["reports", "analytics", "profit", "turnaround", "quarter"],
    steps: [
      {
        title: "Open Reports",
        body: "Choose Reports in the sidebar and pick a period: This year, Last 12 months or All time.",
      },
      {
        title: "Open a job",
        body: "Each job shows what it billed, cost and made. Open one to see where the cost went by budget category.",
      },
      {
        title: "Download a PDF",
        body: "Use Download PDF for a printable copy with your logo.",
      },
    ],
  },

  /* ------------------------------------------------------------ Clients & pipeline */
  {
    slug: "clients-and-deals",
    category: "sales",
    title: "Manage clients and the deal pipeline",
    summary: "Track prospects, move deals through stages and log every touchpoint.",
    minutes: 4,
    hero: { shot: "pipeline", alt: "The deal pipeline with Inbound, Qualifying, Bidding, Awarded and Lost columns" },
    keywords: ["crm", "leads", "prospects", "pipeline", "deals", "follow up", "accounts"],
    steps: [
      {
        title: "Add a client",
        body: "On Clients, add a company. It can start as a prospect and becomes active when you win work. Change its status from the chip on its page.",
      },
      {
        title: "Add a deal",
        body: "Open Pipeline and add a deal with its value, expected close date and stage. Pick an existing client or create a prospect on the spot.",
      },
      {
        title: "Move it along",
        body: "Click the stage chip to move a deal from Inbound to Qualifying, Bidding, Awarded or Lost. Each move is logged on the timeline.",
      },
      {
        title: "Log activity and follow-ups",
        body: "On a deal or client, log a note, call, meeting or email and add follow-up tasks with due dates. Emails linked to the client appear on its timeline automatically.",
      },
    ],
    feature: "production-crm",
  },
  {
    slug: "client-request-link",
    category: "sales",
    title: "Let clients request new work by link",
    summary: "Give a client one link that turns their request into a deal with the brief attached.",
    minutes: 2,
    hero: { shot: "client", alt: "A client page with its Request link button, contacts, projects and deals" },
    keywords: ["intake form", "request", "new job", "inbound"],
    steps: [
      {
        title: "Create the link",
        body: "On a client's page press Request link, then copy it or email it to them.",
      },
      {
        title: "The client fills it in",
        body: "They describe the job, the date they need it, a budget and attach files. No account needed.",
      },
      {
        title: "It lands in your pipeline",
        body: "Each request becomes an inbound deal with exactly what they sent, and a notification in your bell.",
      },
    ],
    feature: "production-crm",
  },

  /* ------------------------------------------------------------ Communication */
  {
    slug: "connect-gmail-slack-chat",
    category: "comms",
    title: "Bring Gmail, Slack and Google Chat into a project",
    summary: "Link threads and channels to a job and reply without leaving it.",
    minutes: 4,
    keywords: ["email", "gmail", "slack", "google chat", "threads", "reply", "attachments"],
    hero: { shot: "project-communication", alt: "Email, Slack and Chat panels on a project" },
    steps: [
      {
        title: "Connect your accounts",
        body: "Open Settings, Connections and connect Google (Gmail, Chat, Drive and Calendar on one sign-in) and Slack. Google may show an unverified app screen; choose Advanced to continue.",
      },
      {
        title: "Link conversations to the project",
        body: "On the project's Communication page, link the email threads, Slack channels or Chat spaces that belong to the job.",
      },
      {
        title: "Read and reply",
        body: "Threads open on the latest message. Reply from the composer and it sends from your own account, in the same thread. Attach files from your device, the project or Drive.",
      },
      {
        title: "File attachments",
        body: "On an email attachment, choose Add to assets, Add to documents or Log as a cost.",
      },
    ],
    tips: ["Use Polish in the composer to tidy, shorten, warm up or firm up a reply before you send it. Nothing sends until you press Send."],
    feature: "production-communication",
  },

  /* ------------------------------------------------------------ AI tools */
  {
    slug: "ask-runner",
    category: "ai",
    title: "Ask Runner about your studio",
    summary: "Ask questions in plain words and confirm the changes it proposes.",
    minutes: 2,
    keywords: ["assistant", "ai", "chat", "cmd k", "search"],
    hero: { shot: "runner-panel", alt: "The Runner panel answering a question" },
    steps: [
      {
        title: "Open Runner",
        body: "Choose Runner in the sidebar or press Cmd/Ctrl+K. If you are on a project page, it starts focused on that project.",
      },
      {
        title: "Ask",
        body: "Ask anything: who is still owed money, what is overdue, which client asks for the most revisions. Type or use the microphone.",
      },
      {
        title: "Confirm changes",
        body: "When you ask it to do something (log a cost, add a task, move a deal), it shows a card with every value it would save. Nothing changes until you press Create.",
      },
    ],
    feature: "runner",
  },
  {
    slug: "ai-video-pipeline",
    category: "ai",
    title: "Organize an AI video job",
    summary: "Run shots through image and video stages, triage takes and keep every prompt.",
    minutes: 5,
    keywords: ["generative", "higgsfield", "seedance", "takes", "triage", "elements", "prompts"],
    hero: { shot: "project-pipeline", alt: "The AI pipeline with a sequence of shots and their takes" },
    steps: [
      {
        title: "Start an AI video project",
        body: "Choose AI video when you create the project. Its hub shows the AI Pipeline.",
      },
      {
        title: "Build the sequence",
        body: "Write the script, then add shots to the sequence strip. Each shot has an image stage and a video stage.",
      },
      {
        title: "Bring in takes",
        body: "Upload candidates, paste links from your generation tool, or use From Higgsfield to pull your recent generations straight in with their prompts and models.",
      },
      {
        title: "Triage",
        body: "Press Triage for a full-screen pass: arrow keys to move, X to reject, S to star, 1 and 2 to tag start and end frames, Enter to pick the take.",
      },
      {
        title: "Get a client's pick",
        body: "Use Send for a pick to share a set of options on one link. The client stars and picks; your own choices stay yours.",
      },
    ],
    tips: ["Keep characters, locations and props consistent with Elements: save each with its handle and insert it into prompts from the shot."],
    feature: "ai-video-production",
  },
  {
    slug: "connect-claude-or-chatgpt",
    category: "ai",
    title: "Connect your own Claude or ChatGPT",
    summary: "Make a private connector link so your own assistant can read and add to Studio Flows.",
    minutes: 3,
    hero: { shot: "settings-ai-connector", alt: "The AI connector card in Settings with Make a link" },
    keywords: ["mcp", "connector", "claude", "chatgpt", "integration"],
    steps: [
      {
        title: "Make a link",
        body: "Open Settings, AI connector and press Make a link. Copy the URL; it is shown once.",
      },
      {
        title: "Add it to your assistant",
        body: "In Claude, add a custom connector with that URL. In ChatGPT, add it as a developer mode connector with no authentication.",
      },
      {
        title: "Ask it to work",
        body: "Ask about a project, or have it add a shot list, storyboard frames, tasks, contacts, a draft call sheet or costs. It only adds; it never deletes or sends anything.",
      },
      {
        title: "Turn it off",
        body: "Back in Settings, Turn off kills a link immediately.",
      },
    ],
    feature: "runner",
  },

  /* ------------------------------------------------------------ Team & settings */
  {
    slug: "invite-your-team",
    category: "team",
    title: "Invite your team and collaborators",
    summary: "Add studio members, or give crew access to one project only.",
    minutes: 3,
    hero: { shot: "settings", alt: "Settings with the Team card and the invite form" },
    keywords: ["invite", "team", "members", "roles", "collaborator", "reviewer", "permissions"],
    steps: [
      {
        title: "Invite a studio member",
        body: "Use Invite in the top bar (or Settings, Team) and enter their email and role: member or admin. They get an email with a link to join.",
      },
      {
        title: "Invite someone to one project",
        body: "Standing on a project, the same Invite offers project-only access. Collaborators see that project and nothing else: no clients, money or other jobs.",
      },
      {
        title: "Choose edit or review",
        body: "Give a project person Editor access to work on it, or Reviewer access to read, comment and approve without editing.",
      },
      {
        title: "Manage people",
        body: "In Settings, Team, change roles, resend or revoke invites, and remove members.",
      },
    ],
  },
  {
    slug: "branding-and-connections",
    category: "team",
    title: "Set your branding and connections",
    summary: "Add your logo and studio name, and connect Google, Slack, Figma and BILL.",
    minutes: 2,
    hero: { shot: "settings-connections", alt: "The Connections card with Google and Slack connected" },
    keywords: ["logo", "branding", "studio name", "settings", "integrations", "figma", "drive"],
    steps: [
      {
        title: "Add your logo",
        body: "Open Settings, Branding and upload your logo. It appears on the sidebar, call sheets and shot list covers.",
      },
      {
        title: "Rename the studio",
        body: "Admins can press Edit beside the studio name. It is what prints on call sheets and emails.",
      },
      {
        title: "Connect your tools",
        body: "Settings, Connections lists Google, Slack, Figma, BILL and Higgsfield. Connect each once and every project can use it.",
      },
    ],
  },
  {
    slug: "send-feedback",
    category: "team",
    title: "Get help or send feedback",
    summary: "Tell us what got in the way, straight from the app.",
    minutes: 1,
    keywords: ["support", "bug", "contact", "feature request"],
    steps: [
      {
        title: "Open Send feedback",
        body: "Open your avatar menu and choose Send feedback. Describe what happened or what you need and send it.",
      },
      {
        title: "Or write to us",
        body: "Use the Contact page on studio-flows.com for anything else, including a walkthrough.",
      },
    ],
  },
];

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function helpCategory(id: HelpCategoryId): HelpCategory {
  return HELP_CATEGORIES.find((c) => c.id === id) ?? HELP_CATEGORIES[0];
}

export function articlesIn(id: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === id);
}

/** All text an article should be found by, lowercased, for the client search. */
export function searchText(a: HelpArticle): string {
  return [
    a.title,
    a.summary,
    ...(a.keywords ?? []),
    ...a.steps.flatMap((s) => [s.title, s.body]),
    ...(a.tips ?? []),
  ]
    .join(" ")
    .toLowerCase();
}
