// A project's type, chosen at creation. It's a light label that tailors which
// module cards surface on the hub (e.g. the AI pipeline only shows for AI
// video), never a hard wall. Stored as free text on projects.project_type so
// the set can grow without an enum migration.

import type { ProjectStatus } from "@/lib/database.types";

export type ProjectTypeKey =
  | "general"
  | "live_action"
  | "commercial"
  | "ai_video"
  | "cgi_vfx";

export type ProjectTypeDef = {
  key: ProjectTypeKey;
  label: string;
  blurb: string;
  hue: string;
  // Icon path drawn inside a 24x24 stroke svg.
  icon: string;
};

export const PROJECT_TYPES: ProjectTypeDef[] = [
  {
    key: "general",
    label: "General",
    blurb: "Any job. All modules available.",
    hue: "indigo",
    icon: "M3 7h18M3 12h18M3 17h18",
  },
  {
    key: "live_action",
    label: "Live action shoot",
    blurb: "Filmed on-set. Crew, call sheets, gear.",
    hue: "blue",
    icon: "M23 7l-7 5 7 5V7zM1 5h15v14H1z",
  },
  {
    key: "commercial",
    label: "Commercial shoot",
    blurb: "Brand spot. Boards, shot list, delivery.",
    hue: "pink",
    icon: "M2 3h20v14H2zM8 21h8M12 17v4",
  },
  {
    key: "ai_video",
    label: "AI video",
    blurb: "Generated. Script to images to video.",
    hue: "purple",
    icon: "M4 4h16v16H4zM4 9h16M9 4v16",
  },
  {
    key: "cgi_vfx",
    label: "CGI / VFX video",
    blurb: "3D & effects. Assets, review, delivery.",
    hue: "cyan",
    icon: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
];

// Per-type lifecycle stage names. The four underlying phases stay the same
// (pre_pro -> shoot -> post -> delivered), but generated types have no shoot
// day, so the middle phase (and the planning phase) are renamed. Anything not
// overridden falls back to the default label.
const DEFAULT_STAGE_LABELS: Record<ProjectStatus, string> = {
  pre_pro: "Pre-pro",
  shoot: "Shoot",
  post: "Post",
  delivered: "Delivered",
};

const STAGE_LABELS: Partial<
  Record<ProjectTypeKey, Partial<Record<ProjectStatus, string>>>
> = {
  ai_video: { pre_pro: "Concept", shoot: "Generation" },
  cgi_vfx: { pre_pro: "Concept", shoot: "Production" },
};

export function stageLabel(
  status: ProjectStatus,
  type: string | null | undefined
): string {
  const key = type as ProjectTypeKey;
  return STAGE_LABELS[key]?.[status] ?? DEFAULT_STAGE_LABELS[status];
}

// Generated projects (AI, CGI/VFX) have no physical shoot day, so the
// "shoot date" surfaces are relabelled to a neutral production target.
export function hasShootDay(type: string | null | undefined): boolean {
  return type !== "ai_video" && type !== "cgi_vfx";
}

const BY_KEY = new Map(PROJECT_TYPES.map((t) => [t.key, t]));

export function isProjectType(v: string | null | undefined): v is ProjectTypeKey {
  return v != null && BY_KEY.has(v as ProjectTypeKey);
}

export function projectType(v: string | null | undefined): ProjectTypeDef {
  return (v && BY_KEY.get(v as ProjectTypeKey)) || PROJECT_TYPES[0];
}
