"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ACTIVE_STUDIO_COOKIE } from "@/lib/active-studio";

export type SwitchState = { error?: string } | null;

// Switches which studio the user is working in. Verifies membership first so
// the cookie can never name a studio they do not belong to (RLS would block the
// data anyway, but a wrong cookie would leave them staring at an empty app with
// no explanation). The caller navigates afterwards: ids from the previous
// studio are meaningless here, so staying on the current page is not safe.
export async function switchStudio(studioId: string): Promise<SwitchState> {
  const ctx = await requireStudioContext();

  if (studioId === ctx.studio.id) return null;

  const supabase = createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("studio_id", studioId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!membership) return { error: "You are not a member of that studio." };

  cookies().set(ACTIVE_STUDIO_COOKIE, studioId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return null;
}
