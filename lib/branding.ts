import "server-only";
import { createClient } from "@/lib/supabase/server";

// Signs a studio logo path (stored in the private assets bucket) for display.
export async function signedLogoUrl(
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath) return null;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("assets")
    .createSignedUrl(logoPath, 60 * 60);
  return data?.signedUrl ?? null;
}
