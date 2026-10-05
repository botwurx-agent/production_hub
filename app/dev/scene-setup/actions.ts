"use server";

// Reads a location scout photo into a rough room for the Scene Setup
// prototype. The photo is sent to the studio's configured AI provider, the
// same path the invoice and SOW readers use, and the answer comes back as a
// clamped DRAFT the producer reviews before anything is built.
import { requireStudioContext } from "@/lib/studio";
import { aiConfigured, extractRoomFromPhoto } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/attachment-limits";
import { ROOM_KINDS, parseRoomDraft, type RoomDraft } from "@/lib/previz/room-draft";

export async function readScoutPhoto(input: { base64: string; mediaType: string; fileName: string }): Promise<{ draft: RoomDraft } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only studio members can use this." };
  if (!aiConfigured()) return { error: "No AI provider is set up on this deployment, so the photo cannot be read." };
  if (!/^image\/(jpeg|png|webp)$/.test(input.mediaType)) return { error: "Use a JPEG, PNG or WebP photo." };
  if (input.base64.length * 0.75 > MAX_UPLOAD_BYTES) return { error: "That photo is too large to send. Try a smaller one." };
  try {
    const raw = await extractRoomFromPhoto(
      { base64: input.base64, mediaType: input.mediaType, fileName: input.fileName.slice(0, 120) },
      ROOM_KINDS,
    );
    const draft = parseRoomDraft(raw);
    if (!draft) return { error: "The photo could not be read as a room. Try one taken from a corner, showing the floor." };
    return { draft };
  } catch (e) {
    return { error: e instanceof Error ? `Could not read the photo: ${e.message.slice(0, 200)}` : "Could not read the photo." };
  }
}
