import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { assetStorage, signThumbs } from "@/lib/asset-storage";
import { loadDocSurface, type DocSurface } from "@/lib/review-links";
import { loadCast } from "@/lib/cast-data";
import {
  parseChoices,
  resolveSections,
  sectionKey,
  type BinderChoice,
  type BinderSection,
} from "@/lib/binder";
import type { CallSheet, CallSheetEntry, Database } from "@/lib/database.types";

/**
 * Reading a binder.
 *
 * LIVE, not a snapshot, the same call as the editor handoff: a client opening
 * the link next week sees the current call sheet, not the one that existed
 * when it was sent. The cost is that an edit reaches the client without
 * anyone re-sending, which is why the builder says so and why a NEW section
 * still has to be ticked before it appears.
 */

export type BinderContent =
  | { kind: "overview"; overview: BinderOverview }
  | { kind: "doc"; surface: DocSurface }
  | {
      kind: "call_sheet";
      sheet: CallSheet;
      entries: CallSheetEntry[];
      logoUrl: string | null;
    }
  | { kind: "elements"; elements: BinderElement[] }
  | { kind: "contacts"; contacts: BinderContact[] };

export type BinderOverview = {
  title: string;
  clientName: string | null;
  status: string;
  shootDate: string | null;
  dueDate: string | null;
  brief: string | null;
};

export type BinderElement = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  imageUrl: string | null;
};

/**
 * A crew contact as a CLIENT may see one.
 *
 * No rate, and not by omission: day rates live in `contact_rates`, a
 * studio-only table (migration 0074), so there is nothing on this row to leak.
 * Stated here because a binder is the one surface where somebody would think
 * to add it back.
 */
export type BinderContact = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
};

export type BinderView = {
  studioName: string;
  logoUrl: string | null;
  projectTitle: string;
  clientName: string | null;
  title: string;
  updatedAt: string | null;
  sections: {
    key: string;
    label: string;
    hideNotes: boolean;
    content: BinderContent;
  }[];
};

/** Everything this project could put in a binder, in a sensible default order. */
export async function loadBinderSections(
  client: SupabaseClient<Database>,
  projectId: string
): Promise<BinderSection[]> {
  const [{ data: sheets }, { data: boards }, { data: groups }, { data: shots }, { data: contacts }, { data: entities }] =
    await Promise.all([
      client
        .from("call_sheets")
        .select("id, title, shoot_date")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      client
        .from("boards")
        .select("id, name, kind")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      client.from("shot_groups").select("id").eq("project_id", projectId),
      client.from("ai_shots").select("id").eq("project_id", projectId).limit(1),
      client.from("contacts").select("id").eq("project_id", projectId).limit(1),
      client
        .from("ai_entities")
        .select("id")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .limit(1),
    ]);

  const out: BinderSection[] = [
    {
      key: "overview",
      kind: "overview",
      targetId: null,
      label: "Overview",
      hint: "Title, client, dates and the brief",
      hasNotes: false,
    },
  ];

  for (const sheet of sheets ?? []) {
    out.push({
      key: sectionKey("call_sheet", sheet.id),
      kind: "call_sheet",
      targetId: sheet.id,
      label: sheet.title?.trim() || "Call sheet",
      hint: sheet.shoot_date ? `Call sheet · ${sheet.shoot_date}` : "Call sheet",
      hasNotes: false,
    });
  }

  // One entry for the whole shot board, matching how it is shared for review.
  if ((groups ?? []).length > 0) {
    out.push({
      key: "shot_list",
      kind: "shot_list",
      targetId: null,
      label: "Shot list",
      hint: `${(groups ?? []).length} list${(groups ?? []).length === 1 ? "" : "s"}`,
      hasNotes: true,
    });
  }

  for (const board of boards ?? []) {
    if (board.kind === "storyboard") {
      out.push({
        key: sectionKey("storyboard", board.id),
        kind: "storyboard",
        targetId: board.id,
        label: board.name?.trim() || "Storyboard",
        hint: "Storyboard",
        hasNotes: true,
      });
    } else if (board.kind === "moodboard") {
      out.push({
        key: sectionKey("moodboard", board.id),
        kind: "moodboard",
        targetId: board.id,
        label: board.name?.trim() || "Moodboard",
        hint: "Moodboard",
        hasNotes: false,
      });
    }
  }

  if ((shots ?? []).length > 0) {
    out.push({
      key: "sequence",
      kind: "sequence",
      targetId: null,
      label: "Sequence",
      hint: "Every shot in cut order",
      hasNotes: false,
    });
  }

  if ((entities ?? []).length > 0) {
    out.push({
      key: "elements",
      kind: "elements",
      targetId: null,
      label: "Elements",
      hint: "Wardrobe, props, locations and characters",
      hasNotes: false,
    });
  }

  if ((contacts ?? []).length > 0) {
    out.push({
      key: "contacts",
      kind: "contacts",
      targetId: null,
      label: "Contacts",
      hint: "The crew roster, without day rates",
      hasNotes: false,
    });
  }

  return out;
}

async function loadSectionContent(
  client: SupabaseClient<Database>,
  projectId: string,
  studioId: string,
  section: BinderSection
): Promise<BinderContent | null> {
  if (section.kind === "overview") {
    const { data: project } = await client
      .from("projects")
      .select("title, status, shoot_date, due_date, clients(name)")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return null;
    const { data: brief } = await client
      .from("briefs")
      .select("content")
      .eq("project_id", projectId)
      .maybeSingle();
    const clientRow = project.clients as { name: string } | null | undefined;
    return {
      kind: "overview",
      overview: {
        title: project.title,
        clientName: clientRow?.name ?? null,
        status: project.status,
        shootDate: project.shoot_date,
        dueDate: project.due_date,
        brief: brief?.content ?? null,
      },
    };
  }

  if (section.kind === "call_sheet") {
    const [{ data: sheet }, { data: entries }] = await Promise.all([
      client
        .from("call_sheets")
        .select("*")
        .eq("id", section.targetId as string)
        .maybeSingle(),
      client
        .from("call_sheet_entries")
        .select("*")
        .eq("call_sheet_id", section.targetId as string)
        .order("position", { ascending: true }),
    ]);
    if (!sheet) return null;
    return {
      kind: "call_sheet",
      sheet: sheet as CallSheet,
      entries: (entries ?? []) as CallSheetEntry[],
      logoUrl: null,
    };
  }

  if (
    section.kind === "shot_list" ||
    section.kind === "storyboard" ||
    section.kind === "moodboard" ||
    section.kind === "sequence"
  ) {
    // The same loader the review portal uses, so a binder cannot disagree with
    // what the client was shown for approval.
    const target =
      section.kind === "shot_list" || section.kind === "sequence"
        ? projectId
        : (section.targetId as string);
    const doc = await loadDocSurface(client, section.kind, target);
    return doc ? { kind: "doc", surface: doc.surface } : null;
  }

  if (section.kind === "elements") {
    const { references } = await loadCast(projectId, studioId);
    return {
      kind: "elements",
      elements: references.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        description: r.description,
        // The handle is deliberately absent: it is how the studio drives a
        // generator, and means nothing to a client.
        imageUrl: r.sheets[0]?.thumbUrl ?? r.sheets[0]?.url ?? null,
      })),
    };
  }

  if (section.kind === "contacts") {
    const { data: rows } = await client
      .from("contacts")
      .select("id, name, role, company, type, email, phone")
      .eq("project_id", projectId)
      .order("name", { ascending: true });
    return { kind: "contacts", contacts: (rows ?? []) as BinderContact[] };
  }

  return null;
}

/**
 * The public read, gated only by the token.
 *
 * Service role, like every other share page, because the reader has no
 * account. The gate is the token plus the shared/revoked flags; nothing here
 * takes an id from the URL and reads it directly, since every section is
 * resolved from the binder's own project.
 */
export async function loadBinderByToken(
  token: string
): Promise<BinderView | null> {
  if (!serviceConfigured()) return null;
  const service = createServiceClient();

  const { data: binder } = await service
    .from("project_binders")
    .select("id, studio_id, project_id, title, sections, shared_at, revoked_at, updated_at")
    .eq("token", token)
    .maybeSingle();
  // Never shared is as closed as revoked: a link that leaked out of a
  // half-built binder must not open.
  if (!binder || binder.revoked_at || !binder.shared_at) return null;

  return buildView(service, binder.studio_id, binder.project_id, {
    title: binder.title,
    sections: binder.sections,
    updatedAt: binder.updated_at,
  });
}

/** The same view, for the studio's own preview and print. */
export async function loadBinderPreview(
  client: SupabaseClient<Database>,
  studioId: string,
  projectId: string,
  binderId: string
): Promise<BinderView | null> {
  const { data: binder } = await client
    .from("project_binders")
    .select("title, sections, updated_at")
    .eq("id", binderId)
    .maybeSingle();
  if (!binder) return null;
  return buildView(client, studioId, projectId, {
    title: binder.title,
    sections: binder.sections,
    updatedAt: binder.updated_at,
  });
}

async function buildView(
  client: SupabaseClient<Database>,
  studioId: string,
  projectId: string,
  binder: { title: string | null; sections: unknown; updatedAt: string | null }
): Promise<BinderView | null> {
  const [{ data: project }, { data: studio }] = await Promise.all([
    client
      .from("projects")
      .select("title, clients(name)")
      .eq("id", projectId)
      .maybeSingle(),
    client.from("studios").select("name, logo_path").eq("id", studioId).maybeSingle(),
  ]);
  if (!project) return null;

  const available = await loadBinderSections(client, projectId);
  const choices: BinderChoice[] = parseChoices(binder.sections);
  const chosen = resolveSections(available, choices);

  let logoUrl: string | null = null;
  if (studio?.logo_path) {
    const { data } = await assetStorage().createSignedUrl(studio.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const sections: BinderView["sections"] = [];
  for (const { section, hideNotes } of chosen) {
    const content = await loadSectionContent(client, projectId, studioId, section);
    if (!content) continue;
    sections.push({
      key: section.key,
      label: section.label,
      hideNotes,
      content:
        content.kind === "call_sheet" ? { ...content, logoUrl } : content,
    });
  }

  const clientRow = project.clients as { name: string } | null | undefined;
  return {
    studioName: studio?.name ?? "Studio",
    logoUrl,
    projectTitle: project.title,
    clientName: clientRow?.name ?? null,
    title: binder.title?.trim() || `${project.title} binder`,
    updatedAt: binder.updatedAt,
    sections,
  };
}

/** Counted on open, best effort: a failed count must not fail the page. */
export async function recordBinderView(token: string): Promise<void> {
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  const { data } = await service
    .from("project_binders")
    .select("id, view_count")
    .eq("token", token)
    .maybeSingle();
  if (!data) return;
  await service
    .from("project_binders")
    .update({
      view_count: (data.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("id", data.id);
}

export { signThumbs };
