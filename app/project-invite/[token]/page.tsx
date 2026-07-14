import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/auth/auth-forms";
import { AcceptProjectInvite } from "@/components/auth/accept-project-invite";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Join a project",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {children}
    </div>
  );
}

export default async function ProjectInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const { data: rows } = await supabase.rpc("project_invite_preview", {
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
            This project invite is invalid, was revoked, or has already been used.
            Ask the studio for a new one.
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

  // Signed in: accept directly.
  if (user) {
    return (
      <Shell>
        <Card className="p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            Project invite
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-text">
            Join {invite.project_title}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            You&apos;re signed in as <b className="text-text">{user.email}</b>. Accept
            to collaborate on <b className="text-text">{invite.project_title}</b> at{" "}
            <b className="text-text">{invite.studio_name}</b>. You&apos;ll only see this
            project, not the rest of the studio.
          </p>
          <div className="mt-5">
            <AcceptProjectInvite />
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
          Join {invite.project_title}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {invite.invite_email} was invited to collaborate on{" "}
          {invite.project_title} at {invite.studio_name}. Create your account to
          accept.
        </p>
      </div>
      <SignupForm
        inviteToken={params.token}
        inviteEmail={invite.invite_email}
        studioName={invite.project_title}
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
