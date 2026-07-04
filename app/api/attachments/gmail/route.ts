import { getStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { getAccessToken, getAttachmentBytes } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Content-Disposition filename: keep it to safe ASCII to avoid header issues.
function disposition(name: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${safe}"`;
}

// Streams a Gmail attachment to the browser as a download. Authenticated and
// studio-scoped; the bytes are fetched server-side with the connected account.
export async function GET(request: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("message");
  const attachmentId = searchParams.get("attachment");
  const filename = searchParams.get("filename") || "attachment";
  const mime = searchParams.get("mime") || "application/octet-stream";
  if (!messageId || !attachmentId)
    return new Response("Missing parameters", { status: 400 });

  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return new Response("Gmail not connected", { status: 400 });

  try {
    const token = await getAccessToken(supabase, account);
    const bytes = await getAttachmentBytes(token, messageId, attachmentId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": disposition(filename),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Could not fetch attachment", { status: 502 });
  }
}
