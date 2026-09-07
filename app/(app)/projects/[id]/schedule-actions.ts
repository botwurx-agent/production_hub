"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { parseHM, type StripKind } from "@/lib/schedule-time";
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
  input?: { date?: string | null; callTime?: string | null; wrapTarget?: string | null; location?: string | null }
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
  patch: { date?: string | null; callTime?: string | null; wrapTarget?: string | null; location?: string | null; notes?: string | null }
): Promise<Result> {
  await requireStudioContext();
  const supabase = createClient();
  const update: DayUpdate = { updated_at: new Date().toISOString() };
  if ("date" in patch) update.date = patch.date || null;
  if ("callTime" in patch) { const v = clock(patch.callTime); if (v && typeof v === "object") return v; update.call_time = v; }
  if ("wrapTarget" in patch) { const v = clock(patch.wrapTarget); if (v && typeof v === "object") return v; update.wrap_target = v; }
  if ("location" in patch) update.location = patch.location?.trim() || null;
  if ("notes" in patch) update.notes = patch.notes?.trim() || null;
  const { error } = await supabase.from("schedule_days").update(update).eq("id", dayId);
  if (error) {
    reportError("updateScheduleDay", error);
    return { error: "Could not save the day." };
  }
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

/** Write this row's day number onto every shot it carries. */
async function syncShotDays(supabase: Client, rowId: string): Promise<void> {
  const { data: row } = await supabase
    .from("schedule_rows")
    .select("day_id, day:schedule_days(day_number)")
    .eq("id", rowId)
    .maybeSingle();
  const dayNumber = (row?.day as unknown as { day_number: number } | null)?.day_number;
  if (!dayNumber) return;
  const { data: links } = await supabase.from("schedule_row_shots").select("shot_card_id").eq("row_id", rowId);
  const ids = (links ?? []).map((l) => l.shot_card_id);
  if (!ids.length) return;
  await logWrite("syncShotDays", supabase.from("shot_cards").update({ day: String(dayNumber) }).in("id", ids));
}

/** After a renumber, every scheduled shot on the project is rewritten. */
async function syncShotDaysForProject(supabase: Client, projectId: string): Promise<void> {
  const { data: days } = await supabase.from("schedule_days").select("id, day_number").eq("project_id", projectId);
  for (const d of days ?? []) {
    const ids = await shotIdsOnDay(supabase, d.id);
    if (ids.length) {
      await logWrite("syncShotDaysForProject", supabase.from("shot_cards").update({ day: String(d.day_number) }).in("id", ids));
    }
  }
}
