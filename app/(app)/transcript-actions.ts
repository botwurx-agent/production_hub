"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { allow } from "@/lib/rate-limit";
import { reportError } from "@/lib/log";
import { MAX_UPLOAD_BYTES } from "@/lib/attachment-limits";
import { transcribeWav, transcriptionConfigured, TRANSCRIBE_MODEL } from "@/lib/transcribe";
import { parseSegments, type Segment, type TranscriptData } from "@/lib/transcript";

/**
 * Transcripts of a version, from the app. Reads go through RLS (anyone on the
 * job); writing and transcribing need edit rights on the project, asked of
 * the database, the same rule the asset upload uses.
 */

async function versionProject(versionId: string) {
  const supabase = createClient();
  const { data: v } = await supabase
    .from("versions")
    .select("id, studio_id, asset:assets(project_id)")
    .eq("id", versionId)
    .maybeSingle();
  const projectId = (v as { asset?: { project_id?: string | null } | null } | null)?.asset
    ?.project_id;
  if (!v || !projectId) return null;
  return { supabase, studioId: v.studio_id, projectId };
}

async function editable(versionId: string) {
  const found = await versionProject(versionId);
  if (!found) return null;
  const { data: canEdit } = await found.supabase.rpc("can_edit_project", {
    p_project_id: found.projectId,
  });
  return canEdit ? found : null;
}

export async function getTranscript(
  versionId: string
): Promise<{ transcript: TranscriptData | null; canGenerate: boolean }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data } = await supabase
    .from("version_transcripts")
    .select("segments, language, duration, updated_at")
    .eq("version_id", versionId)
    .maybeSingle();
  const found = transcriptionConfigured() ? await editable(versionId) : null;
  return {
    transcript: data
      ? {
          segments: parseSegments(data.segments),
          language: data.language,
          duration: data.duration == null ? null : Number(data.duration),
          updatedAt: data.updated_at,
        }
      : null,
    canGenerate: Boolean(found),
  };
}

/** One piece of the soundtrack, already cut and encoded by the browser. */
export async function transcribePiece(
  versionId: string,
  form: FormData
): Promise<{ segments: Segment[]; language: string | null } | { error: string }> {
  const ctx = await requireStudioContext();
  if (!transcriptionConfigured()) return { error: "Transcription is not set up here." };
  if (!allow(`transcribe:${ctx.userId}`, 400, 60 * 60 * 1000)) {
    return { error: "Too many transcription requests. Try again in a while." };
  }
  if (!(await editable(versionId))) return { error: "You cannot transcribe this file." };
  const file = form.get("file");
  const offset = Number(form.get("offset"));
  const prompt = String(form.get("prompt") ?? "");
  if (!(file instanceof Blob) || file.size === 0) return { error: "No audio was sent." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That piece of audio is too large." };
  if (!Number.isFinite(offset) || offset < 0) return { error: "The piece had no start time." };
  try {
    return await transcribeWav(file, offset, prompt);
  } catch (e) {
    reportError("transcribePiece", e);
    return { error: "The transcription service did not answer. Try again." };
  }
}

/** Saves the whole transcript, or an edited one. Validated line by line. */
export async function saveTranscript(
  versionId: string,
  input: { segments: unknown; language?: string | null; duration?: number | null }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  const found = await editable(versionId);
  if (!found) return { error: "You cannot change this transcript." };
  const segments = parseSegments(input.segments);
  const duration =
    typeof input.duration === "number" && Number.isFinite(input.duration) && input.duration >= 0
      ? Math.min(input.duration, 999999)
      : null;
  const language =
    typeof input.language === "string" ? input.language.trim().slice(0, 40) || null : null;
  const { error } = await found.supabase.from("version_transcripts").upsert(
    {
      studio_id: found.studioId,
      project_id: found.projectId,
      version_id: versionId,
      segments,
      language,
      duration,
      model: TRANSCRIBE_MODEL,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "version_id" }
  );
  if (error) {
    reportError("saveTranscript", error);
    return { error: "The transcript could not be saved." };
  }
  return { ok: true };
}
