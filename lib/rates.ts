import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Crew day rates live in their own is_studio_member table (migration 0074)
 * rather than as a column on `contacts`, which project collaborators can read.
 *
 * That means none of these helpers need a collaborator check: RLS returns no
 * rows for someone without a membership, so a rate comes back null on its own.
 * That is the whole point of the split. Do not add an isCollaborator guard here
 * and do not move the value back onto `contacts`.
 */
export async function loadContactRates(
  client: SupabaseClient<Database>,
  contactIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (contactIds.length === 0) return out;

  const { data } = await client
    .from("contact_rates")
    .select("contact_id, rate")
    .in("contact_id", contactIds);

  for (const r of data ?? []) {
    // numeric arrives from PostgREST as a string.
    const n = Number(r.rate);
    if (Number.isFinite(n)) out.set(r.contact_id, n);
  }
  return out;
}

/**
 * Writes one contact's rate. A null or blank clears it by deleting the row,
 * so "no rate agreed" is the absence of a record rather than a stored null.
 *
 * Returns an error only for a real failure; a collaborator attempting this is
 * refused by RLS, which is correct and needs no special case.
 */
export async function setContactRate(
  client: SupabaseClient<Database>,
  studioId: string,
  contactId: string,
  rate: number | null
): Promise<{ error: string } | null> {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    const { error } = await client
      .from("contact_rates")
      .delete()
      .eq("contact_id", contactId);
    return error ? { error: error.message } : null;
  }

  const { error } = await client.from("contact_rates").upsert(
    {
      studio_id: studioId,
      contact_id: contactId,
      rate: Math.round(rate * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  return error ? { error: error.message } : null;
}

/** Same shape for deliverable pricing: what the client is charged per item. */
export async function loadDeliverablePricing(
  client: SupabaseClient<Database>,
  deliverableIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (deliverableIds.length === 0) return out;

  const { data } = await client
    .from("deliverable_pricing")
    .select("deliverable_id, rate")
    .in("deliverable_id", deliverableIds);

  for (const r of data ?? []) {
    const n = Number(r.rate);
    if (Number.isFinite(n)) out.set(r.deliverable_id, n);
  }
  return out;
}

export async function setDeliverableRate(
  client: SupabaseClient<Database>,
  studioId: string,
  deliverableId: string,
  rate: number | null
): Promise<void> {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    await client
      .from("deliverable_pricing")
      .delete()
      .eq("deliverable_id", deliverableId);
    return;
  }
  await client.from("deliverable_pricing").upsert(
    {
      studio_id: studioId,
      deliverable_id: deliverableId,
      rate: Math.round(rate * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "deliverable_id" }
  );
}

/** And what each AI generation cost to make. */
export async function loadGenerationCosts(
  client: SupabaseClient<Database>,
  generationIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (generationIds.length === 0) return out;

  const { data } = await client
    .from("generation_costs")
    .select("generation_id, cost")
    .in("generation_id", generationIds);

  for (const r of data ?? []) {
    const n = Number(r.cost);
    if (Number.isFinite(n)) out.set(r.generation_id, n);
  }
  return out;
}

export async function setGenerationCost(
  client: SupabaseClient<Database>,
  studioId: string,
  generationId: string,
  cost: number | null
): Promise<void> {
  if (cost === null || !Number.isFinite(cost) || cost < 0) {
    await client
      .from("generation_costs")
      .delete()
      .eq("generation_id", generationId);
    return;
  }
  await client.from("generation_costs").upsert(
    {
      studio_id: studioId,
      generation_id: generationId,
      cost: Math.round(cost * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "generation_id" }
  );
}
