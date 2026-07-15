"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | null;

function siteOrigin() {
  const h = headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    h.get("origin") ??
    `https://${h.get("host") ?? "localhost:3000"}`
  );
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Join any studio or project that invited this email (no-op if none).
  await supabase.rpc("claim_pending_invites");
  await supabase.rpc("claim_pending_project_invites");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const studioName = String(formData.get("studio_name") ?? "").trim();
  // Set when signing up from an invite link: the user joins an existing studio
  // rather than creating their own, so studio name is not required.
  const inviteToken = String(formData.get("invite_token") ?? "").trim();

  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!inviteToken && !studioName) return { error: "Give your studio a name." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Only carry a studio name when creating a new studio; an invited user
      // has none (the bootstrap trigger skips personal-studio creation).
      data: inviteToken ? {} : { studio_name: studioName },
      emailRedirectTo: `${siteOrigin()}/auth/confirm`,
    },
  });
  if (error) return { error: error.message };

  // If email confirmation is disabled the user is signed in immediately.
  if (data.session) {
    if (inviteToken) {
      await supabase.rpc("claim_pending_invites");
      await supabase.rpc("claim_pending_project_invites");
    }
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return {
    message: inviteToken
      ? "Account created. Check your email to confirm, then sign in to join the team."
      : "Studio created. Check your email to confirm your account, then sign in.",
  };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = createClient();
  // The recovery link lands on /auth/confirm, which verifies the OTP (creating
  // a short-lived session) and forwards to /reset-password to set a new one.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin()}/auth/confirm?next=/reset-password`,
  });

  // Always report success so the form never reveals whether an account exists.
  return {
    message:
      "If an account exists for that email, a reset link is on its way. Check your inbox.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The passwords do not match." };

  const supabase = createClient();
  // Requires the recovery session set by the email link. Without it, updateUser
  // fails and we send the user back to request a fresh link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: "This reset link has expired. Request a new one from Forgot password.",
    };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteOrigin()}/auth/confirm` },
  });

  // Generic success, same non-disclosure reasoning as password reset.
  return {
    message:
      "If that email needs confirming, a new link is on its way. Check your inbox.",
  };
}
