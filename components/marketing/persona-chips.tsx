import { PROJECT_TYPES, type ProjectTypeKey } from "@/lib/project-types";

/**
 * "Is this for me?", answered in the second before the visitor decides to
 * scroll. Monday runs department chips here (Marketing, Operations, IT); ours
 * are production types, because that is how this audience describes a job.
 *
 * The labels come from PROJECT_TYPES rather than being retyped, so the site and
 * the product's own new-project wizard can never disagree about what kinds of
 * work this is for. "General" is skipped: it means "unspecified", which says
 * nothing to someone deciding whether the tool fits them.
 *
 * STATIC BY DESIGN for now. They are rendered as plain spans, not buttons, and
 * carry no checkmark, because a check reads as a selected control and inviting
 * a click that does nothing is worse than not inviting it. One chip is
 * emphasized to establish the visual pattern. When these become functional
 * (swapping the hero visual per type), they become buttons and the check earns
 * its place.
 */
const SHOWN: ProjectTypeKey[] = [
  "commercial",
  "live_action",
  "ai_video",
  "cgi_vfx",
];

/** The one drawn in the accent. Commercial work is the core of the ICP. */
const EMPHASIZED: ProjectTypeKey = "commercial";

// Shorter than the product's wizard labels, which carry a trailing noun
// ("Commercial shoot") that reads as clutter in a row of four.
const SHORT: Partial<Record<ProjectTypeKey, string>> = {
  live_action: "Live action",
  commercial: "Commercial",
  cgi_vfx: "CGI and VFX",
};

export function PersonaChips({ className = "" }: { className?: string }) {
  const types = SHOWN.map(
    (key) => PROJECT_TYPES.find((t) => t.key === key)!
  ).filter(Boolean);

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      {types.map((t) => {
        const on = t.key === EMPHASIZED;
        return (
          <li
            key={t.key}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold ${
              on
                ? "bg-accent-soft text-accent"
                : "bg-surface-2 text-text-muted"
            }`}
          >
            {SHORT[t.key] ?? t.label}
          </li>
        );
      })}
    </ul>
  );
}
