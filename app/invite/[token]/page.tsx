import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/auth/auth-forms";
import { AcceptInvite } from "@/components/auth/accept-invite";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Join a studio",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {children}
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const { data: rows } = await supabase.rpc("studio_invite_preview", {
    p_token: params.token,
  });
  const invite = Array.isArray(rows) ? rows[0] : null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!invite || !invite.valid) {
    return (
      <Shell>
        <Card className="p-7 text-center">
          <h1 className="font-display text-xl font-extrabold text-text">
            Invite not available
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            This invite link is invalid, was revoked, or has already been used. Ask
            the studio for a new one.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-accent hover:underline"
          >
            Go to sign in
          </Link>
        </Card>
      </Shell>
    );
  }

  const emailMismatch =
    user?.email &&
    user.email.toLowerCase() !== invite.invite_email.toLowerCase();

  // Signed in: accept directly.
  if (user) {
    return (
      <Shell>
        <Card className="p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            Studio invite
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-text">
            Join {invite.studio_name}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            You&apos;re signed in as <b className="text-text">{user.email}</b>. Accept
            to join <b className="text-text">{invite.studio_name}</b> as{" "}
            <b className="text-text">{invite.invite_role}</b>.
          </p>
          {emailMismatch && (
            <p
              className="mt-3 rounded-[10px] px-3 py-2 text-xs font-semibold"
              style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
            >
              This invite was sent to {invite.invite_email}. Accepting joins your
              current account only if it was also invited. To join as{" "}
              {invite.invite_email}, sign out and sign up with that email.
            </p>
          )}
          <div className="mt-5">
            <AcceptInvite />
          </div>
        </Card>
      </Shell>
    );
  }

  // Not signed in: sign up with the invited email (or sign in to auto-join).
  return (
    <Shell>
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          You&apos;re invited
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-text">
          Join {invite.studio_name}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {invite.invite_email} was invited as {invite.invite_role}. Create your
          account to accept.
        </p>
      </div>
      <SignupForm
        inviteToken={params.token}
        inviteEmail={invite.invite_email}
        studioName={invite.studio_name}
      />
      <p className="mt-5 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Sign in
        </Link>{" "}
        with {invite.invite_email} and you&apos;ll join automatically.
      </p>
    </Shell>
  );
}
