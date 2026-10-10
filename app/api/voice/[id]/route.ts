import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";

/**
 * Play a voice note in the app. The comment is read through the signed-in
 * client, so RLS on review_comments (studio member or somebody on the
 * project) is the whole access check: a row this user cannot read answers
 * 404. Then a short-lived signed URL, so no storage path reaches the page.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: c } = await supabase
    .from("review_comments")
    .select("audio_path")
    .eq("id", params.id)
    .maybeSingle();
  if (!c?.audio_path) return new NextResponse("Not found.", { status: 404 });
  const { data } = await assetStorage().createSignedUrl(c.audio_path, 60 * 10);
  if (!data?.signedUrl) return new NextResponse("Not available.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, 302);
}
