import "server-only";
import { parseWhisper, type Segment } from "@/lib/transcript";

/**
 * Speech to text for review transcripts. OpenAI only: Anthropic has no
 * transcription endpoint, so this is gated on the OpenAI key specifically
 * rather than on aiConfigured(), which an Anthropic-only deployment passes.
 *
 * whisper-1 is the default because it is the model that returns TIMESTAMPED
 * segments (verbose_json); the gpt-4o transcribe models return text only, and
 * a transcript nobody can click to a moment is not what this is for.
 */
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export function transcriptionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeWav(
  wav: Blob,
  offset: number,
  prompt: string
): Promise<{ segments: Segment[]; language: string | null }> {
  const form = new FormData();
  form.append("file", wav, "piece.wav");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (prompt) form.append("prompt", prompt.slice(-800));
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
  return parseWhisper(await res.json(), offset);
}
