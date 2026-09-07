"use server";

import {
  mintUploadTicket,
  type UploadScope,
  type UploadTicket,
} from "@/lib/upload-ticket";

/**
 * The one server action the browser calls to start a direct upload.
 *
 * Thin on purpose: every decision lives in lib/upload-ticket.ts so the
 * authorization for all five scopes can be read on one screen. A "use server"
 * module can only export async functions, which is also why the types live
 * next door.
 *
 * NOTHING ELSE IS EXPOSED HERE, and the two things left out were both in a
 * first draft of this file:
 *
 * `finalizeUpload` takes a path and a ceiling from its caller, so re-exporting
 * it from a "use server" module would let a browser confirm any path against
 * any limit it liked. It is called server-side, from inside the action that
 * writes the row, and imported from the lib directly.
 *
 * `abandonUpload(path)` looked harmless (clean up after a closed tab) and was
 * a delete endpoint taking an arbitrary path, so any signed-in user could have
 * removed any file in the bucket by guessing one. An abandoned upload is an
 * unreferenced blob, which is waste rather than a leak, and waste is not worth
 * a client-callable delete. If it ever needs collecting, a server-side sweep
 * of unreferenced paths is the shape, not this.
 */
export async function createUploadTicket(
  scope: UploadScope,
  fileName: string,
  declaredBytes: number
): Promise<UploadTicket> {
  return mintUploadTicket(scope, fileName, declaredBytes);
}
