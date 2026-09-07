import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { assetStorage, isResizable, signThumbs } from "@/lib/asset-storage";
import type { DayNight, IntExt, StripKind } from "@/lib/schedule-time";

type Client = SupabaseClient<Database>;

export type ScheduleShot = {
  id: string;
  code: string | null;
  description: string | null;
  thumbUrl: string | null;
};

export type SchedulePerson = {
  contactId: string;
  name: string;
  /** Their position on the roster ("Gaffer", "Talent"). */
  position: string | null;
  role: "talent" | "crew";
};

export type ScheduleRowView = {
  id: string;
  dayId: string;
  position: number;
  kind: StripKind;
  title: string;
  location: string | null;
  set: string | null;
  intExt: IntExt | null;
  dayNight: DayNight | null;
  durationMin: number;
  anchoredAt: string | null;
  notes: string | null;
  shots: ScheduleShot[];
  talent: SchedulePerson[];
  crew: SchedulePerson[];
};

export type ScheduleDayView = {
  id: string;
  projectId: string;
  dayNumber: number;
  date: string | null;
  callTime: string | null;
  wrapTarget: string | null;
  location: string | null;
  notes: string | null;
  rows: ScheduleRowView[];
};

/** A shot the picker can offer, with which list it is on and where it already sits. */
export type ShotOption = {
  id: string;
  code: string | null;
  description: string | null;
  list: string;
  thumbUrl: string | null;
  /** The row it is already scheduled on, if any. The picker says so. */
  rowId: string | null;
};

export type RosterOption = {
  contactId: string;
  name: string;
  position: string | null;
  /** The roster category: crew | talent | extras | client | vendor. */
  category: string | null;
};

const KINDS: StripKind[] = ["call", "meal", "setup", "shot", "move", "note", "wrap"];
const kindOf = (v: string): StripKind => (KINDS.includes(v as StripKind) ? (v as StripKind) : "note");

/**
 * The whole schedule for a project: days, their rows, and each row's shots
 * (with thumbnails) and people. Four queries total rather than one per row,
 * grouped in memory, the same shape loadTaskExtras uses.
 */
export async function loadSchedule(supabase: Client, projectId: string): Promise<ScheduleDayView[]> {
  const { data: days } = await supabase
    .from("schedule_days")
    .select("*")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });
  if (!days?.length) return [];

  const dayIds = days.map((d) => d.id);
  const { data: rows } = await supabase
    .from("schedule_rows")
    .select("*")
    .in("day_id", dayIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const rowIds = (rows ?? []).map((r) => r.id);

  const [{ data: shotLinks }, { data: peopleLinks }] = rowIds.length
    ? await Promise.all([
        supabase
          .from("schedule_row_shots")
          .select("row_id, position, shot:shot_cards(id, code, description, storage_path, mime_type)")
          .in("row_id", rowIds)
          .order("position", { ascending: true }),
        supabase
          .from("schedule_row_people")
          .select("row_id, role, contact:contacts(id, name, role)")
          .in("row_id", rowIds),
      ])
    : [{ data: [] }, { data: [] }];

  // Thumbnails for every shot on the schedule in one signing call.
  type ShotRow = { id: string; code: string | null; description: string | null; storage_path: string | null; mime_type: string | null };
  const shotRows = (shotLinks ?? [])
    .map((l) => l.shot as unknown as ShotRow | null)
    .filter((s): s is ShotRow => Boolean(s));
  const thumbs = await signThumbs(
    shotRows.filter((s) => s.storage_path && isResizable(s.mime_type)).map((s) => s.storage_path as string)
  );

  const shotsByRow = new Map<string, ScheduleShot[]>();
  for (const l of shotLinks ?? []) {
    const sh = l.shot as unknown as ShotRow | null;
    if (!sh) continue;
    const list = shotsByRow.get(l.row_id) ?? [];
    list.push({
      id: sh.id,
      code: sh.code,
      description: sh.description,
      thumbUrl: sh.storage_path ? thumbs.get(sh.storage_path) ?? null : null,
    });
    shotsByRow.set(l.row_id, list);
  }

  type ContactRow = { id: string; name: string; role: string | null };
  const peopleByRow = new Map<string, SchedulePerson[]>();
  for (const l of peopleLinks ?? []) {
    const c = l.contact as unknown as ContactRow | null;
    if (!c) continue;
    const list = peopleByRow.get(l.row_id) ?? [];
    list.push({
      contactId: c.id,
      name: c.name,
      position: c.role,
      role: l.role === "talent" ? "talent" : "crew",
    });
    peopleByRow.set(l.row_id, list);
  }

  const rowsByDay = new Map<string, ScheduleRowView[]>();
  for (const r of rows ?? []) {
    const people = peopleByRow.get(r.id) ?? [];
    const view: ScheduleRowView = {
      id: r.id,
      dayId: r.day_id,
      position: r.position,
      kind: kindOf(r.kind),
      title: r.title,
      location: r.location,
      set: r.set_name,
      intExt: r.int_ext === "INT" || r.int_ext === "EXT" ? r.int_ext : null,
      dayNight: r.day_night === "DAY" || r.day_night === "NIGHT" ? r.day_night : null,
      durationMin: r.duration_min,
      anchoredAt: r.anchored_at,
      notes: r.notes,
      shots: shotsByRow.get(r.id) ?? [],
      talent: people.filter((p) => p.role === "talent"),
      crew: people.filter((p) => p.role === "crew"),
    };
    const list = rowsByDay.get(r.day_id) ?? [];
    list.push(view);
    rowsByDay.set(r.day_id, list);
  }

  return days.map((d) => ({
    id: d.id,
    projectId: d.project_id,
    dayNumber: d.day_number,
    date: d.date,
    callTime: d.call_time,
    wrapTarget: d.wrap_target,
    location: d.location,
    notes: d.notes,
    rows: rowsByDay.get(d.id) ?? [],
  }));
}

/** Every shot on the project's shot lists, for the "Add shots" picker. */
export async function loadShotOptions(supabase: Client, projectId: string): Promise<ShotOption[]> {
  const { data: groups } = await supabase
    .from("shot_groups")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (!groups?.length) return [];
  const { data: cards } = await supabase
    .from("shot_cards")
    .select("id, group_id, position, code, description, storage_path, mime_type")
    .in("group_id", groups.map((g) => g.id))
    .order("position", { ascending: true });
  if (!cards?.length) return [];
  const { data: placed } = await supabase
    .from("schedule_row_shots")
    .select("row_id, shot_card_id")
    .in("shot_card_id", cards.map((c) => c.id));
  const placedBy = new Map((placed ?? []).map((p) => [p.shot_card_id, p.row_id]));
  const thumbs = await signThumbs(
    cards.filter((c) => c.storage_path && isResizable(c.mime_type)).map((c) => c.storage_path as string)
  );
  const listName = new Map(groups.map((g) => [g.id, g.title]));
  return cards.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    list: listName.get(c.group_id) ?? "",
    thumbUrl: c.storage_path ? thumbs.get(c.storage_path) ?? null : null,
    rowId: placedBy.get(c.id) ?? null,
  }));
}

/** The project roster, for the talent and crew pickers. */
export async function loadRosterOptions(supabase: Client, projectId: string): Promise<RosterOption[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, name, role, type")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  return (data ?? []).map((c) => ({ contactId: c.id, name: c.name, position: c.role, category: c.type }));
}

// assetStorage is imported so a future direct-signing need does not re-derive
// the bucket accessor; signThumbs is what every read here actually uses.
void assetStorage;
