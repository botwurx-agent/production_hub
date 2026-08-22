/**
 * Every module in a project, grouped into the four phase bands the product
 * actually uses.
 *
 * DRAWN, NOT PHOTOGRAPHED, and that was a deliberate reversal. The hub is the
 * tallest page in the app, so every screenshot of it cut something off, and a
 * crop of "here is everything in one place" argues against itself. Rebuilt in
 * the site's own tokens it fits any width, stays sharp, reflows on a phone, and
 * can move.
 *
 * The honesty rule that keeps this from being a marketing invention: the bands,
 * the module names and the hue per band are the ones in the product. This is a
 * diagram OF the hub, not a nicer imaginary version of it. The six screenshots
 * elsewhere on the page carry the burden of proof; this one carries the shape.
 */

type Module = { name: string; note: string; icon: string };
type Band = { name: string; hue: string; to: string; modules: Module[] };

// Paths are drawn in a 20x20 box, stroked not filled, to match the icon
// language the rest of the site already uses.
export const BANDS: Band[] = [
  {
    name: "Plan",
    hue: "indigo",
    to: "purple",
    modules: [
      {
        name: "Brief",
        note: "The creative direction",
        icon: "M5 3h7l3 3v11H5z M12 3v3h3 M7.5 10h5 M7.5 13h4",
      },
      {
        name: "Assets",
        note: "Every file, versioned",
        icon: "M3.5 5h13v10h-13z M6.5 12l2.5-3 2 2.5 1.5-1.5 3 3",
      },
    ],
  },
  {
    name: "Visualize",
    hue: "purple",
    to: "pink",
    modules: [
      {
        name: "Storyboards",
        note: "Frames in order",
        icon: "M3 5h6v5H3z M11 5h6v5h-6z M3 12h6v3H3z M11 12h6v3h-6z",
      },
      {
        name: "Shot list",
        note: "Every setup on the day",
        icon: "M4 6h2.2v2.2H4z M8.5 7h7.5 M4 11.8h2.2V14H4z M8.5 12.8h7.5",
      },
      {
        name: "Moodboard",
        // Overlapping, tilted frames rather than a tidy grid: at this size a
        // neat grid was indistinguishable from the storyboard glyph beside it.
        note: "References on a canvas",
        icon: "M3.5 6.5h7v7h-7z M8 4h8.5v7.5",
      },
    ],
  },
  {
    name: "Review",
    hue: "green",
    to: "cyan",
    modules: [
      {
        name: "Approvals",
        note: "Pinned notes, a clear yes",
        icon: "M10 3a7 7 0 100 14 7 7 0 000-14z M7 10l2 2 4-4",
      },
      {
        name: "Communication",
        note: "Threads tied to the job",
        icon: "M17 12a2 2 0 01-2 2H7l-3 3V5a2 2 0 012-2h9a2 2 0 012 2z",
      },
    ],
  },
  {
    name: "Produce",
    hue: "amber",
    to: "orange",
    modules: [
      {
        name: "Contacts",
        note: "Crew, talent, vendors",
        icon: "M12.5 16v-1.4a2.8 2.8 0 00-2.8-2.8H6.3a2.8 2.8 0 00-2.8 2.8V16 M8 9.4a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2 M16.5 16v-1.4a2.8 2.8 0 00-2.1-2.7",
      },
      {
        name: "Calendar",
        // Kept under ~23 characters like its neighbours: at this column width
        // a longer note wraps and stretches the whole row taller.
        note: "Shoot days, milestones",
        icon: "M4 5.5h12V16H4z M4 9h12 M7 3.5v3 M13 3.5v3",
      },
      {
        name: "Call sheet",
        note: "Sent, viewed, confirmed",
        icon: "M7 4H5.5v12h9V4H13 M7.6 2.9h4.8v2.3H7.6z M8 9h4 M8 12h4",
      },
      {
        name: "Budget",
        note: "Bid against actual",
        icon: "M10 3.6v12.8 M12.9 6.6c-.5-.9-1.6-1.4-2.9-1.4-1.7 0-3 .9-3 2.1 0 2.9 6 1.6 6 4.5 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.6-3-1.5",
      },
      {
        name: "Documents",
        note: "Permits, specs, insurance",
        icon: "M3 6h4.6l1.5 2H17v8.5H3z M3 6V4.5h5",
      },
      {
        name: "Agreements",
        note: "NDAs, SOWs, signatures",
        icon: "M5 3.5h7l3 3v10H5z M12 3.5v3h3 M7.4 13.2c1.4-1 1.9-2.4 2.9-2.4s1 1.5 2 1.5",
      },
      {
        name: "Delivery",
        note: "Final files and billing",
        icon: "M3 7.4 10 4l7 3.4v6.2L10 17l-7-3.4z M3 7.4 10 10.8l7-3.4 M10 10.8V17",
      },
    ],
  },
];

function ModuleCard({ mod, hue, to, step }: { mod: Module; hue: string; to: string; step: number }) {
  return (
    <div
      // `step` staggers the cascade WITHIN a row. Cards in different rows
      // already stagger for free, because each carries its own view() timeline
      // and sits at a different height, but siblings on one line would
      // otherwise arrive together and read as a block dropping in.
      style={{ "--sf-step": step } as React.CSSProperties}
      className="sf-mod flex items-start gap-3 rounded-[14px] border border-border bg-surface p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] shadow-sm"
        style={{
          background: `linear-gradient(135deg, var(--h-${hue}), var(--h-${to}))`,
          color: "var(--accent-fg)",
        }}
      >
        {/* 21px in a 40px tile. At 18-in-36 several of these collapsed into an
            indistinct mark, which defeats the point of giving each module its
            own glyph. */}
        <svg width="21" height="21" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d={mod.icon}
            stroke="currentColor"
            strokeWidth="1.45"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-tight text-text">{mod.name}</div>
        <div className="mt-1 text-[13px] leading-snug text-text-muted">{mod.note}</div>
      </div>
    </div>
  );
}

export function ModuleMap() {
  return (
    <div className="space-y-8">
      {BANDS.map((band) => (
        <div
          key={band.name}
          className="grid gap-4 lg:grid-cols-[190px_1fr] lg:gap-8"
        >
          {/* The band's own label, on a rail to the left so the four phases
              read as a spine down the page rather than as four headings. */}
          <div className="flex items-center gap-3 lg:items-start lg:pt-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--h-${band.hue})` }}
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-text">
              {band.name}
            </span>
            <span className="text-[13px] font-semibold text-text-faint">
              {band.modules.length}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {band.modules.map((m, i) => (
              <ModuleCard key={m.name} mod={m} hue={band.hue} to={band.to} step={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
