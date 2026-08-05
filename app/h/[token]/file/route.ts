import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { resolveHandoffFile } from "@/lib/editor-handoff";

/**
 * Token-guarded download for the editor handoff.
 *
 * Redirects to a short-lived signed URL rather than streaming bytes through the
 * function, the same as the review portal's proxy: video files are large, and
 * Supabase's storage endpoint honours Range requests. The `download` parameter
 * makes storage set Content-Disposition, so the file lands with the numbered
 * name instead of a uuid.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!serviceConfigured()) {
    return new NextResponse("Not configured.", { status: 503 });
  }

  const generationId = request.nextUrl.searchParams.get("g");
  if (!generationId) {
    return new NextResponse("Missing file.", { status: 400 });
  }

  const file = await resolveHandoffFile(params.token, generationId);
  if (!file) {
    return new NextResponse("This link is not available.", { status: 404 });
  }

  const service = createServiceClient();
  const { data: signed, error } = await service.storage
    .from("assets")
    .createSignedUrl(file.path, 60 * 60, { download: file.filename });
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not load the file.", { status: 502 });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
