import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { getValidLink } from "@/lib/review-links";

// Token-guarded file proxy for the client review portal. Validates the review
// link, confirms the requested version belongs to that link's asset, then
// streams the private file's bytes. Storage paths are never exposed to the
// client, and only files behind a valid link are reachable.
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!serviceConfigured()) {
    return new NextResponse("Review portal is not configured.", { status: 503 });
  }

  const service = createServiceClient();
  const link = await getValidLink(service, params.token);
  if (!link) {
    return new NextResponse("This review link is not available.", {
      status: 404,
    });
  }
  // This proxy only serves asset/version files; doc links carry no asset.
  const assetId = link.asset_id;
  if (!assetId) {
    return new NextResponse("This link has no file.", { status: 404 });
  }

  const requestedVersion = request.nextUrl.searchParams.get("v");

  // Resolve which version to serve, always constrained to the link's asset.
  let versionId = requestedVersion;
  if (!versionId) {
    const { data: asset } = await service
      .from("assets")
      .select("current_version_id")
      .eq("id", assetId)
      .maybeSingle();
    versionId = asset?.current_version_id ?? null;
  }
  if (!versionId) {
    return new NextResponse("No file for this asset.", { status: 404 });
  }

  const { data: version } = await service
    .from("versions")
    .select("storage_path, mime_type")
    .eq("id", versionId)
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!version?.storage_path) {
    return new NextResponse("File not found.", { status: 404 });
  }

  // Redirect to a short-lived signed URL rather than streaming the bytes through
  // this function. Supabase's storage endpoint honors HTTP Range requests, so the
  // browser can SEEK/scrub a video accurately (the old whole-file 200 response
  // made seeking impossible — the playhead wouldn't move). It also stops loading
  // entire videos into server memory. Access is still gated: we only sign a path
  // after validating the token + that the version belongs to the link's asset.
  const { data: signed, error } = await service.storage
    .from("assets")
    .createSignedUrl(version.storage_path, 60 * 60);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not load the file.", { status: 502 });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
