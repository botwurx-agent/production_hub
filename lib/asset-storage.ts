import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";

// Storage accessor for the private "assets" bucket that works for BOTH full
// studio members and project collaborators.
//
// The bucket policy is scoped to the studio folder (is_studio_member), so a
// project collaborator (who has no membership) can't sign or upload through the
// RLS client. Access is already enforced one layer up: every read signs paths
// that came from an RLS-authorized data row (assets/boards/etc., opened to
// collaborators in migration 0056), and every server-side upload is followed by
// an RLS-gated row insert. So using the service role here only bypasses the
// studio-folder storage policy, never a project boundary.
//
// Falls back to the RLS client when the service key is not configured (members
// still work locally; collaborators need the key set, as in production).
export function assetStorage() {
  const client = serviceConfigured() ? createServiceClient() : createClient();
  return client.storage.from("assets");
}
