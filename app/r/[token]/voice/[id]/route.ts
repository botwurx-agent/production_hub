import { NextResponse } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { getValidLink } from "@/lib/review-links";
import { assetStorage } from "@/lib/asset-storage";

/**
 * Play a voice note on the client portal. The link must be live, the comment
 * must belong to what this link reviews (the same asset, or the same doc
 * target), and it must not be a team-only note, which the portal never sees.
 * Then a short-lived signed URL, so no storage path reaches the page.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string; id: string } }
) {
  if (!serviceConfigured()) return new NextResponse("Not configured.", { status: 503 });
  const service = createServiceClient();
  const link = await getValidLink(service, params.token);
  if (!link) return new NextResponse("Not available.", { status: 404 });

  const { data: c } = await service
    .from("review_comments")
    .select("audio_path, version_id, target_type, target_id, team_only")
    .eq("id", params.id)
    .maybeSingle();
  if (!c?.audio_path || c.team_only) return new NextResponse("Not found.", { status: 404 });

  let belongs = false;
  if (link.asset_id) {
    if (c.version_id) {
      const { data: v } = await service
        .from("versions")
        .select("asset_id")
        .eq("id", c.version_id)
        .maybeSingle();
      belongs = v?.asset_id === link.asset_id;
    }
  } else {
    belongs =
      c.target_type != null &&
      c.target_type === link.target_type &&
      c.target_id === link.target_id;
  }
  if (!belongs) return new NextResponse("Not found.", { status: 404 });

  const { data } = await assetStorage().createSignedUrl(c.audio_path, 60 * 10);
  if (!data?.signedUrl) return new NextResponse("Not available.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, 302);
}
