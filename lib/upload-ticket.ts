import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { reportError } from "@/lib/log";
import {
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  pathWithinScope,
} from "@/lib/upload-limits";

/**
 * ONE PLACE THAT DECIDES WHO MAY WRITE BYTES.
 *
 * A direct-to-storage upload is authorized by a signed URL we mint, and the
 * service role that mints it bypasses the bucket policy. So the mint is the
 * ONLY gate: nothing downstream stops a caller who got a ticket they should
 * not have had.
 *
 * That is not theoretical here. `createAssetUploadUrl` originally treated "can
 * you read this project" as the authorization, which was true until migration
 * 0093 added the reviewer tier, at which point a reviewer could read the
 * project, take a ticket, and write into the bucket. It was fixed by asking
 * the database via the can_edit_project RPC.
 *
 * Moving five more upload sites onto signed URLs means five more chances to
 * make that same mistake, so every scope's authorization lives in this one
 * file, side by side, where they can be reviewed together. Adding a scope
 * means adding a case HERE, not writing a new mint somewhere else.
 */
export type UploadScope =
  | { kind: "project_asset"; projectId: string }
  | { kind: "agreement" }
  | { kind: "billing_doc"; docId: string }
  | { kind: "cost"; projectId: string }
  | { kind: "board"; boardId: string };

type Granted = {
  studioId: string;
  /** Folder under the studio, so a path can never be chosen by the browser. */
  folder: string;
  maxBytes: number;
};

export type UploadTicket =
  | { path: string; token: string; maxBytes: number }
  | { error: string };

/**
 * Resolve a scope to permission, a folder and a ceiling, or refuse it.
 *
 * Every branch derives the studio from a row it just READ under RLS rather
 * than from the session, so a caller cannot mint a ticket into a studio whose
 * row they cannot see.
 */
async function authorize(scope: UploadScope): Promise<Granted | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  switch (scope.kind) {
    case "project_asset": {
      // Readable when is_studio_member OR can_access_project (0056), so the
      // read proves the caller can SEE the project.
      const { data: project } = await supabase
        .from("projects")
        .select("id, studio_id")
        .eq("id", scope.projectId)
        .maybeSingle();
      if (!project) return { error: "You do not have access to this project." };

      // Seeing it is not enough. Since 0093 a project person can be a REVIEWER,
      // who reads and comments but does not change the job, and reading the row
      // above is something they can do. Asked of the DATABASE rather than
      // re-derived from the session, so the answer is the one every RLS policy
      // uses instead of a second rule that can drift away from it.
      const { data: canEdit } = await supabase.rpc("can_edit_project", {
        p_project_id: scope.projectId,
      });
      if (!canEdit) {
        return {
          error: "You have review access to this project, so you cannot upload files.",
        };
      }
      return {
        studioId: project.studio_id,
        folder: project.id,
        maxBytes: MAX_MEDIA_BYTES,
      };
    }

    // The remaining scopes are all is_studio_member tables, so a collaborator
    // cannot read them at all and the studio context IS the authorization.
    // They are listed separately rather than collapsed into one default,
    // because a default is how the next scope gets added without anybody
    // deciding what it should be allowed to do.
    case "agreement":
      return {
        studioId: ctx.studio.id,
        folder: "agreements",
        maxBytes: MAX_DOCUMENT_BYTES,
      };

    case "billing_doc": {
      // Read first: it proves the document is in the caller's studio, so a
      // ticket cannot be minted against another studio's document id.
      const { data: doc } = await supabase
        .from("billing_documents")
        .select("id, studio_id")
        .eq("id", scope.docId)
        .maybeSingle();
      if (!doc) return { error: "That document could not be found." };
      return {
        studioId: doc.studio_id,
        folder: `billing/${doc.id}`,
        maxBytes: MAX_DOCUMENT_BYTES,
      };
    }

    case "cost": {
      // project_costs is is_studio_member ONLY (0070), deliberately not opened
      // to collaborators, so reading the project is not the right check here.
      // The studio comes from the context and the project only names a folder.
      const { data: project } = await supabase
        .from("projects")
        .select("id, studio_id")
        .eq("id", scope.projectId)
        .eq("studio_id", ctx.studio.id)
        .maybeSingle();
      if (!project) return { error: "You do not have access to this project." };
      return {
        studioId: project.studio_id,
        folder: `costs/${project.id}`,
        maxBytes: MAX_DOCUMENT_BYTES,
      };
    }

    case "board": {
      const { data: board } = await supabase
        .from("boards")
        .select("id, studio_id")
        .eq("id", scope.boardId)
        .maybeSingle();
      if (!board) return { error: "That board could not be found." };
      return {
        studioId: board.studio_id,
        folder: `boards/${board.id}`,
        maxBytes: MAX_IMAGE_BYTES,
      };
    }
  }
}

/**
 * Mint a one-shot upload URL for a file the browser is about to send.
 *
 * `declaredBytes` is what the browser SAYS the file is. It is checked here so
 * an oversized file is refused before it is uploaded rather than after, which
 * is the difference between a message and a wasted ten minutes on a phone.
 * It is not trusted: finalizeUpload checks the real size afterwards.
 */
export async function mintUploadTicket(
  scope: UploadScope,
  fileName: string,
  declaredBytes: number
): Promise<UploadTicket> {
  const granted = await authorize(scope);
  if ("error" in granted) return granted;

  if (Number.isFinite(declaredBytes) && declaredBytes > granted.maxBytes) {
    return { error: overLimit(declaredBytes, granted.maxBytes) };
  }

  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${granted.studioId}/${granted.folder}/${crypto.randomUUID()}-${safe}`;

  const { data, error } = await assetStorage().createSignedUploadUrl(path);
  if (error || !data) {
    reportError("mintUploadTicket", error);
    return { error: error?.message ?? "Could not start the upload." };
  }
  // The path is returned as WE built it, not as the storage layer echoes it
  // back, so the caller stores exactly what was authorized.
  return { path, token: data.token, maxBytes: granted.maxBytes };
}

export type FinalizedUpload =
  | { size: number; mimeType: string | null }
  | { error: string };

/**
 * Confirm what actually landed, before any row points at it.
 *
 * IT RE-AUTHORIZES, and that is the important half. The browser hands the path
 * BACK to whichever action writes the row, and a first draft of this took that
 * path on trust. A caller could then have passed any path at all, including
 * another studio's file, and had their own row point at it, which
 * getAgreementFileUrl and its siblings would happily sign. Running the same
 * authorize() the ticket ran, and refusing a path that is not the shape it
 * would have minted, closes that. The path is data from the browser, so it is
 * checked like data from the browser.
 *
 * IT ALSO CHECKS THE REAL SIZE. The server never sees the bytes on a direct
 * upload, so the size the browser declared when it asked for a ticket is a
 * claim rather than a fact. This reads the object's true size back from
 * Storage and deletes anything over the ceiling on the way out, so a rejected
 * file does not sit in the bucket.
 *
 * Call it between the upload and the insert. The insert is the commit point:
 * until it succeeds nothing references the file, so any failure here is
 * cleaned up rather than left as an orphan.
 */
export async function finalizeUpload(
  scope: UploadScope,
  path: string
): Promise<FinalizedUpload> {
  const granted = await authorize(scope);
  if ("error" in granted) return granted;

  // Exactly the shape mintUploadTicket would have built. A forged path fails
  // here rather than becoming somebody else's document.
  if (!pathWithinScope(path, granted.studioId, granted.folder)) {
    reportError("finalizeUpload.path", new Error(`path outside scope: ${path}`));
    return { error: "That upload could not be verified." };
  }

  const maxBytes = granted.maxBytes;
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  const { data, error } = await assetStorage().list(folder, {
    limit: 1,
    search: name,
  });
  if (error) {
    reportError("finalizeUpload.list", error);
    return { error: "Could not confirm the upload. Try again." };
  }
  const object = data?.find((o) => o.name === name);
  if (!object) return { error: "The upload did not complete. Try again." };

  const size = Number(object.metadata?.size ?? 0);
  const mimeType = (object.metadata?.mimetype as string | undefined) ?? null;

  if (size > maxBytes) {
    await discardUpload(path);
    return { error: overLimit(size, maxBytes) };
  }
  return { size, mimeType };
}

/**
 * Remove a file nothing points at.
 *
 * Used when the row insert after an upload fails, and by the client when a
 * flow is abandoned mid-way. Swallowed on failure: the row was never written,
 * so what is left is waste rather than a leak, and reporting it is more useful
 * than failing the caller's actual operation.
 */
export async function discardUpload(path: string): Promise<void> {
  const { error } = await assetStorage().remove([path]);
  if (error) reportError("discardUpload", error);
}

function overLimit(bytes: number, max: number): string {
  return `That file is ${mb(bytes)}, over the ${mb(max)} limit for this kind of upload.`;
}

function mb(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
  return `${Math.round(bytes / 1_000_000)}MB`;
}
