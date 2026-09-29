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
};

export const chaptersFor = (slug: string) => CHAPTERS[slug as FeatureSlug];

/**
 * Pages whose LIVE route uses the chapter form. Empty until the operator
 * approves one; every page's chapters can be previewed at /dev/feature/<slug>.
 */
export const LIVE_CHAPTER_PAGES: FeatureSlug[] = [];
