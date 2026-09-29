import type { SceneName } from "@/components/marketing/scene-stage";
import type { FeatureSlug } from "./feature-slugs";

/**
 * The CHAPTERS of a feature page: the detailed, explain-everything version of
 * each page (operator, 2026-09-29). Their brief, in their words: a page must
 * not just say "we have a budget" over an animation of a budget, it has to
 * explain the details (you can upload a PDF and it reads it in), because the
 * user is not going to know and nothing should be a surprise.
 *
 * So a chapter is one part of the feature, told three ways at once:
 * - a HEADLINE and a paragraph saying what the part is for,
 * - a DETAIL LIST naming every capability in it, each with one plain sentence,
 * - a SCENE: an animated mini explainer of that part (scene-stage.tsx), paced
 *   so each action can be followed and labelled beside the pointer.
 *
 * Rule for the details, same as the pricing table and the tick grids: every
 * line names something that is BUILT and reachable today. A chapter page is
 * where a buyer decides what the product does, so a detail that is not true
 * is a refund, not optimism.
 *
 * Kept apart from features.ts because that file is already 1,700 lines of
 * copy and this is a second, much longer layer of it.
 */
export type ChapterDetail = { t: string; d: string };

export type Chapter = {
  /** Short label for the chapter index at the top of the page. */
  nav: string;
  title: string;
  body: string;
  details: ChapterDetail[];
  scene: SceneName;
};

export type ChapterPage = {
  /** The hero's scene: the whole feature in one loop. */
  hero: SceneName;
  chapters: Chapter[];
};

export const CHAPTERS: Partial<Record<FeatureSlug, ChapterPage>> = {
  "moodboard-maker": {
    hero: "moodboard",
    chapters: [
      {
        nav: "Build the board",
        title: "Drag anything onto the canvas.",
        body: "The tool rail down the side holds everything a board is made of. Every tool is dragged, never clicked, so a new card lands exactly where you drop it instead of on top of the reference you were looking at.",
        details: [
          { t: "Notes with real formatting", d: "Bold, italic, underline, lists and links, written straight onto the board, with a colour for the card itself." },
          { t: "Headings that read from across the room", d: "Any size from a small caption to a banner, a text colour, and a fill so a section of the board has a clear label." },
          { t: "To-do cards", d: "A checklist for what the look still needs before the shoot, ticked off on the board where everyone can see it." },
          { t: "Colour and shape cards", d: "Swatches and simple shapes for the parts of a look that are not a photograph." },
          { t: "Drag-only on purpose", d: "Clicking a tool tells you to drag it rather than dropping a card somewhere random, so the board never fills up with cards to dig out." },
        ],
        scene: "mb-build",
      },
      {
        nav: "Bring references in",
        title: "The references already live somewhere. Pull them in.",
        body: "A board is only useful if feeding it is faster than keeping the screenshots in a folder. So references come in from wherever they already are, and an uploaded image is on the board the moment you drop it, while it saves in the background.",
        details: [
          { t: "Upload from your device", d: "Drop a batch of photos at once. They appear instantly and finish saving while you keep working." },
          { t: "Paste any link", d: "The page's title and preview image are pulled in, so a Pinterest pin or a director's reel becomes a card you can read at a glance." },
          { t: "From the project's own assets", d: "Pick anything already in the job's library without downloading and re-uploading it." },
          { t: "Google Drive", d: "Browse your folders or search, and bring files straight onto the board." },
          { t: "Figma frames", d: "Paste a Figma file link and import its frames as images." },
          { t: "Video cards", d: "A clip plays on the board, with a caption under it like any image." },
        ],
        scene: "mb-import",
      },
      {
        nav: "Organize",
        title: "A hundred references, still a board you can read.",
        body: "Every moodboard eventually becomes a pile. Columns, arrows and lines are how this one stays a board: group what belongs together, and draw the reasoning, not just the references.",
        details: [
          { t: "Columns", d: "Drag a card onto a column and it files itself inside. Reorder within the column, or pull a card back out onto the board." },
          { t: "Connections", d: "Drag from a card's anchor to another card and an arrow joins them, so the board records why two frames belong together." },
          { t: "Lines and arrows", d: "Free lines in any colour, solid or dashed, with a weight, a label, and an arrowhead on either end or both." },
          { t: "Captions", d: "A line of text under any image or video card, for the note that only makes sense next to the picture." },
          { t: "A board per job, or for the whole studio", d: "Attach a board to one project, or keep a studio-wide board that follows you across every job." },
        ],
        scene: "mb-organize",
      },
      {
        nav: "Edit in place",
        title: "Pick a card and the tools become its tools.",
        body: "Select anything and the rail turns into that card's editor, in the same spot, so the canvas never shifts and nothing covers the card you are working on. The small things behave the way your hands expect them to.",
        details: [
          { t: "A rail that changes with the selection", d: "A note gets text formatting and colours, an image gets resize and link tools, a line gets its style. Options open in a small flyout on demand." },
          { t: "Resize from any corner", d: "Four visible handles, and the opposite corner stays put while you drag." },
          { t: "Zoom that behaves", d: "Pinch twice as far and it zooms twice as much, anchored under your cursor, on a trackpad or a mouse wheel." },
          { t: "Undo and redo", d: "Sixty steps of history per board, on Cmd or Ctrl Z." },
          { t: "Copy and paste between boards", d: "Copy a card on one board and paste it onto another, even on a different project." },
          { t: "Dots, grid or plain", d: "Choose the canvas background that suits the board." },
        ],
        scene: "mb-edit",
      },
      {
        nav: "Get sign-off",
        title: "Send the board. Get pins back.",
        body: "When the look is ready, the client reviews the board itself, not a PDF of it. They open a link with no login, point at the exact reference they mean, and sign it off, and every note lands back on the job.",
        details: [
          { t: "A link, no account needed", d: "The client opens the board in their browser and can comment and approve straight away." },
          { t: "Pinned comments", d: "Numbered pins on the exact spot, with threaded replies and reactions, so feedback is never an adjective in an email." },
          { t: "Drawing on the board", d: "Arrows, circles, boxes and freehand marks in a few colours, attached to the comment they explain." },
          { t: "Internal review first", d: "Send the board to your team's review before the client sees it, then share it once it is greenlit." },
          { t: "Into the client binder", d: "Add the approved board to the project binder alongside the storyboard and the shot list." },
        ],
        scene: "mb-review",
      },
    ],
  },
  "production-budgeting-software": {
    hero: "budget",
    chapters: [
      {
        nav: "Bid against actual",
        title: "Every line, bid against what it actually cost.",
        body: "Set the bid for each line of the job. The actual fills itself in from the costs you log against that line, so the number is never somebody's guess from three weeks ago, and a line that runs over the bid turns red while there is still time to do something about it.",
        details: [
          { t: "Actuals built from real costs", d: "A line's actual is the sum of the invoices filed against it, and it shows how many there are." },
          { t: "Quick numbers still work", d: "A line with nothing filed yet keeps a typed figure, so a fast estimate is never blocked." },
          { t: "Nothing slips through", d: "A cost that has not been given a line yet still counts toward the job's total, because the money left either way." },
          { t: "Over the bid, in red", d: "Lines that run past their bid, and the job's total, go red on the page." },
          { t: "On the project's front page", d: "The bid-against-actual bar sits on the project hub, from the same numbers as this page." },
        ],
        scene: "bg-lines",
      },
      {
        nav: "Log a cost",
        title: "A cost is a record, not a typed number.",
        body: "Every cost carries who it was from, what it was for, the invoice itself and where it stands. Pick the vendor from the people already on the job and the app knows the rate you agreed, so an invoice that does not match gets flagged before you pay it.",
        details: [
          { t: "Vendor from the job's roster", d: "Pick a crew member or supplier already on the project, with their agreed day rate shown beside them." },
          { t: "Rate checking", d: "Enter the days and it compares days times the agreed rate against the invoiced amount, and flags anything over or under." },
          { t: "The invoice rides on the cost", d: "Attach the PDF or photo, and open it later from the ledger with one click." },
          { t: "Status that means something", d: "Received, approved, paid. Click the chip to move it along." },
          { t: "Invoice number and due date", d: "Kept on the cost, so the list of what is due, and when, builds itself." },
        ],
        scene: "bg-ledger",
      },
      {
        nav: "Read the invoice",
        title: "Drop in the invoice. The form fills itself.",
        body: "Attach a supplier's invoice or estimate and the app reads it for you: who it is from, the amount, the dates, the invoice number and which line it belongs to. It fills the form and tells you exactly what it filled. You check it and save, so no money figure is ever written without a person looking at it.",
        details: [
          { t: "PDFs and photos", d: "A PDF straight from the vendor, or a photo of a paper invoice taken on your phone." },
          { t: "It finds the right vendor", d: "The name on the invoice is matched against the people on the job, including when the work was billed through an agency." },
          { t: "Reads estimates too", d: "A vendor's estimate becomes the cost you are committing to, weeks before the final invoice arrives." },
          { t: "You always confirm", d: "A banner names every field it filled, with Undo, and nothing saves until you press Save." },
          { t: "Straight from the email", d: "An invoice attached to a Gmail thread on the project becomes a cost with Log as a cost, no downloading." },
          { t: "Foreign currency warned", d: "An invoice in another currency is called out rather than quietly treated as dollars." },
        ],
        scene: "bg-read",
      },
      {
        nav: "Deposits and schedules",
        title: "Deposits stop being a guess.",
        body: "Vendors want a deposit up front and the balance later. Split any cost into payments with their own due dates, mark each one when it goes out, and the app keeps track of exactly what is still owed, on this job and across every job you have running.",
        details: [
          { t: "Deposit and balance in one step", d: "Choose a percentage and two due dates. The balance is the remainder, so the two always add back to the total." },
          { t: "Any schedule you need", d: "Add as many payments as the vendor asks for, each with its own date and a note of how it was paid." },
          { t: "Still owed, exactly", d: "A part-paid cost counts only what is left, on the budget page, the ledger and the dashboard." },
          { t: "The next payment date", d: "Each cost shows when its next payment is due, and flags it when it is overdue." },
          { t: "Every job's unpaid bills in one list", d: "A dashboard widget totals what you owe across all your live projects, overdue first." },
        ],
        scene: "bg-schedule",
      },
      {
        nav: "Margin and privacy",
        title: "Know what the job made. Only you.",
        body: "What you billed and what the job cost sit on one page, from real documents on both sides, and the margin is worked out for you. None of it is visible to the crew you invite onto a project: they see the work, never the money.",
        details: [
          { t: "Billed from your invoices", d: "Only what you actually invoiced counts, never an estimate or a proposal. With no invoices yet, it uses the figure you entered on delivery." },
          { t: "Margin in dollars and percent", d: "Worked out as profit on what you billed, the way a studio quotes it." },
          { t: "A bar that turns red on a loss", d: "Cost shown as a share of what you billed, so a job going under is obvious at a glance." },
          { t: "Crew cannot see the money", d: "Budgets, costs, invoices and day rates are hidden from collaborators by the database itself, not just by hiding a button." },
          { t: "One source of truth", d: "The budget page, the project hub and the dashboard all work from the same ledger, so they never disagree." },
        ],
        scene: "bg-margin",
      },
    ],
  },
  "call-sheet-software": {
    hero: "callsheet",
    chapters: [
      {
        nav: "Build the sheet",
        title: "Build the call sheet on the call sheet.",
        body: "There is no form to fill in and preview. You edit the real sheet in place, laid out the way the industry expects, and what you see is what the crew gets.",
        details: [
          { t: "The industry masthead", d: "Your logo, the production, key contacts, the general call, and a table for breakfast, lunch, wrap, sunrise, sunset and weather." },
          { t: "Blocks in any order", d: "Locations, crew, cast, company, notes and more, dragged by their handle into the order this day needs." },
          { t: "Hide what you do not need", d: "Hidden blocks wait in the palette and come back with one click." },
          { t: "Your own blocks", d: "Add a text block for parking, safety, a dress code or anything else, with its own heading." },
          { t: "Your colour", d: "An accent colour for headings and the masthead, carried onto the printed sheet." },
          { t: "Templates", d: "Save the layout and colour as a template and apply it to the next job's sheets." },
        ],
        scene: "cs-build",
      },
      {
        nav: "Every day of the shoot",
        title: "Day one, day two, the prelight. One click each.",
        body: "A job has as many call sheets as it has days. Duplicate yesterday's and change what changed, instead of starting again. When you need paper, the PDF is one click.",
        details: [
          { t: "As many sheets as the job needs", d: "Each day, the scout and the prelight gets its own sheet, status and recipients." },
          { t: "Duplicate a sheet", d: "Crew, call times, locations and the layout all carry over, so the next day takes minutes." },
          { t: "Nothing stale goes out", d: "The date and weather are left blank on the copy, and the app tells you to fill them in, so yesterday's date never reaches the unit." },
          { t: "Fresh links for the copy", d: "The same people come across, each with a new link and no history, so nobody looks confirmed for a day they have not seen." },
          { t: "One-click PDF", d: "A print-ready sheet in the industry layout, in light colours, with your accent kept." },
        ],
        scene: "cs-dup",
      },
      {
        nav: "A link per person",
        title: "Everyone gets their own link. You see who read it.",
        body: "Pick people off the project's roster and each one gets a personal link to the sheet. You see who opened it and who confirmed, and the three kinds of silence are separated, because they are different problems.",
        details: [
          { t: "Recipients from the roster", d: "Tick crew and client contacts off the project's list, or add anyone by name and email." },
          { t: "Email or copy the link", d: "Send it from the app, or copy a person's own link into a text message." },
          { t: "Viewed and confirmed", d: "Each person's link records when they opened it and when they pressed Confirm." },
          { t: "Three numbers that matter", d: "Confirmed, viewed but not confirmed, and not opened, with a filter for each." },
          { t: "Sent status, automatically", d: "Emailing a sheet moves it from Draft to Sent without anyone touching the chip." },
          { t: "No login for crew", d: "The link opens the sheet in any browser, on any phone." },
        ],
        scene: "cs-send",
      },
      {
        nav: "The chasing",
        title: "The chasing happens without you.",
        body: "As the shoot gets close, anyone who has not confirmed gets a reminder by email. It stays polite by design: it starts three days out, sends at most one a day, stops after two, and stops the moment someone confirms.",
        details: [
          { t: "Starts three days before", d: "A sheet built weeks ahead stays quiet until the shoot is close." },
          { t: "One a day, two at most", d: "After two reminders it stops, because at that point it is a phone call." },
          { t: "Stops on confirm", d: "Confirming ends the reminders for that person immediately." },
          { t: "Plain language", d: "The email says tomorrow or in two days, not a bare date." },
          { t: "Nudge by hand", d: "A Remind unconfirmed button sends the same email now, sharing the same limit so nobody gets doubled up." },
          { t: "On the project's front page", d: "The hub shows confirmed over total, amber until everyone is in, green when they are." },
        ],
        scene: "cs-chase",
      },
      {
        nav: "Crew meals",
        title: "The lunch email, handled.",
        body: "On a real shoot there is a second email: a group-order link with a cutoff, and a morning spent chasing whoever ignored it. Paste the link, choose who is on the order, send it, and see who opened it.",
        details: [
          { t: "Paste any group-order link", d: "Whichever delivery app you use. The crew order there, the app handles everything around it." },
          { t: "Choose who is on the order", d: "Everyone on the sheet by default, and leave the client or the agency off a crew lunch." },
          { t: "Who opened it", d: "Each person's link shows when they opened it, and people can mark themselves as ordered." },
          { t: "Chase outstanding", d: "One click emails everyone who has not opened it yet." },
          { t: "Nothing after the cutoff", d: "No reminder is sent once the order has closed." },
          { t: "On the printed sheet", d: "The call sheet carries the meal plan and the cutoff, never the live link, since a sheet gets forwarded widely." },
        ],
        scene: "cs-meals",
      },
    ],
  },
  "video-review-software": {
    hero: "review",
    chapters: [
      {
        nav: "Share it",
        title: "A link your client will actually use.",
        body: "Send the cut, the frame or the board as a link. The client opens it in any browser, types their name, and starts reviewing, with no account to make and nothing to install. Give it a respond-by date and the chasing happens for you.",
        details: [
          { t: "No login for the client", d: "They open the link, type their name so you know who said what, and comment straight away." },
          { t: "Email it from the app", d: "Send the review link with a message, from inside the project." },
          { t: "Respond-by dates", d: "The client sees the date in amber, and in red once it has passed." },
          { t: "Reminders that stop", d: "An overdue review gets a nudge by email, at most three, two days apart, and none once they respond." },
          { t: "Every version on the link", d: "The client can open earlier versions and the notes left on them, while only the latest can be approved." },
        ],
        scene: "rv-share",
      },
      {
        nav: "Pins on the frame",
        title: "Point at the exact spot.",
        body: "Click anywhere on an image and write the note there. A numbered pin marks the spot and the comment sits beside it, so feedback is never 'the thing on the left'. PDFs work the same way, page by page, which is how a director's storyboard usually arrives.",
        details: [
          { t: "Numbered pins", d: "Every note is pinned to the spot it is about and numbered to match the comment rail." },
          { t: "PDFs, page by page", d: "Each page gets its own pins, and page chips show how many notes each one has." },
          { t: "Zoom that stays sharp", d: "Fit, 1.5x, 2x and 3x, re-rendered at each size so small type is readable." },
          { t: "Your documents too", d: "Shot lists, storyboards, moodboards, props and the shooting schedule go through the same review." },
        ],
        scene: "rv-pins",
      },
      {
        nav: "Frame-accurate video",
        title: "Notes on the moment, not a timestamp in an email.",
        body: "Pause on a frame and comment on it, or mark a whole stretch that drags. Markers sit on the timeline and clicking a note jumps straight to it. The player has what an editor expects, and the guides answer the question every commercial asks: does it survive the vertical cutdown?",
        details: [
          { t: "Comment on a frame", d: "Pause and write. The note is pinned to that exact moment, in broadcast timecode." },
          { t: "Range comments", d: "Mark an in and an out for a note about a whole section. Clicking it plays just that stretch." },
          { t: "An editor's player", d: "J, K and L shuttle, frame stepping, playback speed from 0.25x to 2x, loop and volume." },
          { t: "Safe areas and crop masks", d: "Title and action safe, rule of thirds, and 1:1, 4:5 and 9:16 masks for social cuts." },
          { t: "Zoom and grab a frame", d: "Zoom to 2x or 4x and pan, or download the current frame as a still." },
        ],
        scene: "rv-video",
      },
      {
        nav: "Draw and discuss",
        title: "Draw on it. Then talk it through.",
        body: "Sometimes the note is easier to draw than to write. Mark up the frame with arrows, boxes and circles, then discuss it in a thread until it is done and resolved.",
        details: [
          { t: "Drawing tools", d: "Arrow, line, box, circle and freehand pen, in five colours, with undo and redo." },
          { t: "Drawings stay attached", d: "Selecting a comment replays its drawing, on any screen size." },
          { t: "Threaded replies", d: "The studio and the client reply under the note, so the conversation stays with the frame." },
          { t: "Reactions", d: "A quick thumbs up when the note is just agreement." },
          { t: "Resolve, filter and search", d: "Mark notes resolved, filter by open, resolved or yours, and search every comment." },
          { t: "Edit or delete your own", d: "People can fix their own notes, and only their own." },
        ],
        scene: "rv-draw",
      },
      {
        nav: "Versions and sign-off",
        title: "Every round kept. One clear yes.",
        body: "Upload the next version on top of the last. Nothing is lost: each version keeps its own notes, before and after can sit side by side, and the client approves or requests changes on the latest. Your team can greenlight it internally before the client ever sees it.",
        details: [
          { t: "Versions, never overwritten", d: "v1, v2 and v3 all stay openable, each with the notes that were left on it." },
          { t: "Compare side by side", d: "Put two versions of an image next to each other to see what changed." },
          { t: "Approve or request changes", d: "One clear decision from the client, recorded against the version they saw." },
          { t: "Internal review first", d: "Your team reviews and greenlights on the project's Review page before anything goes to the client." },
          { t: "In your notifications", d: "Every client comment and decision lands in the studio's bell, with their name on it." },
          { t: "Send options for a pick", d: "For generated shots, share a set of takes and get back stars, notes and one pick per reviewer." },
        ],
        scene: "rv-versions",
      },
    ],
  },
  "shot-list-software": {
    hero: "storyboard",
    chapters: [
      {
        nav: "Shots as rows",
        title: "A shot list that reads like a shot list.",
        body: "Every shot is a row, with the columns a crew actually reads: what it is, the size, the type and the camera move. Pick from the standard terms or type your own, and give each shot its code and day.",
        details: [
          { t: "The columns that matter", d: "Description, shot size, shot type and camera movement, each in its own column." },
          { t: "Standard terms, or your own", d: "Pick Close-up or Dolly in from the list, or type something the list does not have." },
          { t: "Codes and days", d: "Give each shot its number (1A, 2B) and the day it shoots on." },
          { t: "Undo and redo", d: "Every edit can be taken back, on Cmd or Ctrl Z." },
        ],
        scene: "sl-rows",
      },
      {
        nav: "A frame on every shot",
        title: "A picture on every shot.",
        body: "A shot list is easier to shoot from when every row shows what the shot looks like. Pick a frame from the project's assets, upload one, or pull the whole board's frames onto the list in one click.",
        details: [
          { t: "From the project's assets", d: "Choose any image already on the job for a row." },
          { t: "Or upload one", d: "Drop a reference straight into the row." },
          { t: "Pull frames off the storyboard", d: "Add frames to every row in one click, matched by shot number, so 1B gets frame 1B." },
          { t: "Only fills the gaps", d: "Rows that already have a picture are left alone, so it is safe to run again." },
        ],
        scene: "sl-frames",
      },
      {
        nav: "Import a PDF",
        title: "The treatment becomes the shot list.",
        body: "The client sends a treatment or a script as a PDF. Instead of retyping it, drop it in: the app reads it and proposes the shots, and you choose which ones go on the list.",
        details: [
          { t: "Reads decks and scripts", d: "The beats of the cut become rows, and the look described on the visual pages is picked up too." },
          { t: "The right cut", d: "When a script has a :30 and a :15, it reads the longest one, so shots are not listed twice." },
          { t: "On-screen text kept apart", d: "A super or a title card is not mistaken for a shot." },
          { t: "You choose", d: "Every proposed shot is a tick box. Nothing goes on the list until you add it." },
        ],
        scene: "sl-import",
      },
      {
        nav: "Organize and schedule",
        title: "Every day of the shoot, sorted.",
        body: "Keep one list per day, per location, or however the job splits. Move shots between lists in bulk, and when the list is ready, the shooting schedule builds itself from it.",
        details: [
          { t: "As many lists as you need", d: "A list per day or per location, each with its own shot count." },
          { t: "Select and act in bulk", d: "Tick several shots and duplicate, move them to another list, or delete them together." },
          { t: "The schedule builds from it", d: "The schedule page lays out each day from your lists' day column, with setups between shots and lunch placed for you." },
          { t: "On the project's front page", d: "The shot count sits on the project hub, one click from anywhere." },
        ],
        scene: "sl-organize",
      },
      {
        nav: "Share and print",
        title: "Present it, print it, get it signed off.",
        body: "Fill in the job details once and every export carries them. Print a PDF with a proper cover, or share the list for review and let the client pin notes on the exact shot.",
        details: [
          { t: "A cover block", d: "Client, agency, director, job number and more, filled in once and printed on the shot list, the storyboard and the binder." },
          { t: "One-click PDF", d: "A clean export with the frames, ready to hand out or send." },
          { t: "Share for review", d: "A link with no login, where the client pins a note on the shot they mean and approves the list." },
          { t: "Email it", d: "Send the review link from the app, with a respond-by date if you want one." },
          { t: "Export one list or all", d: "Print a single day's list or every list on the job." },
        ],
        scene: "sl-share",
      },
    ],
  },
  "storyboard-software": {
    hero: "sb-import",
    chapters: [
      {
        nav: "Frames with notes",
        title: "Every frame, with everything it needs.",
        body: "A storyboard here is a grid of frames in order, and every frame carries its own notes: the scene, what happens, the sound and anything else the crew should know. Add frames and drag them into order, and the numbers follow.",
        details: [
          { t: "An image per frame", d: "Upload a drawing or pick an image from the project's assets." },
          { t: "Scene, description, sound, notes", d: "Four fields on every frame, so the board is readable without the director in the room." },
          { t: "Drag to reorder", d: "Move a frame and every frame after it renumbers itself." },
          { t: "Several boards per job", d: "One board for the hero spot, another for the cutdowns, each listed beside the grid." },
          { t: "Undo and redo", d: "Snapshot history per board, on the keyboard shortcut." },
        ],
        scene: "sb-grid",
      },
      {
        nav: "The right shape",
        title: "Frames that keep their shape.",
        body: "Boards are drawn for the format they will run in. Choose 16:9, 4:5, 9:16 or 1:1 and every frame redraws in that shape, showing the whole picture rather than a strip cut out of the middle.",
        details: [
          { t: "Four frame shapes", d: "16:9 for broadcast, 4:5 and 1:1 for feeds, 9:16 for vertical." },
          { t: "Detected on import", d: "A board read from a PDF picks up its own frame shape automatically." },
          { t: "Never cropped", d: "The full image is always shown, on the page, in review and in the PDF." },
        ],
        scene: "sb-aspect",
      },
      {
        nav: "Import a board",
        title: "The board, straight off the PDF.",
        body: "Directors send boards as PDFs. Drop one in and the app finds each frame on every page, reads the caption next to it and files it into the right fields. The shot list comes with it, with every row already carrying its frame.",
        details: [
          { t: "Finds the frames", d: "Each picture on each page becomes a frame, with logos and page furniture left out." },
          { t: "Captions filed properly", d: "Shot numbers, action, camera, voiceover and notes each land in their own field." },
          { t: "Check before it goes in", d: "Every frame is shown with its number and first line before you import." },
          { t: "A shot list too", d: "When the board has both, the shot list is created alongside, each row matched to its frame by number." },
        ],
        scene: "sb-import",
      },
      {
        nav: "Review and sign-off",
        title: "Your team first. Then the client.",
        body: "Send the board into the project's review so your team can pin notes and greenlight it. Then share it with the client, who reviews the board itself, pins notes on the frame they mean, and approves it.",
        details: [
          { t: "Internal review", d: "The board appears on the project's Review page, with team notes and a greenlight." },
          { t: "Then share with the client", d: "A link with no login, from the same place, once the team is happy." },
          { t: "Pinned notes and drawings", d: "The client pins a comment or draws on the frame they mean." },
          { t: "Approve or request changes", d: "One clear decision, with the notes that explain it." },
          { t: "Into the client binder", d: "Add the approved board to the project binder with everything else the client needs." },
        ],
        scene: "sb-review",
      },
      {
        nav: "Present and send",
        title: "A board that looks like it came from a studio.",
        body: "Present the board on screen or print it as a PDF, with a dark cover carrying the job details and two frames to a page so every note is readable at print size. Email it from the app with a review link attached.",
        details: [
          { t: "A proper cover", d: "Client, agency, director and job number from the job block you filled in once." },
          { t: "Two frames a page", d: "Big enough to read, with the frame number on the picture and its notes beneath." },
          { t: "Prints in light", d: "The PDF always prints light, whatever theme you work in." },
          { t: "Email with a review link", d: "Send it with a respond-by date, and the client reviews it in the browser." },
        ],
        scene: "sb-export",
      },
    ],
  },
};

export const chaptersFor = (slug: string) => CHAPTERS[slug as FeatureSlug];

/**
 * Pages whose LIVE route uses the chapter form. Empty until the operator
 * approves one; every page's chapters can be previewed at /dev/feature/<slug>.
 */
export const LIVE_CHAPTER_PAGES: FeatureSlug[] = [];
