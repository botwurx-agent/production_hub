import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logWrite, reportError } from "@/lib/log";
import { cleanDayLabel, dayKind, nameDays, shotDayValue } from "@/lib/schedule-days";
import {
  MAX_BUILD_ROWS,
  cleanBuildOptions,
  planSchedule,
  planTotals,
  mergeDayOrder,
  type BuildList,
  type BuildOptions,
  type ExistingDay,
} from "@/lib/schedule-build";

/**
 * The write half of the schedule: building a draft from the shot list, and
 * keeping shot_cards.day in step with the days.
 *
 * Moved out of schedule-actions.ts so the schedule page's button and the AI
 * connector's build_schedule tool run ONE implementation and cannot drift.
 * It takes the client it is handed and never asks who is signed in, which is
 * what lets the connector call it with the owner's borrowed RLS client; each
 * caller does its own access check first.
 */

// ---------------------------------------------------------------------------
// The schedule owns shot_cards.day
// ---------------------------------------------------------------------------

export type Client = ReturnType<typeof createClient>;

export async function shotIdsOnDay(supabase: Client, dayId: string): Promise<string[]> {
  const { data: rows } = await supabase.from("schedule_rows").select("id").eq("day_id", dayId);
  const rowIds = (rows ?? []).map((r) => r.id);
  if (!rowIds.length) return [];
  const { data: links } = await supabase.from("schedule_row_shots").select("shot_card_id").in("row_id", rowIds);
  return (links ?? []).map((l) => l.shot_card_id);
}

/**
 * Every day of a project in schedule order, as much of each as naming needs.
 *
 * shot_cards.day carries the CREW-FACING number, which counts shoot days only,
 * so it cannot be read off one day in isolation: with a prelight first, the
 * first shoot day is "1" and its position is 2. That is the bug this whole
 * change exists to fix, so both sync paths go through here.
 */
export async function orderedDays(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("schedule_days")
    .select("id, kind, label")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });
  return data ?? [];
}

/** Write this row's day, as the crew says it, onto every shot it carries. */
export async function syncShotDays(supabase: Client, rowId: string): Promise<void> {
  // A row carries no project_id: it reaches the project through its day, which
  // is why the embed is here rather than a second round trip.
  const { data: row } = await supabase
    .from("schedule_rows")
    .select("day_id, day:schedule_days(project_id)")
    .eq("id", rowId)
    .maybeSingle();
  const projectId = (row?.day as unknown as { project_id: string } | null)?.project_id;
  if (!row?.day_id || !projectId) return;
  const { data: links } = await supabase.from("schedule_row_shots").select("shot_card_id").eq("row_id", rowId);
  const ids = (links ?? []).map((l) => l.shot_card_id);
  if (!ids.length) return;
  const value = shotDayValue(await orderedDays(supabase, projectId), row.day_id);
  if (!value) return;
  await logWrite("syncShotDays", supabase.from("shot_cards").update({ day: value }).in("id", ids));
}

/** After a renumber or a kind change, every scheduled shot is rewritten. */
export async function syncShotDaysForProject(supabase: Client, projectId: string): Promise<void> {
  const days = await orderedDays(supabase, projectId);
  for (const d of days) {
    const ids = await shotIdsOnDay(supabase, d.id);
    if (!ids.length) continue;
    const value = shotDayValue(days, d.id);
    if (!value) continue;
    await logWrite("syncShotDaysForProject", supabase.from("shot_cards").update({ day: value }).in("id", ids));
  }
}

// ---------------------------------------------------------------------------
// Build a draft from the shot list
// ---------------------------------------------------------------------------

export type BuildResult = { days: number; newDays: number; rows: number; shots: number; skipped: number } | { error: string };

/**
 * Turn the shot list into a first draft of the schedule.
 *
 * The operator ran a real three-day job through the schedule and it came to 56
 * rows typed by hand. Half of them were setup rows in a strict setup / shot
 * alternation and the rest was the day scaffold, none of which is a judgement
 * call. lib/schedule-build.ts holds the planning (pure, unit tested, and run by
 * the dialog too so its preview is the real thing); this writes it.
 *
 * IT ONLY EVER ADDS. A shot already on the schedule is skipped, and a planned
 * day that matches one the schedule already has JOINS it (its rows go in before
 * that day's wrap) rather than creating a second Day 1. So a first run builds
 * the whole thing, a re-run after new shots are added to the list drops them
 * onto the right days, and a re-run with nothing new says so and writes nothing.
 * There is no replace mode and there should not be one: this page has no undo.
 *
 * THE BROWSER SENDS OPTIONS, NOT ROWS. Which lists and how long a setup takes
 * come off the form; what gets written is re-derived here from the project's own
 * shot lists and days, so a hand-posted payload cannot plant rows on another
 * studio's day or schedule a shot this project does not own.
 */
export type BuildInput = {
  listIds: string[];
  options?: Partial<BuildOptions>;
  startDate?: string | null;
  location?: string | null;
  prelight?: boolean;
};

export async function writeScheduleBuild(
  supabase: Client,
  projectId: string,
  userId: string,
  input: BuildInput
): Promise<BuildResult> {

  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  // ---- what there is to schedule ------------------------------------------
  const { data: groups } = await supabase
    .from("shot_groups")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (!groups?.length) return { error: "There is no shot list to build from yet." };

  const wanted = new Set(input.listIds ?? []);
  const chosen = groups.filter((g) => wanted.has(g.id));
  if (!chosen.length) return { error: "Pick at least one shot list." };

  const { data: cards } = await supabase
    .from("shot_cards")
    .select("id, group_id, position, code, description, day")
    .in("group_id", chosen.map((g) => g.id))
    .order("position", { ascending: true });
  if (!cards?.length) return { error: "Those shot lists have no shots on them yet." };

  // A shot is on ONE row, so anything already placed is left where it is.
  const { data: placed } = await supabase
    .from("schedule_row_shots")
    .select("shot_card_id")
    .in("shot_card_id", cards.map((c) => c.id));
  const taken = new Set((placed ?? []).map((p) => p.shot_card_id));

  const lists: BuildList[] = chosen.map((g) => ({
    id: g.id,
    title: g.title,
    shots: cards
      .filter((c) => c.group_id === g.id && !taken.has(c.id))
      .map((c) => ({ id: c.id, code: c.code, description: c.description, day: c.day })),
  }));

  // ---- the days the schedule already has ----------------------------------
  const { data: oldDays } = await supabase
    .from("schedule_days")
    .select("id, day_number, kind, label")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });

  const named = nameDays((oldDays ?? []).map((d) => ({ id: d.id, kind: d.kind, label: d.label })));
  const { data: oldRows } = (oldDays ?? []).length
    ? await supabase
        .from("schedule_rows")
        .select("id, day_id, position, kind")
        .in("day_id", (oldDays ?? []).map((d) => d.id))
        .order("position", { ascending: true })
    : { data: [] as { id: string; day_id: string; position: number; kind: string }[] };

  const rowsOfDay = new Map<string, { position: number; kind: string }[]>();
  for (const r of oldRows ?? []) {
    const list = rowsOfDay.get(r.day_id) ?? [];
    list.push({ position: r.position, kind: r.kind });
    rowsOfDay.set(r.day_id, list);
  }
  const existing: ExistingDay[] = named.map((d) => ({
    id: d.id,
    kind: d.kind,
    name: d.name,
    shootNo: d.shootNo,
    hasRows: (rowsOfDay.get(d.id) ?? []).length > 0,
  }));

  const options = cleanBuildOptions(input.options);
  const plan = planSchedule(lists, options, {
    prelight: Boolean(input.prelight),
    startDate: input.startDate ?? null,
    existing,
  });
  if (!plan.days.length) {
    return plan.skipped
      ? { error: `Every shot with a day on it is already scheduled. ${plan.skipped} ${plan.skipped === 1 ? "shot has" : "shots have"} no day set on the shot list.` }
      : { error: "Every shot on those lists is already on the schedule." };
  }
  const totals = planTotals(plan);
  if (totals.rows > MAX_BUILD_ROWS) {
    return { error: `That would be ${totals.rows} rows. Build one list at a time, or give the shots more minutes.` };
  }

  // ---- days ---------------------------------------------------------------
  const fresh = plan.days.filter((d) => !d.existingDayId);
  const dayIdOfPlan = new Map<number, string>();

  if (fresh.length) {
    // Where each new day belongs among the days already there. A prelight added
    // on a second run has to land BEFORE Day 1, and appending would put it
    // after Day 2 with no way to move it, since the editor cannot reorder days.
    const slots = mergeDayOrder(existing, fresh.map((d) => ({ kind: d.kind, shootNo: d.shootNo })));

    // Every existing day is parked on a number nothing will claim before the
    // final numbers are written, because (project_id, day_number) is unique and
    // an in-place renumber would collide with a day it has not moved yet.
    const parked = new Map<string, number>();
    for (const [i, d] of (oldDays ?? []).entries()) {
      const temp = 10000 + i;
      parked.set(d.id, temp);
      const { error } = await supabase.from("schedule_days").update({ day_number: temp }).eq("id", d.id);
      if (error) {
        reportError("buildScheduleFromShotList/park", error);
        return { error: "Could not make room for the new days." };
      }
    }

    const numberOfFresh = new Map<number, number>();
    slots.forEach((slot, i) => {
      if (slot.freshIndex !== null) numberOfFresh.set(slot.freshIndex, i + 1);
    });

    const { data: madeDays, error: dayErr } = await supabase
      .from("schedule_days")
      .insert(
        fresh.map((d, i) => ({
          studio_id: project.studio_id,
          project_id: projectId,
          day_number: numberOfFresh.get(i) ?? 10100 + i,
          kind: dayKind(d.kind),
          label: cleanDayLabel(d.label),
          date: d.date,
          call_time: options.callTime,
          wrap_target: options.wrapTarget,
          location: input.location?.trim() || null,
          created_by: userId,
        }))
      )
      .select("id, day_number");
    if (dayErr || !madeDays?.length) {
      reportError("buildScheduleFromShotList/days", dayErr);
      // Put the existing days back where they were before giving up.
      for (const [i, d] of (oldDays ?? []).entries()) {
        await logWrite("buildScheduleFromShotList/unpark", supabase.from("schedule_days").update({ day_number: i + 1 }).eq("id", d.id));
      }
      return { error: "Could not add the days." };
    }

    // Matched back on day_number, which is unique per project and chosen here.
    // A bulk insert returns insert order in practice and does not promise to,
    // and guessing wrong would file one day's rows on another day.
    const byNumber = new Map(madeDays.map((d) => [d.day_number, d.id]));
    fresh.forEach((d, i) => {
      const id = byNumber.get(numberOfFresh.get(i) ?? 10100 + i);
      if (id) dayIdOfPlan.set(plan.days.indexOf(d), id);
    });

    // The parked days take their final places.
    for (const [i, slot] of slots.entries()) {
      if (!slot.existingId) continue;
      if (parked.get(slot.existingId) === i + 1) continue;
      await logWrite(
        "buildScheduleFromShotList/renumber",
        supabase.from("schedule_days").update({ day_number: i + 1 }).eq("id", slot.existingId)
      );
    }
  }

  // ---- rows ---------------------------------------------------------------
  type NewRow = { studio_id: string; day_id: string; position: number; kind: string; title: string; duration_min: number; anchored_at: string | null; created_by: string };
  const newRows: NewRow[] = [];
  // Keyed by day_id and position, both of which this function chose, for the
  // same reason day_number is used above.
  const shotsAt = new Map<string, string[]>();
  const key = (dayId: string, position: number) => `${dayId}:${position}`;

  plan.days.forEach((d, i) => {
    const dayId = d.existingDayId ?? dayIdOfPlan.get(i);
    if (!dayId) return;

    // Where the rows go. A fresh day numbers from zero. Joining a day that
    // already ends with a wrap, they go BEFORE it, since nothing is scheduled
    // after wrap, which is the rule addScheduleRow already follows.
    const at = (n: number): number[] => {
      const rows = (rowsOfDay.get(dayId) ?? []).slice().sort((a, b) => a.position - b.position);
      if (!d.existingDayId || !rows.length) return Array.from({ length: n }, (_, k) => k);
      const last = rows[rows.length - 1];
      if (last.kind !== "wrap") {
        return Array.from({ length: n }, (_, k) => last.position + 1 + k);
      }
      const before = rows.length > 1 ? rows[rows.length - 2].position : last.position - 1;
      const step = (last.position - before) / (n + 1);
      return Array.from({ length: n }, (_, k) => before + step * (k + 1));
    };

    const positions = at(d.rows.length);
    d.rows.forEach((r, k) => {
      const position = positions[k];
      newRows.push({
        studio_id: project.studio_id,
        day_id: dayId,
        position,
        kind: r.kind,
        title: r.title,
        duration_min: r.durationMin,
        anchored_at: r.anchoredAt,
        created_by: userId,
        // NO LOCATION on a generated row, deliberately. The day header states
        // it once and the printed document already suppresses a row location
        // that only repeats the day's. Stamping it on fifty rows would mean a
        // later correction to the day leaves fifty rows still saying the old
        // thing, which is the "Stege 2" mistake the hand-built schedule made,
        // manufactured at scale.
      });
      if (r.shotIds.length) shotsAt.set(key(dayId, position), r.shotIds);
    });
  });

  if (!newRows.length) return { error: "There was nothing to add." };

  const { data: madeRows, error: rowErr } = await supabase
    .from("schedule_rows")
    .insert(newRows)
    .select("id, day_id, position");
  if (rowErr || !madeRows?.length) {
    reportError("buildScheduleFromShotList/rows", rowErr);
    return { error: "The days were added but the rows were not. Try again on the days that are empty." };
  }

  const links: { studio_id: string; row_id: string; shot_card_id: string; position: number }[] = [];
  for (const r of madeRows) {
    const ids = shotsAt.get(key(r.day_id, r.position));
    if (!ids) continue;
    ids.forEach((shot_card_id, position) =>
      links.push({ studio_id: project.studio_id, row_id: r.id, shot_card_id, position })
    );
  }
  if (links.length) {
    const { error } = await supabase.from("schedule_row_shots").insert(links);
    if (error) {
      reportError("buildScheduleFromShotList/shots", error);
      return { error: "The schedule was built but the shots were not attached. Add them from each row." };
    }
  }

  // The schedule owns shot_cards.day, and the crew-facing number counts shoot
  // days only, so it is rewritten for the whole project rather than per day.
  await syncShotDaysForProject(supabase, projectId);
  return { ...totals, skipped: plan.skipped };
}
