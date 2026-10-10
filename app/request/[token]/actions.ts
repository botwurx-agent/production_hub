"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { allowPublic } from "@/lib/rate-limit";
import { requestLinkByToken } from "@/lib/request-links";
import { createNotification } from "@/lib/notifications";
import { mintRequestUpload, finalizeRequestUpload } from "@/lib/upload-ticket";
import {
  MAX_REQUEST_FILE_BYTES,
  dealNotes,
  validateFiles,
  validateRequest,
  type RequestFields,
  type RequestInput,
  parseRequestFiles,
  type StoredRequestFile,
} from "@/lib/job-request";
import type { Json } from "@/lib/database.types";
import { MIN_FILL_MS } from "@/lib/contact";
import { reportError } from "@/lib/log";

export type SubmitResult =
  | { ok: true; requestId: string; uploads: { index: number; path: string; token: string }[] }
  | { ok: false; error: string; field?: RequestFields };

/**
 * A client's request for new work. Becomes an INBOUND deal on their account,
 * with the request's own row beside it, and a notification for the studio.
 *
 * The row is written BEFORE any file is sent, and that order is deliberate:
 * the request is the thing that must not be lost, and files are a layer on
 * top. A failed upload leaves a request without that file rather than no
 * request at all, and the page says which file did not make it.
 */
export async function submitJobRequest(
  token: string,
  input: RequestInput & { website?: string; startedAt?: number; files?: unknown }
): Promise<SubmitResult> {
  // The honeypot and the timing check answer SUCCESS, as on the contact form:
  // telling a script which check it tripped is telling it how to pass.
  if (input.website) return { ok: true, requestId: "", uploads: [] };
  if (Number.isFinite(input.startedAt) && Date.now() - Number(input.startedAt) < MIN_FILL_MS) {
    return { ok: true, requestId: "", uploads: [] };
  }
  if (!allowPublic("job-request", 6, 10 * 60_000)) {
    return { ok: false, error: "Too many requests from here in a short time. Wait a few minutes and try again." };
  }

  const link = await requestLinkByToken(token);
  if (!link) return { ok: false, error: "This link is no longer active. Ask the studio for a new one." };

  const today = new Date().toISOString().slice(0, 10);
  const checked = validateRequest(input, today);
  if (!checked.ok) return { ok: false, error: checked.error, field: checked.field };
  const files = validateFiles(input.files);
  if (!files.ok) return { ok: false, error: files.error, field: "files" };
  const v = checked.value;

  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("id, name")
    .eq("id", link.clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "This link is no longer active. Ask the studio for a new one." };

  const { data: deal, error: dealErr } = await service
    .from("deals")
    .insert({
      studio_id: link.studioId,
      account_id: client.id,
      title: v.title,
      value: v.budget,
      stage: "inbound",
      source: "Request link",
      notes: dealNotes(v),
    })
    .select("id")
    .single();
  if (dealErr || !deal) {
    reportError("submitJobRequest/deal", dealErr);
    return { ok: false, error: "Your request could not be sent. Please try again, or email the studio directly." };
  }

  const { data: request, error: reqErr } = await service
    .from("job_requests")
    .insert({
      studio_id: link.studioId,
      client_id: client.id,
      deal_id: deal.id,
      request_link_id: link.linkId,
      title: v.title,
      details: v.details,
      needed_by: v.neededBy,
      budget: v.budget,
      contact_name: v.name,
      contact_email: v.email,
    })
    .select("id")
    .single();
  if (reqErr || !request) {
    // The deal alone still says who asked for what, so it is kept rather than
    // rolled back: a request with its brief in the notes beats no request.
    reportError("submitJobRequest/request", reqErr);
    return { ok: false, error: "Your request could not be sent. Please try again, or email the studio directly." };
  }

  // Everything below is best effort. The request exists; none of these may
  // turn a delivered request into an error on the client's screen.
  await Promise.all([
    service
      .from("crm_activities")
      .insert({
        studio_id: link.studioId,
        account_id: client.id,
        deal_id: deal.id,
        kind: "created",
        body: `Requested by ${v.name} through the request link`,
      })
      .then(({ error }) => error && reportError("submitJobRequest/activity", error)),
    addContactIfNew(link.studioId, client.id, v.name, v.email),
    createNotification(service, {
      studio_id: link.studioId,
      type: "job_request",
      title: `New job request from ${client.name}`,
      body: `${v.title} (${v.name})`,
      href: `/pipeline/${deal.id}`,
    }).catch((e) => reportError("submitJobRequest/notify", e)),
  ]);

  // Each ticket carries the index of the file it is for, so the page pairs
  // them by position rather than by a name two files can share.
  const uploads: { index: number; path: string; token: string }[] = [];
  for (const [index, f] of files.files.entries()) {
    const ticket = await mintRequestUpload(link.studioId, request.id, f.name, f.size, MAX_REQUEST_FILE_BYTES);
    if ("error" in ticket) continue;
    uploads.push({ index, path: ticket.path, token: ticket.token });
  }
  return { ok: true, requestId: request.id, uploads };
}

/**
 * Somebody who asks for work through the link is somebody the studio will
 * write back to, so they join the account's contacts when no contact there
 * already has that address. Never overwrites an existing contact.
 */
async function addContactIfNew(studioId: string, clientId: string, name: string, email: string) {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("contacts")
    .select("id")
    .eq("client_id", clientId)
    .ilike("email", email.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1);
  if (existing && existing.length) return;
  const { error } = await service
    .from("contacts")
    .insert({ studio_id: studioId, client_id: clientId, name, email });
  if (error) reportError("submitJobRequest/contact", error);
}

/** How long after the request its files may still be attached. */
const ATTACH_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Record the files that actually arrived. Each path is checked against the
 * shape its ticket would have built and its real size read back, so the list
 * on the deal page is what is in the bucket, not what the browser claimed.
 * Only ever ADDS to a recent request under the same link, so a token cannot
 * be used to rewrite somebody's request later.
 */
export async function finishJobRequest(
  token: string,
  requestId: string,
  uploaded: { path: string; name: string }[]
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  if (!allowPublic("job-request-finish", 12, 10 * 60_000)) {
    return { ok: false, error: "Too many attempts. Wait a few minutes." };
  }
  const link = await requestLinkByToken(token);
  if (!link) return { ok: false, error: "This link is no longer active." };
  const service = createServiceClient();
  const { data: request } = await service
    .from("job_requests")
    .select("id, studio_id, request_link_id, files, created_at")
    .eq("id", requestId)
    .maybeSingle();
  if (
    !request ||
    request.request_link_id !== link.linkId ||
    Date.now() - new Date(request.created_at).getTime() > ATTACH_WINDOW_MS
  ) {
    return { ok: false, error: "That request could not be found." };
  }

  const list = Array.isArray(uploaded) ? uploaded.slice(0, 5) : [];
  const existing = parseRequestFiles(request.files);
  const known = new Set(existing.map((f) => f.path));
  const added: StoredRequestFile[] = [];
  for (const u of list) {
    if (!u || typeof u.path !== "string" || known.has(u.path)) continue;
    const res = await finalizeRequestUpload(request.studio_id, request.id, u.path, MAX_REQUEST_FILE_BYTES);
    if ("error" in res) continue;
    const name = typeof u.name === "string" && u.name.trim() ? u.name.trim().slice(-160) : "File";
    added.push({ path: u.path, name, size: res.size, type: res.mimeType });
    known.add(u.path);
  }
  if (!added.length) return { ok: true, saved: 0 };
  const { error } = await service
    .from("job_requests")
    .update({ files: [...existing, ...added] as unknown as Json })
    .eq("id", request.id);
  if (error) {
    reportError("finishJobRequest", error);
    return { ok: false, error: "The files arrived but could not be attached. The studio has your request." };
  }
  return { ok: true, saved: added.length };
}
