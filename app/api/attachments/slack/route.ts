import { getStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { getSlackFileBytes } from "@/lib/slack";

export const dynamic = "force-dynamic";

function disposition(name: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${safe}"`;
}

// Only fetch from Slack's own file hosts. The download URL becomes an
// authenticated fetch with the Slack token, so we must not let it point
// anywhere else (SSRF / token leak).
function isSlackFileUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (u.hostname === "files.slack.com" || u.hostname.endsWith(".slack.com"))
    );
  } catch {
    return false;
  }
}

// Streams a Slack file to the browser as a download. Authenticated and
// studio-scoped; bytes fetched server-side with the connected Slack token.
export async function GET(request: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get("url");
  const filename = searchParams.get("filename") || "file";
  const mime = searchParams.get("mime") || "application/octet-stream";
  // Inline mode is used for image thumbnails in the attachment grid.
  const inline = searchParams.get("disp") === "inline";
  if (!fileUrl || !isSlackFileUrl(fileUrl))
    return new Response("Invalid file URL", { status: 400 });

  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("access_token")
    .eq("provider", "slack")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account?.access_token)
    return new Response("Slack not connected", { status: 400 });

  try {
    const bytes = await getSlackFileBytes(account.access_token, fileUrl);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": inline ? "inline" : disposition(filename),
        "Content-Length": String(bytes.length),
        "Cache-Control": inline ? "private, max-age=600" : "private, no-store",
      },
    });
  } catch {
    return new Response("Could not fetch file", { status: 502 });
  }
}
