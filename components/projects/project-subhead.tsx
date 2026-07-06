import Link from "next/link";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";

// Consistent header for a project's focused module pages (Brief, Assets,
// Communication): a back link to the hub plus the section title, with a quiet
// per-phase hue accent so the module keeps its identity.
export function ProjectSubhead({
  projectId,
  projectTitle,
  section,
  hue,
}: {
  projectId: string;
  projectTitle: string;
  section: string;
  hue: string;
}) {
  return (
    <div className="mb-6">
      <Link
        href={`/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> {projectTitle}
      </Link>
      <div className="flex items-center gap-2.5">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: `var(--h-${hue})` }}
        />
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">
          {section}
        </h1>
      </div>
    </div>
  );
}
