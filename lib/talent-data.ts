import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { signThumbs, assetStorage } from "@/lib/asset-storage";
import { toProfile, type TalentProfile } from "@/lib/talent";

type Client = SupabaseClient<Database>;

const PROFILE_SELECT =
  "contact_id, credited_as, pronouns, website, agent_name, agent_email, agent_phone, union_status, dietary_restrictions, allergies, dietary_notes, wardrobe, headshot_path";

export type ContactFile = {
  id: string;
  kind: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

/**
 * Profiles for a set of contacts, keyed by contact id.
 *
 * Batched rather than fetched per card, because the roster draws forty of these
 * on a busy job and forty round trips is the difference between a page and a
 * wait. Contacts with no profile row simply have no entry, and every caller
 * treats a miss as an empty profile, so nothing has to be created up front.
 */
export async function loadContactProfiles(
  supabase: Client,
  contactIds: string[]
): Promise<Map<string, TalentProfile>> {
  const out = new Map<string, TalentProfile>();
  const ids = contactIds.filter(Boolean);
  if (ids.length === 0) return out;

  const { data } = await supabase
    .from("contact_profiles")
    .select(PROFILE_SELECT)
    .in("contact_id", ids);

  for (const row of data ?? []) {
    out.set(
      (row as { contact_id: string }).contact_id,
      toProfile(row as Record<string, unknown>)
    );
  }
  return out;
}

/**
 * Signed URLs for the headshots in a profile map.
 *
 * Resized copies, not originals: these render at 40px on a roster card and a
 * phone photo straight off a casting director is several megabytes. Same
 * reasoning, and the same helper, as every other grid of small images in the
 * app.
 */
export async function signHeadshots(
  profiles: Map<string, TalentProfile>
): Promise<Map<string, string>> {
  const paths = [...profiles.values()]
    .map((p) => p.headshotPath)
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return new Map();

  const signed = await signThumbs(paths, 240);
  const out = new Map<string, string>();
  for (const [contactId, p] of profiles) {
    const url = p.headshotPath ? signed.get(p.headshotPath) : null;
    if (url) out.set(contactId, url);
  }
  return out;
}

/** Files stuck to one person: release, W-9, size sheet, fitting photos. */
export async function loadContactFiles(
  supabase: Client,
  contactId: string
): Promise<ContactFile[]> {
  const { data } = await supabase
    .from("contact_files")
    .select("id, kind, name, storage_path, mime_type, size_bytes, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ContactFile[];
}

/**
 * Every contact's files in ONE query, grouped by person.
 *
 * A roster is tens of people holding a handful of files each, so fetching the
 * rows costs barely more than counting them and saves a second round trip when
 * someone opens a card. Per-contact fetching would be N queries to render one
 * page.
 */
export async function loadContactFilesByContact(
  supabase: Client,
  contactIds: string[]
): Promise<Map<string, ContactFile[]>> {
  const out = new Map<string, ContactFile[]>();
  const ids = contactIds.filter(Boolean);
  if (ids.length === 0) return out;

  const { data } = await supabase
    .from("contact_files")
    .select("id, contact_id, kind, name, storage_path, mime_type, size_bytes, created_at")
    .in("contact_id", ids)
    .order("created_at", { ascending: false });

  for (const row of data ?? []) {
    const r = row as ContactFile & { contact_id: string };
    const list = out.get(r.contact_id) ?? [];
    list.push(r);
    out.set(r.contact_id, list);
  }
  return out;
}

/** A short-lived URL for one file, signed on CLICK rather than on page load. */
export async function signContactFile(path: string): Promise<string | null> {
  const { data } = await assetStorage()
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
