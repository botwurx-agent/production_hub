/**
 * Every module in a project, as two bands that drift past each other.
 *
 * DRAWN, NOT PHOTOGRAPHED. The hub is the tallest page in the app, so every
 * screenshot of it cut something off, and a crop of "here is everything in one
 * place" argues against itself. Rebuilt in the site's own tokens it fits any
 * width, stays sharp, reflows on a phone, and can move.
 *
 * The honesty rule that keeps this from being marketing invention: these are
 * the twenty-one module cards a project hub actually carries, with the phase
 * each one belongs to printed on it. The six screenshots elsewhere on the page
 * carry the burden of proof; this one carries the scope.
 *
 * THE SET IS DELIBERATELY THE FULL TWENTY-ONE, not the nineteen a live-action
 * job shows. AI Pipeline and Elements are hidden on a non-generated project and
 * Call sheet, Gear and Props are hidden on a generated one, so no single job
 * displays all of these at once. The claim being made here is what the PRODUCT
 * holds, not what one project shows, and both halves are real.
 */

type Module = { name: string; note: string; band: string; from: string; to: string; icon: string };

// Paths are drawn in a 20x20 box, stroked not filled, matching the icon
// language the rest of the site uses.
//
// Gradients are picked for variety within a family rather than one hue per
// phase: the phase is printed on the card, so colour does not have to carry it
// and can do the job the reference does, which is make a long band of cards
// worth looking at.
const ROW_A: Module[] = [
  { band: "Plan", name: "Brief", note: "The creative direction", from: "indigo", to: "blue",
    icon: "M5 3h7l3 3v11H5z M12 3v3h3 M7.5 10h5 M7.5 13h4" },
  { band: "Plan", name: "Assets", note: "Every file, versioned", from: "blue", to: "cyan",
    icon: "M3.5 5h13v10h-13z M6.5 12l2.5-3 2 2.5 1.5-1.5 3 3" },
  { band: "Visualize", name: "AI Pipeline", note: "Script to images to video", from: "purple", to: "indigo",
    icon: "M3 4.5h14v11H3z M3 8h14 M7.5 4.5v11 M12.5 12.5a2 2 0 100-4 2 2 0 000 4" },
  { band: "Visualize", name: "Elements", note: "Characters, looks, locations", from: "pink", to: "purple",
    icon: "M16 16.5v-1.2a2.6 2.6 0 00-2.6-2.6H6.6A2.6 2.6 0 004 15.3v1.2 M10 10.4a3 3 0 100-6 3 3 0 000 6" },
  { band: "Visualize", name: "Storyboards", note: "Frames in order", from: "indigo", to: "purple",
    icon: "M3 5h6v5H3z M11 5h6v5h-6z M3 12h6v3H3z M11 12h6v3h-6z" },
  { band: "Visualize", name: "Shot list", note: "Every setup on the day", from: "purple", to: "pink",
    icon: "M4 6h2.2v2.2H4z M8.5 7h7.5 M4 11.8h2.2V14H4z M8.5 12.8h7.5" },
  { band: "Visualize", name: "Moodboard", note: "References on a canvas", from: "pink", to: "orange",
    icon: "M3.5 6.5h7v7h-7z M8 4h8.5v7.5" },
  { band: "Review", name: "Approvals", note: "Pinned notes, a clear yes", from: "green", to: "cyan",
    icon: "M10 3a7 7 0 100 14 7 7 0 000-14z M7 10l2 2 4-4" },
  { band: "Review", name: "Communication", note: "Threads tied to the job", from: "cyan", to: "blue",
    icon: "M17 12a2 2 0 01-2 2H7l-3 3V5a2 2 0 012-2h9a2 2 0 012 2z" },
  { band: "Produce", name: "Tasks", note: "What this job still needs", from: "purple", to: "blue",
    icon: "M4 10.5l2.5 2.5L11 8 M16 5.5v9.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 15V5.5A1.5 1.5 0 015.5 4h7" },
  { band: "Produce", name: "Project contacts", note: "Crew, talent, vendors", from: "orange", to: "pink",
    icon: "M12.5 16v-1.4a2.8 2.8 0 00-2.8-2.8H6.3a2.8 2.8 0 00-2.8 2.8V16 M8 9.4a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2 M16.5 16v-1.4a2.8 2.8 0 00-2.1-2.7" },
];

const ROW_B: Module[] = [
  { band: "Produce", name: "Calendar", note: "Shoot days, milestones", from: "blue", to: "indigo",
    icon: "M4 5.5h12V16H4z M4 9h12 M7 3.5v3 M13 3.5v3" },
  { band: "Produce", name: "Call sheet", note: "Sent, viewed, confirmed", from: "green", to: "cyan",
    icon: "M7 4H5.5v12h9V4H13 M7.6 2.9h4.8v2.3H7.6z M8 9h4 M8 12h4" },
  { band: "Produce", name: "Gear & crew", note: "Kit and who is on it", from: "cyan", to: "green",
    icon: "M3.5 6.5h13v9h-13z M3.5 6.5 6 3.5h8l2.5 3 M7 10h6" },
  { band: "Produce", name: "Props", note: "Options, picks, approvals", from: "pink", to: "red",
    icon: "M3 8.5 10 5l7 3.5-7 3.5z M3 8.5v6L10 18l7-3.5v-6 M10 12v6" },
  { band: "Produce", name: "Budget", note: "Bid against actual", from: "indigo", to: "purple",
    icon: "M10 3.6v12.8 M12.9 6.6c-.5-.9-1.6-1.4-2.9-1.4-1.7 0-3 .9-3 2.1 0 2.9 6 1.6 6 4.5 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.6-3-1.5" },
  { band: "Produce", name: "Delivery & billing", note: "Final files, invoices", from: "amber", to: "orange",
    icon: "M3 7.4 10 4l7 3.4v6.2L10 17l-7-3.4z M3 7.4 10 10.8l7-3.4 M10 10.8V17" },
  { band: "Produce", name: "Client binder", note: "One link, only what they see", from: "blue", to: "cyan",
    icon: "M4 15.8A2 2 0 016 14h10 M6 3h10v14H6a2 2 0 01-2-2V5a2 2 0 012-2z" },
  { band: "Produce", name: "Agreements", note: "NDAs, SOWs, signatures", from: "purple", to: "pink",
    icon: "M5 3.5h7l3 3v10H5z M12 3.5v3h3 M7.4 13.2c1.4-1 1.9-2.4 2.9-2.4s1 1.5 2 1.5" },
  { band: "Produce", name: "Documents", note: "Permits, specs, insurance", from: "cyan", to: "blue",
    icon: "M3 6h4.6l1.5 2H17v8.5H3z M3 6V4.5h5" },
  { band: "Produce", name: "Estimates & invoices", note: "Estimate, proposal, invoice", from: "orange", to: "amber",
    icon: "M4 3.5h12v13H4z M7 7h6 M7 10h6 M7 13h3.5" },
];

function ModuleCard({ mod }: { mod: Module }) {
  return (
    <div
      className="flex h-[176px] w-[236px] shrink-0 flex-col justify-between rounded-[18px] p-4 shadow-lg sm:h-[192px] sm:w-[260px] sm:p-5"
      style={{
        background: `linear-gradient(140deg, var(--h-${mod.from}), var(--h-${mod.to}))`,
        color: "#fff",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 20 20" aria-hidden="true" className="opacity-95">
        <path
          d={mod.icon}
          stroke="currentColor"
          strokeWidth="1.35"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        {/* The phase, printed rather than encoded in the colour. With the rows
            drifting, a card can sit anywhere, so the grouping has to survive
            without relying on where it happens to be. */}
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
          {mod.band}
        </p>
        <p className="mt-1 font-display text-[17px] font-extrabold leading-tight">
          {mod.name}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug opacity-80">{mod.note}</p>
      </div>
    </div>
  );
}

function Row({ mods, className }: { mods: Module[]; className: string }) {
  return (
    <div className={`flex w-max gap-4 sm:gap-5 ${className}`}>
      {mods.map((m) => (
        <ModuleCard key={m.name} mod={m} />
      ))}
      {/* A second pass, so the band always overruns the viewport in both
          directions and drifting never walks an edge into view. Hidden from
          assistive tech: it is the same twenty-one modules said twice. */}
      {mods.map((m) => (
        <ModuleCard key={`${m.name}-repeat`} mod={m} />
      ))}
    </div>
  );
}

export function ModuleMap() {
  return (
    // Breaks out of the section's container to full width, and clips its own
    // overflow so a band wider than the screen can never add a scrollbar.
    //
    // `overflow-clip`, NOT `overflow-hidden`. Hidden would make this a SCROLL
    // CONTAINER, and the bands' view() timeline resolves against the nearest
    // one, which would measure each band against this box instead of the
    // viewport and pin it at a constant position. Exactly the bug that stopped
    // the product shots animating; clip creates no scroll container.
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-clip py-1">
      <div className="space-y-4 sm:space-y-5">
        <Row mods={ROW_A} className="sf-band sf-band-a" />
        <Row mods={ROW_B} className="sf-band sf-band-b" />
      </div>
    </div>
  );
}
