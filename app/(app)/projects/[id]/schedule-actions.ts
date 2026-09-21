"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { parseHM, type StripKind } from "@/lib/schedule-time";
import { cleanDayLabel, dayKind, nameDays, shotDayValue, type DayKind } from "@/lib/schedule-days";
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
import type { Database } from "@/lib/database.types";

type DayUpdate = Database["public"]["Tables"]["schedule_days"]["Update"];
type RowUpdate = Database["public"]["Tables"]["schedule_rows"]["Update"];

type Result = { error: string } | null;

const KINDS: StripKind[] = ["call", "meal", "setup", "shot", "move", "note", "wrap"];

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
}

/** A typed clock time, kept as typed if it parses, refused if it does not. */
function clock(v: unknown): string | null | { error: string } {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return parseHM(s) === null ? { error: `"${s}" is not a time. Try 8:00 or 1:00 pm.` } : s;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export async function createScheduleDay(
  projectId: string,
  input?: { date?: string | null; callTime?: string | null; wrapTarget?: string | null; location?: string | null; kind?: DayKind; label?: string | null }
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: last } = await supabase
    .from("schedule_days")
    .select("day_number, call_time, wrap_target, location")
    .eq("project_id", projectId)
    .order("day_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const call = clock(input?.callTime);
  if (call && typeof call === "object") return call;
  const wrap = clock(input?.wrapTarget);
  if (wrap && typeof wrap === "object") return wrap;

  // A new day inherits the previous day's call, wrap and location, because
  // on a real job they usually repeat. The first day gets a common
  // commercial default rather than a blank, since a blank call makes the
  // whole day un-cascadable and the field is the first thing on the page.
  const { data, error } = await supabase
    .from("schedule_days")
    .insert({
      studio_id: project.studio_id,
      project_id: projectId,
      day_number: (last?.day_number ?? 0) + 1,
      // day_number is the ORDER. What the day IS lives in kind, and the
      // crew-facing number is derived from it (lib/schedule-days.ts).
      kind: dayKind(input?.kind),
      label: cleanDayLabel(input?.label),
      date: input?.date ?? null,
      call_time: call ?? last?.call_time ?? "7:00",
      wrap_target: wrap ?? last?.wrap_target ?? "6:00 pm",
      location: input?.location ?? last?.location ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    reportError("createScheduleDay", error);
    return { error: "Could not add a day." };
  }
  rp(projectId);
  return { id: data.id };
}

export async function updateScheduleDay(
  projectId: string,
  dayId: string,
  patch: { date?: string | null; callTime?: string | null; wrapTarget?: string | null; location?: string | null; notes?: string | null; kind?: DayKind; label?: string | null }
): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const update: DayUpdate = { updated_at: new Date().toISOString() };
  if ("date" in patch) update.date = patch.date || null;
  if ("callTime" in patch) { const v = clock(patch.callTime); if (v && typeof v === "object") return v; update.call_time = v; }
  if ("wrapTarget" in patch) { const v = clock(patch.wrapTarget); if (v && typeof v === "object") return v; update.wrap_target = v; }
  if ("location" in patch) update.location = patch.location?.trim() || null;
  if ("notes" in patch) update.notes = patch.notes?.trim() || null;
  if ("kind" in patch) update.kind = dayKind(patch.kind);
  if ("label" in patch) update.label = cleanDayLabel(patch.label);
  const { error } = await supabase.from("schedule_days").update(update).eq("id", dayId);
  if (error) {
    reportError("updateScheduleDay", error);
    return { error: "Could not save the day." };
  }
  // Turning a day into a prelight (or back) shifts every later shoot day's
  // number, and shot_cards.day is a STORED copy of it, so it is rewritten.
  if ("kind" in patch) await syncShotDaysForProject(supabase, projectId);
  rp(projectId);
  return null;
}

/**
 * Deleting a day takes its rows with it (FK cascade) and frees its shots:
 * their row_shots rows cascade too, so the shots go back to unscheduled.
 * shot_cards.day is cleared for them, since the schedule owns that field.
 */
export async function deleteScheduleDay(projectId: string, dayId: string): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const shotIds = await shotIdsOnDay(supabase, dayId);
  const { error } = await supabase.from("schedule_days").delete().eq("id", dayId);
  if (error) {
    reportError("deleteScheduleDay", error);
    return { error: "Could not delete the day." };
  }
  if (shotIds.length) {
    await logWrite("deleteScheduleDay/shot_cards", supabase.from("shot_cards").update({ day: null }).in("id", shotIds));
  }
  // Day numbers close up so a three-day job does not read Day 1, Day 3.
  const { data: rest } = await supabase
    .from("schedule_days")
    .select("id, day_number")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });
  let n = 1;
  for (const d of rest ?? []) {
    if (d.day_number !== n) {
      await logWrite("deleteScheduleDay/renumber", supabase.from("schedule_days").update({ day_number: n }).eq("id", d.id));
    }
    n++;
  }
  await syncShotDaysForProject(supabase, projectId);
  rp(projectId);
  return null;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type RowInput = {
  kind?: StripKind;
  title?: string;
  location?: string | null;
  set?: string | null;
  intExt?: "INT" | "EXT" | null;
  dayNight?: "DAY" | "NIGHT" | null;
  durationMin?: number;
  anchoredAt?: string | null;
  notes?: string | null;
};

function rowPatch(input: RowInput): RowUpdate | { error: string } {
  const out: RowUpdate = {};
  if (input.kind !== undefined) {
    if (!KINDS.includes(input.kind)) return { error: "Unknown row kind." };
    out.kind = input.kind;
  }
  if (input.title !== undefined) out.title = input.title.trim().slice(0, 200);
  if (input.location !== undefined) out.location = input.location?.trim().slice(0, 200) || null;
  if (input.set !== undefined) out.set_name = input.set?.trim().slice(0, 200) || null;
  if (input.intExt !== undefined) out.int_ext = input.intExt === "INT" || input.intExt === "EXT" ? input.intExt : null;
  if (input.dayNight !== undefined) out.day_night = input.dayNight === "DAY" || input.dayNight === "NIGHT" ? input.dayNight : null;
  if (input.durationMin !== undefined) {
    const d = Math.round(Number(input.durationMin));
    if (!Number.isFinite(d) || d < 0 || d > 24 * 60) return { error: "Duration must be between 0 and 24 hours." };
    out.duration_min = d;
  }
  if (input.anchoredAt !== undefined) {
    const v = clock(input.anchoredAt);
    if (v && typeof v === "object") return v;
    out.anchored_at = v;
  }
  if (input.notes !== undefined) out.notes = input.notes?.trim().slice(0, 2000) || null;
  return out;
}

export async function addScheduleRow(
  projectId: string,
  dayId: string,
  input: RowInput,
  /** Insert at this position; omitted appends. */
  position?: number
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const patch = rowPatch(input);
  if ("error" in patch) return patch as { error: string };

  const { data: day } = await supabase.from("schedule_days").select("id, studio_id").eq("id", dayId).maybeSingle();
  if (!day) return { error: "Day not found." };

  let pos = position;
  if (pos === undefined) {
    const { data: last } = await supabase
      .from("schedule_rows")
      .select("position, kind")
      .eq("day_id", dayId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    // A new row goes at the end, but BEFORE the wrap if the day has one, since
    // nothing is scheduled after wrap.
    pos = (last?.position ?? -1) + 1;
    if (last?.kind === "wrap") {
      const { data: prev } = await supabase
        .from("schedule_rows")
        .select("position")
        .eq("day_id", dayId)
        .lt("position", last.position)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      pos = prev ? (prev.position + last.position) / 2 : last.position - 1;
    }
  }

  const { data, error } = await supabase
    .from("schedule_rows")
    .insert({ studio_id: day.studio_id, day_id: dayId, position: pos, created_by: ctx.userId, ...patch })
    .select("id")
    .single();
  if (error || !data) {
    reportError("addScheduleRow", error);
    return { error: "Could not add the row." };
  }
  rp(projectId);
  return { id: data.id };
}

export async function updateScheduleRow(projectId: string, rowId: string, input: RowInput): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const patch = rowPatch(input);
  if ("error" in patch) return patch as { error: string };
  const { error } = await supabase
    .from("schedule_rows")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) {
    reportError("updateScheduleRow", error);
    return { error: "Could not save the row." };
  }
  rp(projectId);
  return null;
}

export async function deleteScheduleRow(projectId: string, rowId: string): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: links } = await supabase.from("schedule_row_shots").select("shot_card_id").eq("row_id", rowId);
  const { error } = await supabase.from("schedule_rows").delete().eq("id", rowId);
  if (error) {
    reportError("deleteScheduleRow", error);
    return { error: "Could not delete the row." };
  }
  const shotIds = (links ?? []).map((l) => l.shot_card_id);
  if (shotIds.length) {
    await logWrite("deleteScheduleRow/shot_cards", supabase.from("shot_cards").update({ day: null }).in("id", shotIds));
  }
  rp(projectId);
  return null;
}

/**
 * Move a row: within its day, or onto another day. One update, since the
 * client computed the midpoint position. If the day changed, the shots on the
 * row follow it, and shot_cards.day is rewritten from the new day.
 */
export async function moveScheduleRow(projectId: string, rowId: string, toDayId: string, position: number): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  if (!Number.isFinite(position)) return { error: "Bad position." };
  const { error } = await supabase
    .from("schedule_rows")
    .update({ day_id: toDayId, position, updated_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) {
    reportError("moveScheduleRow", error);
    return { error: "Could not move the row." };
  }
  await syncShotDays(supabase, rowId);
  rp(projectId);
  return null;
}

/**
 * Set which shots a row covers. A shot is on ONE row (unique on the shot), so
 * any of these already on another row is taken off it first rather than
 * failing the whole save on the constraint. Then shot_cards.day is written
 * from this row's day: the schedule owns that field.
 */
export async function setRowShots(projectId: string, rowId: string, shotCardIds: string[]): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: row } = await supabase.from("schedule_rows").select("id, studio_id").eq("id", rowId).maybeSingle();
  if (!row) return { error: "Row not found." };
  const ids = Array.from(new Set(shotCardIds)).slice(0, 60);

  const { error: clearErr } = await supabase.from("schedule_row_shots").delete().eq("row_id", rowId);
  if (clearErr) {
    reportError("setRowShots/clear", clearErr);
    return { error: "Could not update the shots." };
  }
  if (ids.length) {
    // Pull them off any other row first.
    await logWrite("setRowShots/steal", supabase.from("schedule_row_shots").delete().in("shot_card_id", ids));
    const { error } = await supabase.from("schedule_row_shots").insert(
      ids.map((shot_card_id, i) => ({ studio_id: row.studio_id, row_id: rowId, shot_card_id, position: i }))
    );
    if (error) {
      reportError("setRowShots/insert", error);
      return { error: "Could not update the shots." };
    }
  }
  await syncShotDays(supabase, rowId);
  rp(projectId);
  revalidatePath(`/projects/${projectId}/shot-list`);
  return null;
}

export async function setRowPeople(
  projectId: string,
  rowId: string,
  people: { contactId: string; role: "talent" | "crew" }[]
): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: row } = await supabase.from("schedule_rows").select("id, studio_id").eq("id", rowId).maybeSingle();
  if (!row) return { error: "Row not found." };
  const seen = new Set<string>();
  const clean = people.filter((p) => (p.role === "talent" || p.role === "crew") && !seen.has(p.contactId) && seen.add(p.contactId)).slice(0, 100);

  const { error: clearErr } = await supabase.from("schedule_row_people").delete().eq("row_id", rowId);
  if (clearErr) {
    reportError("setRowPeople/clear", clearErr);
    return { error: "Could not update the people." };
  }
  if (clean.length) {
    const { error } = await supabase.from("schedule_row_people").insert(
      clean.map((p) => ({ studio_id: row.studio_id, row_id: rowId, contact_id: p.contactId, role: p.role }))
    );
    if (error) {
      reportError("setRowPeople/insert", error);
      return { error: "Could not update the people." };
    }
  }
  rp(projectId);
  return null;
}

// ---------------------------------------------------------------------------
// The schedule owns shot_cards.day
// ---------------------------------------------------------------------------

type Client = ReturnType<typeof createClient>;

async function shotIdsOnDay(supabase: Client, dayId: string): Promise<string[]> {
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
async function orderedDays(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("schedule_days")
    .select("id, kind, label")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });
  return data ?? [];
}

/** Write this row's day, as the crew says it, onto every shot it carries. */
async function syncShotDays(supabase: Client, rowId: string): Promise<void> {
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
async function syncShotDaysForProject(supabase: Client, projectId: string): Promise<void> {
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
export async function buildScheduleFromShotList(
  projectId: string,
  input: {
    listIds: string[];
    options?: Partial<BuildOptions>;
    startDate?: string | null;
    location?: string | null;
    prelight?: boolean;
  }
): Promise<BuildResult> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

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
          created_by: ctx.userId,
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
        created_by: ctx.userId,
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
  rp(projectId);
  revalidatePath(`/projects/${projectId}/shot-list`);
  return { ...totals, skipped: plan.skipped };
}
