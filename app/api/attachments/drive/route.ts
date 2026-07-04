import { getStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { getAccessToken } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Drive thumbnail links live on Google's own hosts and must be fetched with the
// user's access token. Restrict to those hosts so the authenticated fetch can't
// be pointed elsewhere (SSRF / token leak).
function isGoogleThumb(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (u.hostname.endsWith(".googleusercontent.com") ||
        u.hostname.endsWith(".google.com") ||
        u.hostname === "drive.google.com")
    );
  } catch {
    return false;
  }
}

// Proxies a Google Drive thumbnail to the browser as an image. Authenticated
// and studio-scoped; bytes fetched server-side with the connected Google token.
export async function GET(request: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url || !isGoogleThumb(url))
    return new Response("Invalid thumbnail URL", { status: 400 });

  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return new Response("Google not connected", { status: 400 });

  try {
    const token = await getAccessToken(supabase, account);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new Response("Thumbnail unavailable", { status: 502 });
    const bytes = Buffer.from(await res.arrayBuffer());
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Content-Length": String(bytes.length),
        // Short private cache so reopening the picker is snappy.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch {
    return new Response("Could not fetch thumbnail", { status: 502 });
  }
}
