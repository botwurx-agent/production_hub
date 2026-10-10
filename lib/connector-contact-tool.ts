import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { loadContactRates } from "@/lib/rates";
import {
  categoryOf,
  emailOf,
  MAX_CONTACTS,
  parseCopies,
  parseNewContacts,
  personKey,
  type ContactCategoryKey,
} from "@/lib/connector-contacts";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * add_contacts: people onto a project's roster, over the connector. Two kinds
 * in one call: NEW people (from an email signature, a pasted crew list, or the
 * producer's own words) and COPIES of people already in the studio (usually off
 * an earlier project's roster).
 *
 * Inserts the same rows addProjectContact does, through the owner's borrowed
 * RLS client, so the boundary is the same; it cannot call that action because
 * the action needs a cookie session. Adds only: an existing contact is never
 * changed.
 *
 * A COPY, NEVER A LINK, because contacts_one_parent lets a contact belong to
 * one project. The copy carries the person's details, their DAY RATE (operator,
 * 2026-10-10: carry it, override when told) and their talent profile (catering,
 * wardrobe, representation). It deliberately leaves out the HEADSHOT: the two
 * profiles would point at one stored file, and replacing the headshot on either
 * deletes the old file, which would blank the other person's picture. Files
 * (W-9s, releases) are per job and are not copied either.
 *
 * Rates are written to contact_rates, the studio-only side table (0074), never
 * onto `contacts`, which collaborators can read. The owner is always a studio
 * member, since a connector link requires one.
 */

const s = (description: string) => ({ type: "string", description });

const DAY_RATE = {
  type: ["number", "string"],
  description: "Day rate in dollars, e.g. 1200 or '$1,200/day'. Only when the producer gave one.",
};

export const CONTACT_TOOL: McpTool = {
  name: "add_contacts",
  description:
    `Add people to a project's contacts (its crew, talent, extras, vendors and client roster), up to ${MAX_CONTACTS} per call. Two ways, usable together: 'contacts' adds NEW people from what you know (an email signature, a crew list, the producer's words); 'copy' copies people already in the studio, usually from an earlier project's roster (find them with query on contacts, matching project_id), bringing their details, day rate and catering/wardrobe details with them. Adds only: anyone already on this project with the same email (or the same name when there is no email) is skipped and reported, and nobody is emailed or invited. Leave out anything you do not know rather than guessing.`,
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project to add them to, from search."),
      contacts: {
        type: "array",
        description: "New people.",
        items: {
          type: "object",
          properties: {
            name: s("Full name."),
            category: s("crew (default), talent, extras, vendor or client. A rental house or post house is a vendor."),
            position: s("Their job on this project, e.g. 'Gaffer', 'DP', 'Prop stylist', 'Lead actor'."),
            company: s("Their company, if any."),
            email: s("Email address."),
            phone: s("Phone number as written."),
            notes: s("Anything else worth keeping on their card."),
            day_rate: DAY_RATE,
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      copy: {
        type: "array",
        description: "People to copy from elsewhere in the studio.",
        items: {
          type: "object",
          properties: {
            contact_id: s("The existing contact's id (table contacts)."),
            category: s("Only to change it for this project."),
            position: s("Only to change their job for this project."),
            day_rate: { ...DAY_RATE, description: "Only to change the rate for this project; otherwise their old rate is carried over." },
          },
          required: ["contact_id"],
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

const PROFILE_FIELDS =
  "contact_id, credited_as, pronouns, website, agent_name, agent_email, agent_phone, union_status, dietary_restrictions, allergies, dietary_notes, wardrobe";

export async function addContactsTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }

  const fresh = parseNewContacts(args.contacts);
  const copied = parseCopies(args.copy);
  const skipped = [...fresh.skipped, ...copied.skipped];
  if (!fresh.contacts.length && !copied.copies.length) {
    return { error: "Nobody to add. Pass 'contacts', 'copy', or both.", skipped };
  }

  // Who is already on the job, so a second run adds nobody twice.
  const { data: existing } = await supabase
    .from("contacts")
    .select("name, email")
    .eq("project_id", project.id);
  const taken = new Set((existing ?? []).map((c) => personKey({ name: c.name, email: emailOf(c.email) })));

  // The people being copied, read through RLS and pinned to this studio.
  const ids = copied.copies.map((c) => c.contactId);
  const { data: sources } = ids.length
    ? await supabase
        .from("contacts")
        .select("id, studio_id, project_id, client_id, name, type, role, company, email, phone, notes")
        .in("id", ids)
    : { data: [] };
  const byId = new Map((sources ?? []).filter((c) => c.studio_id === owner.studioId).map((c) => [c.id, c]));
  const rates = await loadContactRates(supabase, [...byId.keys()]);
  const { data: profiles } = byId.size
    ? await supabase.from("contact_profiles").select(PROFILE_FIELDS).in("contact_id", [...byId.keys()])
    : { data: [] };
  const profileOf = new Map((profiles ?? []).map((p) => [p.contact_id, p]));

  type Row = {
    id: string;
    name: string;
    category: ContactCategoryKey;
    position: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    dayRate: number | null;
    fromId: string | null;
  };
  const rows: Row[] = [];
  const admit = (r: Omit<Row, "id">) => {
    if (rows.length >= MAX_CONTACTS) {
      skipped.push(`${r.name}: over the ${MAX_CONTACTS} per call limit, send them in another call.`);
      return;
    }
    const key = personKey(r);
    if (taken.has(key)) {
      skipped.push(`${r.name}: already on this project${r.email ? ` (${r.email})` : ""}; left as it is.`);
      return;
    }
    taken.add(key);
    rows.push({ ...r, id: crypto.randomUUID() });
  };

  for (const c of fresh.contacts) admit({ ...c, fromId: null });
  for (const c of copied.copies) {
    const src = byId.get(c.contactId);
    if (!src) {
      skipped.push(`Contact ${c.contactId}: not found in this studio.`);
      continue;
    }
    // A person off a client's own list is a client unless told otherwise.
    const srcCategory = categoryOf(src.type) ?? (src.project_id ? "crew" : "client");
    admit({
      name: src.name,
      category: c.category ?? srcCategory,
      position: c.position ?? src.role,
      company: src.company,
      email: emailOf(src.email),
      phone: src.phone,
      notes: src.notes,
      dayRate: c.dayRate ?? rates.get(src.id) ?? null,
      fromId: src.id,
    });
  }
  if (!rows.length) return { error: "Everybody named is already on this project or could not be found.", skipped };

  const { error } = await supabase.from("contacts").insert(
    rows.map((r) => ({
      id: r.id,
      studio_id: owner.studioId,
      project_id: project.id,
      name: r.name,
      type: r.category,
      role: r.position,
      company: r.company,
      email: r.email,
      phone: r.phone,
      notes: r.notes,
    }))
  );
  if (error) return { error: "The contacts could not be saved.", skipped };

  // Rates and profiles are best effort: the people are on the roster already,
  // and a missing rate is one field to fill rather than a lost person.
  const withRate = rows.filter((r) => r.dayRate !== null);
  if (withRate.length) {
    const now = new Date().toISOString();
    const { error: rErr } = await supabase.from("contact_rates").insert(
      withRate.map((r) => ({ studio_id: owner.studioId, contact_id: r.id, rate: r.dayRate as number, updated_at: now }))
    );
    if (rErr) skipped.push("The people were added but their day rates could not be saved; add them on the Contacts page.");
  }
  const withProfile = rows.filter((r) => r.fromId && profileOf.has(r.fromId));
  if (withProfile.length) {
    const { error: pErr } = await supabase.from("contact_profiles").insert(
      withProfile.map((r) => {
        const { contact_id: _drop, ...profile } = profileOf.get(r.fromId as string)!;
        void _drop;
        return { ...profile, studio_id: owner.studioId, contact_id: r.id, created_by: owner.userId };
      })
    );
    if (pErr) skipped.push("The people were added but their catering and wardrobe details could not be copied.");
  }

  return {
    added: rows.map((r) => ({
      name: r.name,
      category: r.category,
      position: r.position,
      email: r.email,
      day_rate: r.dayRate,
      copied: r.fromId !== null,
    })),
    project: project.title,
    skipped,
    open: `${siteOrigin()}/projects/${project.id}/contacts`,
  };
}
