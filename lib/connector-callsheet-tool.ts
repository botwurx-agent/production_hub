import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { alreadyOn, blockForCategory, contactLine, type ExistingEntry, type RosterContact } from "@/lib/callsheet-import";
import {
  CARRIED_FIELDS,
  hasSheetFields,
  MAX_ENTRIES,
  parseEntries,
  parseSheetFields,
  rosterSections,
  SHEET_TEXT_FIELDS,
  type SheetSection,
} from "@/lib/connector-callsheet";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * create_call_sheet: a DRAFT call sheet on a project, over the connector, or
 * more people onto one that exists. Inserts the same rows createCallSheet and
 * addCallSheetEntriesFromRoster do (it cannot call them: they need a cookie
 * session), through the owner's borrowed RLS client, so the boundary is the
 * same.
 *
 * NOTHING IS SENT. No recipients are added and the sheet stays a draft, which
 * also keeps it out of the reminder cron (it only chases sent sheets). Sending
 * to the unit stays a human press in the app, like every outward email here.
 *
 * The production company, key contacts, block layout and accent come from the
 * project's latest sheet when not given, the facts that are the same every day
 * of a job. The date, times, weather and location never carry, the duplicate
 * action's rule: a sheet stating yesterday's call reaching the unit is the
 * worst thing this document can do.
 */

const s = (description: string) => ({ type: "string", description });

const FIELD_HINTS: Record<(typeof SHEET_TEXT_FIELDS)[number], string> = {
  production_title: "The production's name as printed at the top, if different from the project.",
  day_of: "e.g. 'Day 1 of 2'.",
  crew_call: "General crew call, as written, e.g. '7:00 AM'.",
  shoot_call: "Shooting call (camera ready).",
  breakfast: "Breakfast time.",
  lunch: "Lunch time.",
  wrap: "Estimated wrap.",
  location: "Shoot location, name and address.",
  parking: "Where to park and any instructions.",
  hospital: "Nearest hospital, name and address.",
  weather: "Forecast, only if you have it.",
  sunrise: "Sunrise time.",
  sunset: "Sunset time.",
  company_name: "Production company.",
  company_address: "Production company address.",
  company_phone: "Production company phone.",
  company_website: "Production company website.",
  producer: "Producer's name.",
  producer_phone: "Producer's phone.",
  director: "Director's name.",
  director_phone: "Director's phone.",
  pm: "Production manager's name.",
  pm_phone: "Production manager's phone.",
};

export const CALL_SHEET_TOOL: McpTool = {
  name: "create_call_sheet",
  description:
    `Put together a call sheet on a project, as a DRAFT the producer checks and sends from Studio Flows. Fill in the day's details (date, call times, location, parking, hospital, key contacts) and the people on it: 'from_roster' pulls everyone in the project's contacts for those sections (cast is talent and extras, crew is crew and vendors, client is the client and agency), and 'entries' adds or names people one by one, with their call times. Use contact_id (from query on contacts for this project) to put a roster person on with their phone, plus a call time. Company and key contacts carry over from the project's last call sheet when not given. Pass call_sheet_id instead to ADD people to a sheet that already exists; its details are left as they are. Adds only, up to ${MAX_ENTRIES} people per call, and nothing is sent to anyone. Leave out anything you do not know rather than guessing.`,
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      call_sheet_id: s("Only to add people to an existing call sheet (table call_sheets) instead of making a new one."),
      title: s("The sheet's name in the list, e.g. 'Day 1' or 'Prelight'."),
      shoot_date: s("YYYY-MM-DD."),
      ...Object.fromEntries(SHEET_TEXT_FIELDS.map((f) => [f, s(FIELD_HINTS[f])])),
      notes: s("General notes printed on the sheet (safety, wardrobe, what to bring)."),
      from_roster: {
        type: ["boolean", "string", "array"],
        items: { type: "string" },
        description: "Pull everyone from the project's contacts: true or 'all', or a list of sections: cast, crew, client. Their call times are left blank unless you also list them in entries.",
      },
      entries: {
        type: "array",
        description: "People on the sheet, in order. A person here who is also pulled from the roster appears once, with these details.",
        items: {
          type: "object",
          properties: {
            contact_id: s("A contact on this project's roster, to fill their name, position and phone."),
            name: s("Full name (needed when there is no contact_id)."),
            role: s("Their position, or the character for cast."),
            call_time: s("Their call time, as written."),
            contact: s("Phone or email to print; the roster's phone is used when left out."),
            section: s("cast, crew or client. Defaults from their roster category, else crew."),
          },
          additionalProperties: false,
        },
      },
    },
    required: ["project_id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

type Json = Record<string, unknown>;

type Row = {
  name: string;
  role: string;
  call_time: string;
  contact: string;
  kind: SheetSection;
  contact_id: string | null;
};

export async function createCallSheetTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }

  const parsedEntries = parseEntries(args.entries);
  const roster = rosterSections(args.from_roster);
  const skipped = [...parsedEntries.skipped, ...roster.skipped];

  // An existing sheet, when named, must be this project's.
  const sheetId = String(args.call_sheet_id ?? "").trim();
  let existingSheet: { id: string; title: string | null; status: string } | null = null;
  if (sheetId) {
    const { data } = await supabase
      .from("call_sheets")
      .select("id, title, status, project_id, studio_id")
      .eq("id", sheetId)
      .maybeSingle();
    if (!data || data.project_id !== project.id || data.studio_id !== owner.studioId) {
      return { error: "No call sheet with that id on this project. Find it with query on call_sheets." };
    }
    existingSheet = data;
    if (hasSheetFields(args)) skipped.push("The sheet already exists, so its details (date, times, location, contacts) were left as they are; change them in Studio Flows.");
  }

  // The roster: the allowlist for contact ids and the source for from_roster.
  const { data: rosterRows } = await supabase
    .from("contacts")
    .select("id, name, role, type, email, phone")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });
  const people = (rosterRows ?? []) as RosterContact[];
  const byId = new Map(people.map((c) => [c.id, c]));

  const rows: Row[] = [];
  const onSheet: ExistingEntry[] = [];
  if (existingSheet) {
    const { data } = await supabase
      .from("call_sheet_entries")
      .select("id, name, kind, contact_id")
      .eq("call_sheet_id", existingSheet.id);
    onSheet.push(...((data ?? []) as ExistingEntry[]));
  }
  const taken = (name: string, contactId: string | null) =>
    alreadyOn([...onSheet, ...rows.map((r, i) => ({ id: String(i), name: r.name, kind: r.kind, contact_id: r.contact_id }))], {
      id: contactId ?? "",
      name,
      role: null,
      type: null,
      email: null,
      phone: null,
    });

  // Named entries first, so their call times win over a bare roster pull.
  for (const e of parsedEntries.entries) {
    const c = e.contactId ? byId.get(e.contactId) : undefined;
    if (e.contactId && !c) {
      if (!e.name) {
        skipped.push(`Contact ${e.contactId}: not on this project's roster; add them with add_contacts first.`);
        continue;
      }
      skipped.push(`${e.name}: that contact id is not on this project's roster; added from the details given, unlinked.`);
    }
    const name = e.name || c?.name.trim() || "";
    if (taken(name, c?.id ?? null)) {
      skipped.push(`${name}: already on the sheet; left as they are.`);
      continue;
    }
    if (rows.length >= MAX_ENTRIES) {
      skipped.push(`${name}: over the ${MAX_ENTRIES} per call limit, add them in another call.`);
      continue;
    }
    rows.push({
      name,
      role: e.role || c?.role?.trim() || "",
      call_time: e.callTime,
      contact: e.contact || (c ? contactLine(c) : ""),
      kind: e.section ?? (c ? blockForCategory(c.type) : "crew"),
      contact_id: c?.id ?? null,
    });
  }
  if (roster.sections.length) {
    let none = true;
    for (const c of people) {
      const kind = blockForCategory(c.type);
      if (!c.name.trim() || !roster.sections.includes(kind)) continue;
      none = false;
      if (taken(c.name.trim(), c.id)) continue;
      if (rows.length >= MAX_ENTRIES) {
        skipped.push(`${c.name}: over the ${MAX_ENTRIES} per call limit, add them in another call.`);
        continue;
      }
      rows.push({ name: c.name.trim(), role: c.role?.trim() ?? "", call_time: "", contact: contactLine(c), kind, contact_id: c.id });
    }
    if (none) skipped.push(`Nobody in the project's contacts is in ${roster.sections.join(", ")}; add them with add_contacts first.`);
  }

  // A new sheet, with the job's standing facts carried from the last one.
  let sheet = existingSheet;
  let carried: string[] = [];
  if (!sheet) {
    const { fields, skipped: fieldSkips } = parseSheetFields(args);
    skipped.push(...fieldSkips);
    const { data: last } = await supabase
      .from("call_sheets")
      .select(`position, layout, accent, ${CARRIED_FIELDS.join(", ")}`)
      .eq("project_id", project.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prev = (last ?? null) as (Record<string, unknown> & { position: number }) | null;
    const fromPrev: Record<string, string> = {};
    if (prev) {
      for (const f of CARRIED_FIELDS) {
        const v = prev[f];
        if (!fields.text[f] && typeof v === "string" && v.trim()) {
          fromPrev[f] = v;
          carried.push(f);
        }
      }
    }
    const { data: made, error } = await supabase
      .from("call_sheets")
      .insert({
        studio_id: owner.studioId,
        project_id: project.id,
        title: fields.title,
        status: "draft",
        position: (prev?.position ?? -1) + 1,
        created_by: owner.userId,
        shoot_date: fields.shootDate,
        notes: fields.notes,
        ...fromPrev,
        ...fields.text,
        ...(prev ? { layout: prev.layout as never, accent: (prev.accent as string | null) ?? null } : {}),
      })
      .select("id, title, status")
      .single();
    if (error || !made) return { error: "The call sheet could not be saved.", skipped };
    sheet = made;
  }

  let addedPeople = 0;
  if (rows.length) {
    const { data: last } = await supabase
      .from("call_sheet_entries")
      .select("position")
      .eq("call_sheet_id", sheet.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    let pos = (last?.position ?? -1) + 1;
    const { error } = await supabase
      .from("call_sheet_entries")
      .insert(rows.map((r) => ({ studio_id: owner.studioId, call_sheet_id: sheet!.id, position: pos++, ...r })));
    if (error) {
      skipped.push(
        existingSheet
          ? "The people could not be added to the sheet."
          : "The call sheet was made but its people could not be saved; add them on the call sheet page."
      );
    } else addedPeople = rows.length;
  }

  const count = (k: SheetSection) => rows.filter((r) => r.kind === k).length;
  return {
    call_sheet: { id: sheet.id, title: sheet.title, status: sheet.status, new: !existingSheet },
    added: addedPeople
      ? { people: addedPeople, cast: count("cast"), crew: count("crew"), client: count("client"), without_call_time: rows.filter((r) => !r.call_time).length }
      : { people: 0 },
    carried_from_last_sheet: carried,
    note:
      sheet.status === "draft"
        ? "A draft: nothing has been sent. The producer checks it and sends it from Studio Flows."
        : "This sheet has already been sent, so anyone with its link sees the new people now.",
    project: project.title,
    skipped,
    open: `${siteOrigin()}/projects/${project.id}/callsheet?cs=${sheet.id}`,
  };
}
