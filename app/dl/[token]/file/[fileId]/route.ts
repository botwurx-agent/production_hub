import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { liveDeliveryLink } from "@/lib/delivery-links";
import { allowPublic } from "@/lib/rate-limit";

/**
 * Download one final deliverable from the client's delivery link. The link
 * must be live and the file must belong to the link's project; only then is
 * a short-lived URL signed, WITH the file's name so it downloads rather than
 * opening in a tab. Nothing about storage reaches the browser before that.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string; fileId: string } }
) {
  if (!allowPublic("delivery-download", 120)) {
    return new NextResponse("Too many downloads at once. Wait a minute and try again.", { status: 429 });
  }
  const link = await liveDeliveryLink(params.token);
  if (!link) return new NextResponse("This link is not available.", { status: 404 });

  const service = createServiceClient();
  const { data: file } = await service
    .from("delivery_files")
    .select("storage_path, file_name")
    .eq("id", params.fileId)
    .eq("project_id", link.project_id)
    .maybeSingle();
  if (!file) return new NextResponse("File not found.", { status: 404 });

  const name = file.file_name.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim() || "file";
  const { data: signed, error } = await service.storage
    .from("assets")
    .createSignedUrl(file.storage_path, 60 * 60, { download: name });
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not load the file.", { status: 502 });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
