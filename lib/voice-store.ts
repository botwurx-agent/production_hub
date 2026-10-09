import "server-only";
import { randomUUID } from "node:crypto";
import { assetStorage } from "@/lib/asset-storage";
import { MAX_VOICE_BYTES, voiceExt, voiceMime } from "@/lib/voice-note";

/**
 * Store a recorded voice note in `folder` and return its path. The SERVER
 * names the file, so the browser cannot choose where it lands, and the comment
 * actions later accept a path only from that same folder.
 */
export async function storeVoice(
  form: FormData,
  folder: string
): Promise<{ path: string } | { error: string }> {
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "No recording arrived." };
  const mime = voiceMime(file.type);
  if (!mime) return { error: "That recording format is not supported." };
  if (file.size === 0) return { error: "The recording is empty." };
  if (file.size > MAX_VOICE_BYTES) return { error: "That recording is too long." };
  const path = `${folder}${randomUUID().replace(/-/g, "")}.${voiceExt(mime)}`;
  const { error } = await assetStorage().upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (error) return { error: "The recording could not be saved." };
  return { path };
}
