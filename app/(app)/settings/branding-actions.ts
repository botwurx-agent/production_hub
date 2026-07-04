"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type BrandingState = { error?: string } | null;

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "logo";
}

export async function uploadStudioLogo(
  formData: FormData
): Promise<BrandingState> {
  const ctx = await requireStudioContext();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only studio admins can change the logo." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (!file.type.startsWith("image/")) return { error: "Logo must be an image." };
  if (file.size > 3_000_000) return { error: "Logo must be under 3MB." };

  const supabase = createClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.studio.id}/branding/logo-${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, bytes, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: upErr.message };

  const { error } = await supabase
    .from("studios")
    .update({ logo_path: path })
    .eq("id", ctx.studio.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return null;
}

export async function removeStudioLogo(): Promise<BrandingState> {
  const ctx = await requireStudioContext();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only studio admins can change the logo." };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("studios")
    .update({ logo_path: null })
    .eq("id", ctx.studio.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return null;
}
