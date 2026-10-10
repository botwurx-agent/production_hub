import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { writeScheduleBuild } from "@/lib/schedule-build-write";
import { nameDays } from "@/lib/schedule-days";
import { cascade, fmtHM, overUnder, parseHM, type StripKind } from "@/lib/schedule-time";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * build_schedule: the schedule page's "Build from the shot list", over the
 * connector. It calls the SAME writeScheduleBuild the button calls, so the two
 * cannot plan a day differently, and it inherits every rule that function
 * holds: it only ever adds, a shot already on the schedule is skipped, a day
 * that already exists is joined rather than duplicated, and lunch is placed by
 * the clock.
 *
 * The button shows a preview before anything is written. A tool call cannot,
 * so the answer comes AFTER: each day's name, row count, wrap time and whether
 * it runs past its target, read back from what was written rather than from
 * the plan, so the report describes the schedule as it now is.
 */

const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: "number", description });

export const SCHEDULE_TOOL: McpTool = {
  name: "build_schedule",
  description:
    "Build the shooting schedule from a project's shot lists, the same way the schedule page's 'Build from the shot list' button does: a day for each shoot day on the shot list (by each shot's day value, or one day per list when no shot has a day), an opening setup, a setup before every shot, lunch at its time, and a wrap. Adds only: a shot already on the schedule is skipped and a day that already exists is added to, never replaced, so running it again after new shots are added just places the new ones. Every option is optional; leave out what the producer has not said. Tell the producer each day's wrap time from the result, and any day that runs over.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      shot_list_ids: {
        type: "array",
        items: { type: "string" },
        description: "Which shot lists to build from (table shot_groups). Leave out to use every shot list on the project.",
      },
      start_date: s("The first new day's date, YYYY-MM-DD. Later new days follow on consecutive dates."),
      location: s("Where new days shoot, stated once on each day rather than on every row."),
      prelight: { type: "boolean", description: "Add a prelight day before the shoot days." },
      call_time: s("Crew call, e.g. '7:00 am'. Default 7:00 am."),
      wrap_target: s("Target wrap, e.g. '6:00 pm'. Default 6:00 pm."),
      shot_minutes: n("Minutes per shot. Default 60."),
      setup_minutes: n("Minutes for each setup between shots. Default 15."),
      first_setup_minutes: n("Minutes for the first setup of the day. Default 60."),
      lunch_at: s("When lunch starts, e.g. '1:00 pm'. Default 1:00 pm. Use 'none' for no lunch row."),
      lunch_minutes: n("Length of lunch. Default 60."),
    },
    required: ["project_id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

type Json = Record<string, unknown>;

function realDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m[0] : null;
}

/** A clock the planner can read, or undefined (use the default). */
function clockArg(v: unknown): string | undefined {
  return typeof v === "string" && parseHM(v) !== null ? v.trim() : undefined;
}

export async function buildScheduleTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }

  const { data: groups } = await supabase
    .from("shot_groups")
    .select("id, title")
    .eq("project_id", project.id)
    .order("position", { ascending: true });
  if (!groups?.length) return { error: "This project has no shot list yet. Make one with create_shot_list." };
  const asked = Array.isArray(args.shot_list_ids)
    ? args.shot_list_ids.filter((x): x is string => typeof x === "string")
    : [];
  const listIds = asked.length ? groups.filter((g) => asked.includes(g.id)).map((g) => g.id) : groups.map((g) => g.id);
  if (!listIds.length) return { error: "None of those shot list ids belong to this project." };

  const notes: string[] = [];
  const startDate = realDate(args.start_date);
  if (args.start_date && !startDate) notes.push("The start date was not a real YYYY-MM-DD date, so new days have no date.");
  const lunchOff = typeof args.lunch_at === "string" && /^\s*(none|no|off)\s*$/i.test(args.lunch_at);
  const lunchAt = lunchOff ? "" : clockArg(args.lunch_at);
  if (args.lunch_at && !lunchOff && lunchAt === undefined) notes.push("The lunch time was not readable, so it was left at 1:00 pm.");

  const res = await writeScheduleBuild(supabase, project.id, owner.userId, {
    listIds,
    startDate,
    location: typeof args.location === "string" ? args.location.slice(0, 200) : null,
    prelight: args.prelight === true,
    options: {
      callTime: clockArg(args.call_time),
      wrapTarget: clockArg(args.wrap_target),
      shotMin: args.shot_minutes as number | undefined,
      setupMin: args.setup_minutes as number | undefined,
      openMin: args.first_setup_minutes as number | undefined,
      lunchAt,
      lunchMin: args.lunch_minutes as number | undefined,
    },
  });
  if ("error" in res) return { error: res.error, notes };

  return {
    built: {
      days_touched: res.days,
      new_days: res.newDays,
      rows_added: res.rows,
      shots_placed: res.shots,
    },
    left_off: res.skipped
      ? `${res.skipped} shot${res.skipped === 1 ? "" : "s"} had no day on a shot list that uses days, so ${res.skipped === 1 ? "it was" : "they were"} not scheduled. Set the day on the shot list and run this again.`
      : null,
    days: await daySummary(supabase, project.id),
    notes,
    open: `${siteOrigin()}/projects/${project.id}/schedule`,
  };
}

/** Each day as it now stands: its name, how many rows, and when it wraps. */
async function daySummary(supabase: ReturnType<typeof createClient>, projectId: string) {
  const { data: days } = await supabase
    .from("schedule_days")
    .select("id, kind, label, date, call_time, wrap_target")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });
  if (!days?.length) return [];
  const { data: rows } = await supabase
    .from("schedule_rows")
    .select("id, day_id, position, kind, duration_min, anchored_at")
    .in("day_id", days.map((d) => d.id))
    .order("position", { ascending: true });
  const names = nameDays(days.map((d) => ({ id: d.id, kind: d.kind, label: d.label })));
  return days.map((d, i) => {
    const strips = (rows ?? [])
      .filter((r) => r.day_id === d.id)
      .map((r) => ({ id: r.id, kind: r.kind as StripKind, durationMin: r.duration_min, anchoredAt: r.anchored_at }));
    const call = parseHM(d.call_time);
    const target = parseHM(d.wrap_target);
    const timed = call === null ? [] : cascade(strips, call);
    const end = timed.length ? timed[timed.length - 1].endMin : null;
    const ou = timed.length && target !== null ? overUnder(timed, target, call ?? undefined) : null;
    return {
      day: names[i]?.name ?? `Day ${i + 1}`,
      date: d.date,
      rows: strips.length,
      call: d.call_time,
      wraps_at: end === null ? null : fmtHM(end, { ampm: true }),
      wrap_target: d.wrap_target,
      over_by_minutes: ou && ou.deltaMin > 0 ? ou.deltaMin : 0,
    };
  });
}
