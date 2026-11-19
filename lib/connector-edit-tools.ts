import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { loadProjectPeople } from "@/lib/people-load";
import type { StudioContext } from "@/lib/studio";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";
import { inBatches, storeImage } from "@/lib/connector-write";
import { SHEET_TEXT_FIELDS } from "@/lib/connector-callsheet";
import { matchAssignee, taskPhaseOf, taskStatusOf } from "@/lib/connector-tasks";
import {
  changesOf,
  MAX_EDIT_PICTURES,
  MAX_EDITS,
  pictureLink,
  readPatch,
  readUpdates,
  sent,
  type Change,
  type FieldSpec,
} from "@/lib/connector-edit";

/**
 * The connector's EDIT tools: change what is already on a shot list, a
 * storyboard, a task board or a draft call sheet.
 *
 * Offered only on a link switched to "Can add and edit" (connector_tokens.
 * can_edit), and refused here again when it is not, since the list a host was
 * shown is not a permission.
 *
 * What these never do: delete a row, send anything, or touch something that
 * has gone out (a call sheet that is no longer a draft). Each one writes
 * through the owner's borrowed RLS client, so can_edit_project is still the
 * database's own check, and reports every field it changed with the value it
 * had before.
 */

type Json = Record<string, unknown>;
// `as never` on the updates below: every key comes from a FieldSpec list in
// this file (plus the picture and done_at columns set by hand), never from
// the assistant, so the cast is narrowing a whitelisted patch.
type Edited = { item: string; id: string; changes: Change[] };

const s = (description: string) => ({ type: "string", description });
const EDIT_NOTE =
  "Only the fields you send are changed; anything left out keeps its value. Send an empty string to clear a field. Read the rows first so you have each one's id and can tell the producer what it said before. The result lists every change with its old value: repeat that to the producer.";
const ANNOT = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

const uniq = <T,>(a: T[]) => Array.from(new Set(a));

function report(edited: Edited[], unchanged: number, skipped: string[], open: string | null, extra: Json = {}) {
  return {
    changed: edited,
    counts: { changed: edited.length, already_that_way: unchanged },
    ...extra,
    skipped,
    open,
  };
}

/* ------------------------------------------------------------- shot list */

const SHOT_FIELDS: FieldSpec[] = [
  { key: "code", label: "Shot number", max: 20, oneLine: true },
  { key: "description", label: "Description", max: 2000 },
  { key: "shot_size", label: "Shot size", max: 60, oneLine: true },
  { key: "shot_type", label: "Shot type", max: 60, oneLine: true },
  { key: "movement", label: "Camera movement", max: 60, oneLine: true },
  { key: "day", label: "Day", max: 30, oneLine: true },
  { key: "vo", label: "VO", max: 2000 },
];

export const UPDATE_SHOTS_TOOL: McpTool = {
  name: "update_shots",
  description: `Change shots that are already on a shot list. Up to ${MAX_EDITS} per call. ${EDIT_NOTE} Get the ids with query on shot_cards (filter group_id to the list). A shot's day cannot be changed here once the shot is on the shooting schedule; the schedule owns it.`,
  inputSchema: {
    type: "object",
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: s("The shot's id, from shot_cards."),
            code: s("Shot number, e.g. 1A."),
            description: s("What we see."),
            shot_size: s("e.g. Wide, Medium, Close-up."),
            shot_type: s("e.g. Establishing, Insert, Over the shoulder."),
            movement: s("e.g. Static, Push in, Handheld."),
            day: s("Which shoot day, e.g. 1 or Prelight."),
            vo: s("Voiceover or dialogue for the shot."),
            image_url: s("A public image link to REPLACE the shot's picture."),
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    required: ["updates"],
    additionalProperties: false,
  },
  annotations: ANNOT,
};

export async function updateShotsTool(owner: ConnectorOwner, args: Json) {
  const { updates, skipped } = readUpdates(args.updates, "Shot");
  if (!updates.length) return { error: "No usable shots to change.", skipped };
  const supabase = createClient();
  const ids = updates.map((u) => u.id);
  const { data: rows } = await supabase
    .from("shot_cards")
    .select("id, studio_id, group_id, code, description, shot_size, shot_type, movement, day, vo")
    .in("id", ids);
  const byId = new Map((rows ?? []).filter((r) => r.studio_id === owner.studioId).map((r) => [r.id, r]));

  const { data: scheduled } = await supabase.from("schedule_row_shots").select("shot_card_id").in("shot_card_id", ids);
  const onSchedule = new Set((scheduled ?? []).map((r) => r.shot_card_id));

  const groupIds = uniq(Array.from(byId.values()).map((r) => r.group_id));
  const { data: groups } = groupIds.length
    ? await supabase.from("shot_groups").select("id, project_id").in("id", groupIds)
    : { data: [] };
  const projectOf = new Map((groups ?? []).map((g) => [g.id, g.project_id]));

  let pictures = 0;
  const plans = updates.map((u) => {
    const row = byId.get(u.id);
    if (!row) {
      skipped.push(`No shot with id ${u.id} is visible here.`);
      return null;
    }
    const label = row.code ? `Shot ${row.code}` : "A shot with no number";
    const input = { ...u.input };
    if (sent(input, "day") && onSchedule.has(row.id)) {
      delete input.day;
      skipped.push(`${label}: it is on the shooting schedule, which sets its day. Move it on the schedule page.`);
    }
    const { patch, problems } = readPatch(input, SHOT_FIELDS);
    for (const p of problems) skipped.push(`${label}: ${p}`);
    const { write, changes } = changesOf(row, patch, SHOT_FIELDS);
    let imageUrl: string | null = null;
    if (sent(input, "image_url") && input.image_url) {
      imageUrl = pictureLink(input.image_url);
      if (!imageUrl) skipped.push(`${label}: the picture link is not a public http(s) link; picture left as it was.`);
      else if (pictures >= MAX_EDIT_PICTURES) {
        imageUrl = null;
        skipped.push(`${label}: over ${MAX_EDIT_PICTURES} pictures per call; send its picture again in another call.`);
      } else pictures++;
    }
    return { row, label, write, changes, imageUrl };
  });

  const live = plans.filter((p): p is NonNullable<typeof p> => !!p);
  const stored = await inBatches(live, 4, (p) =>
    p.imageUrl ? storeImage(owner.studioId, `shotlists/${p.row.group_id}`, p.imageUrl) : Promise.resolve(null)
  );

  const edited: Edited[] = [];
  let unchanged = 0;
  for (const [i, p] of live.entries()) {
    const st = stored[i];
    const write: Record<string, string | null> = { ...p.write };
    const changes = [...p.changes];
    if (p.imageUrl && st) {
      if (st.ok) {
        write.storage_path = st.path;
        write.mime_type = st.mime;
        write.image_name = st.name;
        write.asset_id = null;
        changes.push({ field: "Picture", before: "the earlier picture, if any", after: "replaced with the new one" });
      } else skipped.push(`${p.label}: picture not replaced (${st.reason}).`);
    }
    if (!Object.keys(write).length) {
      unchanged++;
      continue;
    }
    const { data: done, error } = await supabase.from("shot_cards").update(write as never).eq("id", p.row.id).select("id");
    if (error || !done?.length) {
      skipped.push(`${p.label}: could not be saved. You may not have edit access to this project.`);
      continue;
    }
    edited.push({ item: p.label, id: p.row.id, changes });
  }
  const project = live.length ? projectOf.get(live[0].row.group_id) : null;
  return report(edited, unchanged, skipped, project ? `${siteOrigin()}/projects/${project}/shot-list` : null);
}

/* ------------------------------------------------------------ storyboard */

const FRAME_FIELDS: FieldSpec[] = [
  { key: "scene", label: "Shot / scene", max: 200, oneLine: true },
  { key: "description", label: "Description", max: 2000 },
  { key: "sound", label: "Sound", max: 2000 },
  { key: "notes", label: "Video / motion", max: 2000 },
];

export const UPDATE_FRAMES_TOOL: McpTool = {
  name: "update_storyboard_frames",
  description: `Change frames that are already on a storyboard. Up to ${MAX_EDITS} per call. ${EDIT_NOTE} Get the ids with query on storyboard_frames (filter board_id).`,
  inputSchema: {
    type: "object",
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: s("The frame's id, from storyboard_frames."),
            scene: s("The frame's heading, e.g. '1B · The reveal'."),
            description: s("What we see in the frame."),
            sound: s("Sound, VO or dialogue."),
            notes: s("The Video / motion field: camera move and motion."),
            image_url: s("A public image link to REPLACE the frame's picture."),
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    required: ["updates"],
    additionalProperties: false,
  },
  annotations: ANNOT,
};

export async function updateFramesTool(owner: ConnectorOwner, args: Json) {
  const { updates, skipped } = readUpdates(args.updates, "Frame");
  if (!updates.length) return { error: "No usable frames to change.", skipped };
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("storyboard_frames")
    .select("id, studio_id, board_id, position, scene, description, sound, notes")
    .in(
      "id",
      updates.map((u) => u.id)
    );
  const byId = new Map((rows ?? []).filter((r) => r.studio_id === owner.studioId).map((r) => [r.id, r]));
  const boardIds = uniq(Array.from(byId.values()).map((r) => r.board_id));
  const { data: boards } = boardIds.length
    ? await supabase.from("boards").select("id, project_id, name").in("id", boardIds)
    : { data: [] };
  const boardOf = new Map((boards ?? []).map((b) => [b.id, b]));

  let pictures = 0;
  const plans = updates.map((u) => {
    const row = byId.get(u.id);
    if (!row) {
      skipped.push(`No frame with id ${u.id} is visible here.`);
      return null;
    }
    const label = `Frame ${row.position + 1}`;
    const { patch, problems } = readPatch(u.input, FRAME_FIELDS);
    for (const p of problems) skipped.push(`${label}: ${p}`);
    const { write, changes } = changesOf(row, patch, FRAME_FIELDS);
    let imageUrl: string | null = null;
    if (sent(u.input, "image_url") && u.input.image_url) {
      imageUrl = pictureLink(u.input.image_url);
      if (!imageUrl) skipped.push(`${label}: the picture link is not a public http(s) link; picture left as it was.`);
      else if (pictures >= MAX_EDIT_PICTURES) {
        imageUrl = null;
        skipped.push(`${label}: over ${MAX_EDIT_PICTURES} pictures per call; send its picture again in another call.`);
      } else pictures++;
    }
    return { row, label, write, changes, imageUrl };
  });
  const live = plans.filter((p): p is NonNullable<typeof p> => !!p);
  const stored = await inBatches(live, 4, (p) =>
    p.imageUrl ? storeImage(owner.studioId, `boards/${p.row.board_id}`, p.imageUrl) : Promise.resolve(null)
  );

  const edited: Edited[] = [];
  let unchanged = 0;
  for (const [i, p] of live.entries()) {
    const st = stored[i];
    const write: Record<string, string | null> = { ...p.write };
    const changes = [...p.changes];
    if (p.imageUrl && st) {
      if (st.ok) {
        write.storage_path = st.path;
        write.mime_type = st.mime;
        write.image_name = st.name;
        write.asset_id = null;
        changes.push({ field: "Picture", before: "the earlier picture, if any", after: "replaced with the new one" });
      } else skipped.push(`${p.label}: picture not replaced (${st.reason}).`);
    }
    if (!Object.keys(write).length) {
      unchanged++;
      continue;
    }
    const { data: done, error } = await supabase.from("storyboard_frames").update(write as never).eq("id", p.row.id).select("id");
    if (error || !done?.length) {
      skipped.push(`${p.label}: could not be saved. You may not have edit access to this project.`);
      continue;
    }
    edited.push({ item: p.label, id: p.row.id, changes });
  }
  const board = live.length ? boardOf.get(live[0].row.board_id) : null;
  const open = board
    ? board.project_id
      ? `${siteOrigin()}/projects/${board.project_id}/storyboards`
      : `${siteOrigin()}/boards`
    : null;
  return report(edited, unchanged, skipped, open, board ? { board: board.name } : {});
}

/* ----------------------------------------------------------------- tasks */

const TASK_FIELDS: FieldSpec[] = [
  { key: "title", label: "Title", max: 200, oneLine: true, required: true },
  { key: "notes", label: "Notes", max: 2000 },
  { key: "due_date", label: "Due date", max: 40, date: true },
  { key: "phase", label: "Phase", max: 40, map: taskPhaseOf },
  { key: "status", label: "Status", max: 40, required: true, map: taskStatusOf },
];

export const UPDATE_TASKS_TOOL: McpTool = {
  name: "update_tasks",
  description: `Change tasks that are already on a project's task board: retitle, move to another status or phase, set or clear the due date, change the notes, or change who it is on. Up to ${MAX_EDITS} per call. ${EDIT_NOTE} Get the ids with query on project_tasks (filter project_id). Marking a task finished is status "done".`,
  inputSchema: {
    type: "object",
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: s("The task's id, from project_tasks."),
            title: s("What has to be done."),
            notes: s("Detail for the card."),
            due_date: s("YYYY-MM-DD, or an empty string for no due date."),
            phase: s("pre_pro, shoot, post or delivered; 'anytime' or an empty string for none."),
            status: s("todo, doing, waiting or done."),
            assignees: {
              type: "array",
              items: { type: "string" },
              description:
                "Who it is on, REPLACING whoever is on it now: 'me', or a team member's email exactly. An empty list takes everybody off.",
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    required: ["updates"],
    additionalProperties: false,
  },
  annotations: ANNOT,
};

export async function updateTasksTool(owner: ConnectorOwner, args: Json) {
  const { updates, skipped } = readUpdates(args.updates, "Task");
  if (!updates.length) return { error: "No usable tasks to change.", skipped };
  const supabase = createClient();
  const ids = updates.map((u) => u.id);
  const { data: rows } = await supabase
    .from("project_tasks")
    .select("id, studio_id, project_id, title, notes, due_date, phase, status")
    .in("id", ids);
  const byId = new Map((rows ?? []).filter((r) => r.studio_id === owner.studioId).map((r) => [r.id, r]));

  // People are only read when somebody's assignees are being changed.
  const wantsPeople = updates.some((u) => Array.isArray(u.input.assignees) && byId.has(u.id));
  const peopleByProject = new Map<string, { userId: string; label: string }[]>();
  const current = new Map<string, string[]>();
  if (wantsPeople) {
    const { data: auth } = await supabase.auth.getUser();
    const ctx = {
      studio: { id: owner.studioId },
      userId: owner.userId,
      email: auth.user?.email ?? null,
    } as unknown as StudioContext;
    for (const pid of uniq(Array.from(byId.values()).map((r) => r.project_id))) {
      peopleByProject.set(pid, await loadProjectPeople(supabase, ctx, pid));
    }
    const { data: links } = await supabase.from("project_task_assignees").select("task_id, user_id").in("task_id", ids);
    for (const l of links ?? []) current.set(l.task_id, [...(current.get(l.task_id) ?? []), l.user_id]);
  }

  const edited: Edited[] = [];
  let unchanged = 0;
  let projectId: string | null = null;
  for (const u of updates) {
    const row = byId.get(u.id);
    if (!row) {
      skipped.push(`No task with id ${u.id} is visible here.`);
      continue;
    }
    projectId ??= row.project_id;
    const short = row.title.length > 40 ? `${row.title.slice(0, 40)}...` : row.title;
    const label = `"${short}"`;
    const { patch, problems } = readPatch(u.input, TASK_FIELDS);
    for (const p of problems) skipped.push(`${label}: ${p}`);
    const { write, changes } = changesOf(row, patch, TASK_FIELDS);
    const dbWrite: Record<string, string | null> = { ...write };
    // done_at is a plain column the board stamps; `done` itself is generated.
    if ("status" in write) dbWrite.done_at = write.status === "done" ? new Date().toISOString() : null;

    let saved = true;
    if (Object.keys(dbWrite).length) {
      const { data: done, error } = await supabase.from("project_tasks").update(dbWrite as never).eq("id", row.id).select("id");
      if (error || !done?.length) {
        skipped.push(`${label}: could not be saved.`);
        saved = false;
      }
    }

    const allChanges = saved ? [...changes] : [];
    if (saved && Array.isArray(u.input.assignees)) {
      const people = peopleByProject.get(row.project_id) ?? [];
      const nameOf = (id: string) => (id === owner.userId ? "you" : people.find((p) => p.userId === id)?.label ?? "someone");
      const want: string[] = [];
      for (const w of u.input.assignees.slice(0, 8)) {
        const who = typeof w === "string" ? w.trim() : "";
        if (!who) continue;
        const id = matchAssignee(who, people, owner.userId);
        if (id) {
          if (!want.includes(id)) want.push(id);
        } else skipped.push(`${label}: nobody on this project is "${who}". Use 'me' or a team member's exact email.`);
      }
      const had = current.get(row.id) ?? [];
      const add = want.filter((id) => !had.includes(id));
      const drop = had.filter((id) => !want.includes(id));
      // An unmatched name must not take the right people off: only replace
      // when every name given was understood.
      const allMatched = want.length === u.input.assignees.filter((w) => typeof w === "string" && w.trim()).length;
      if (!allMatched && drop.length) {
        skipped.push(`${label}: the people on it were left as they were, since not every name was matched.`);
      } else if (add.length || drop.length) {
        let ok = true;
        if (drop.length) {
          const { error } = await supabase.from("project_task_assignees").delete().eq("task_id", row.id).in("user_id", drop);
          if (error) ok = false;
        }
        if (ok && add.length) {
          const { error } = await supabase
            .from("project_task_assignees")
            .insert(add.map((user_id) => ({ studio_id: owner.studioId, task_id: row.id, user_id })));
          if (error) ok = false;
        }
        if (ok) {
          allChanges.push({
            field: "Who it is on",
            before: had.length ? had.map(nameOf).join(", ") : null,
            after: want.length ? want.map(nameOf).join(", ") : null,
          });
        } else skipped.push(`${label}: the people on it could not be changed.`);
      }
    }

    if (allChanges.length) edited.push({ item: label, id: row.id, changes: allChanges });
    else if (saved) unchanged++;
  }
  return report(edited, unchanged, skipped, projectId ? `${siteOrigin()}/projects/${projectId}/tasks` : null);
}

/* ------------------------------------------------------------ call sheet */

const LABELS: Partial<Record<string, string>> = {
  production_title: "Production title",
  day_of: "Day of",
  crew_call: "Crew call",
  shoot_call: "Shooting call",
  pm: "Production manager",
  pm_phone: "Production manager phone",
};
const human = (k: string) => LABELS[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const SHEET_FIELDS: FieldSpec[] = [
  { key: "title", label: "Sheet name", max: 120, oneLine: true, required: true },
  { key: "shoot_date", label: "Shoot date", max: 40, date: true },
  { key: "notes", label: "Notes", max: 4000 },
  ...SHEET_TEXT_FIELDS.map((k) => ({ key: k, label: human(k), max: 300, oneLine: !k.endsWith("address") })),
];

const ENTRY_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", max: 120, oneLine: true, required: true },
  { key: "role", label: "Role", max: 120, oneLine: true },
  { key: "call_time", label: "Call time", max: 40, oneLine: true },
  { key: "contact", label: "Contact", max: 200, oneLine: true },
];

export const UPDATE_CALL_SHEET_TOOL: McpTool = {
  name: "update_call_sheet",
  description: `Change a DRAFT call sheet: its details (date, calls, meals, wrap, location, parking, hospital, weather, company and key contacts, notes) and the people already on it (name, role, call time, contact). ${EDIT_NOTE} A sheet that has been sent or confirmed is refused: crew are already reading it, so change it in Studio Flows. To add people use create_call_sheet with call_sheet_id. Get entry ids with query on call_sheet_entries (filter call_sheet_id). Times are kept as written.`,
  inputSchema: {
    type: "object",
    properties: {
      call_sheet_id: s("The sheet's id, from call_sheets."),
      title: s("The sheet's name in the list, e.g. 'Day 1'."),
      shoot_date: s("YYYY-MM-DD."),
      notes: s("Notes printed on the sheet."),
      ...Object.fromEntries(SHEET_TEXT_FIELDS.map((k) => [k, s(human(k))])),
      entries: {
        type: "array",
        description: "People already on the sheet to change.",
        items: {
          type: "object",
          properties: {
            id: s("The entry's id, from call_sheet_entries."),
            name: s("Their name."),
            role: s("Their role or position."),
            call_time: s("Their call time, as written, e.g. 7:30 AM."),
            contact: s("Phone or email printed beside them."),
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    required: ["call_sheet_id"],
    additionalProperties: false,
  },
  annotations: ANNOT,
};

export async function updateCallSheetTool(owner: ConnectorOwner, args: Json) {
  const id = String(args.call_sheet_id ?? "").trim();
  const supabase = createClient();
  const { data: sheet } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("call_sheets").select("*").eq("id", id).maybeSingle()
    : { data: null };
  if (!sheet || sheet.studio_id !== owner.studioId) {
    return { error: "No call sheet with that id is visible here." };
  }
  if (sheet.status !== "draft") {
    return {
      error: `"${sheet.title ?? "This call sheet"}" has already been sent, so it cannot be changed from here: the crew are reading it. Change it in Studio Flows.`,
      open: `${siteOrigin()}/projects/${sheet.project_id}/callsheet?cs=${sheet.id}`,
    };
  }

  const skipped: string[] = [];
  const edited: Edited[] = [];
  let unchanged = 0;

  const { patch, problems } = readPatch(args, SHEET_FIELDS);
  skipped.push(...problems);
  const { write, changes } = changesOf(sheet as unknown as Record<string, unknown>, patch, SHEET_FIELDS);
  if (Object.keys(write).length) {
    const { data: done, error } = await supabase.from("call_sheets").update(write as never).eq("id", sheet.id).select("id");
    if (error || !done?.length) skipped.push("The sheet's details could not be saved. You may not have edit access to this project.");
    else edited.push({ item: sheet.title ?? "Call sheet", id: sheet.id, changes });
  } else if (Object.keys(patch).length) unchanged++;

  if (Array.isArray(args.entries) && args.entries.length) {
    const { updates, skipped: bad } = readUpdates(args.entries, "Person");
    skipped.push(...bad);
    const { data: rows } = updates.length
      ? await supabase
          .from("call_sheet_entries")
          .select("id, call_sheet_id, name, role, call_time, contact")
          .eq("call_sheet_id", sheet.id)
          .in(
            "id",
            updates.map((u) => u.id)
          )
      : { data: [] };
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    for (const u of updates) {
      const row = byId.get(u.id);
      if (!row) {
        skipped.push(`No person with id ${u.id} is on this sheet.`);
        continue;
      }
      const { patch: p, problems: pr } = readPatch(u.input, ENTRY_FIELDS);
      for (const x of pr) skipped.push(`${row.name}: ${x}`);
      const { write: w, changes: ch } = changesOf(row, p, ENTRY_FIELDS);
      if (!Object.keys(w).length) {
        unchanged++;
        continue;
      }
      const { data: done, error } = await supabase.from("call_sheet_entries").update(w as never).eq("id", row.id).select("id");
      if (error || !done?.length) skipped.push(`${row.name}: could not be saved.`);
      else edited.push({ item: row.name, id: row.id, changes: ch });
    }
  }

  if (!edited.length && !unchanged && !skipped.length) return { error: "Nothing to change was sent." };
  return report(edited, unchanged, skipped, `${siteOrigin()}/projects/${sheet.project_id}/callsheet?cs=${sheet.id}`, {
    call_sheet: sheet.title,
    note: "Still a draft. Nothing was sent.",
  });
}

/* ----------------------------------------------------------------------- */

export const CONNECTOR_EDIT_TOOLS: McpTool[] = [
  UPDATE_SHOTS_TOOL,
  UPDATE_FRAMES_TOOL,
  UPDATE_TASKS_TOOL,
  UPDATE_CALL_SHEET_TOOL,
];

export const EDITORS: Record<string, (owner: ConnectorOwner, args: Json) => Promise<unknown>> = {
  update_shots: updateShotsTool,
  update_storyboard_frames: updateFramesTool,
  update_tasks: updateTasksTool,
  update_call_sheet: updateCallSheetTool,
};
