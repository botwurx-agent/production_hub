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

  const requestedVersion = request.nextUrl.searchParams.get("v");

  // Resolve which version to serve, always constrained to the link's asset.
  let versionId = requestedVersion;
  if (!versionId) {
    const { data: asset } = await service
      .from("assets")
      .select("current_version_id")
      .eq("id", link.asset_id)
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
    .eq("asset_id", link.asset_id)
    .maybeSingle();
  if (!version?.storage_path) {
    return new NextResponse("File not found.", { status: 404 });
  }

  const { data: blob, error } = await service.storage
    .from("assets")
    .download(version.storage_path);
  if (error || !blob) {
    return new NextResponse("Could not load the file.", { status: 502 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": version.mime_type || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
