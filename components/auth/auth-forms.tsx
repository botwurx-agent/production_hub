"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  signIn,
  signUp,
  requestPasswordReset,
  updatePassword,
  resendConfirmation,
  type AuthState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Working..." : label}
    </Button>
  );
}

function Feedback({ state }: { state: AuthState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="rounded-[10px] bg-green-bg px-3 py-2 text-sm font-medium text-green">
        {state.message}
      </p>
    );
  }
  return null;
}

const LOGIN_ERRORS: Record<string, string> = {
  confirmation_failed:
    "That confirmation link did not work. It may have expired. Resend it below.",
  auth_failed: "That sign-in link did not work. Try signing in again.",
};

export function LoginForm({ errorCode }: { errorCode?: string } = {}) {
  const [state, action] = useFormState(signIn, null);
  const notice = errorCode ? LOGIN_ERRORS[errorCode] : undefined;
  const showResend = errorCode === "confirmation_failed";
  return (
    <Card className="p-7">
      <h1 className="font-display text-xl font-extrabold">Welcome back</h1>
      <p className="mt-1 text-sm text-text-muted">
        Sign in to your studio workspace.
      </p>
      {notice && (
        <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {notice}
        </p>
      )}
      <form action={action} className="mt-6 space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-text-muted hover:text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Feedback state={state} />
        <SubmitButton label="Sign in" />
      </form>
      <p className="mt-5 text-center text-sm text-text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          Create a studio
        </Link>
      </p>
      {showResend && (
        <div className="mt-5 border-t border-border pt-5">
          <ResendConfirmationForm />
        </div>
      )}
    </Card>
  );
}

export function ResendConfirmationForm() {
  const [state, action] = useFormState(resendConfirmation, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm font-medium text-text">Resend confirmation email</p>
      <Field label="Email" htmlFor="resend-email">
        <Input
          id="resend-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </Field>
      <Feedback state={state} />
      <SubmitButton label="Resend confirmation" />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordReset, null);
  return (
    <Card className="p-7">
      <h1 className="font-display text-xl font-extrabold">Reset your password</h1>
      <p className="mt-1 text-sm text-text-muted">
        Enter your email and we will send you a link to set a new password.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Feedback state={state} />
        <SubmitButton label="Send reset link" />
      </form>
      <p className="mt-5 text-center text-sm text-text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useFormState(updatePassword, null);
  return (
    <Card className="p-7">
      <h1 className="font-display text-xl font-extrabold">Set a new password</h1>
      <p className="mt-1 text-sm text-text-muted">
        Choose a new password for your account.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Feedback state={state} />
        <SubmitButton label="Update password" />
      </form>
    </Card>
  );
}

export function SignupForm({
  inviteToken,
  inviteEmail,
  studioName,
}: {
  inviteToken?: string;
  inviteEmail?: string;
  studioName?: string;
} = {}) {
  const [state, action] = useFormState(signUp, null);
  const invited = Boolean(inviteToken);
  return (
    <Card className="p-7">
      <h1 className="font-display text-xl font-extrabold">
        {invited ? `Join ${studioName ?? "the studio"}` : "Create your studio"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        {invited
          ? "Set a password to accept your invite."
          : "Set up your workspace in under a minute."}
      </p>
      <form action={action} className="mt-6 space-y-4">
        {invited ? (
          <input type="hidden" name="invite_token" value={inviteToken} />
        ) : (
          <Field label="Studio name" htmlFor="studio_name">
            <Input
              id="studio_name"
              name="studio_name"
              type="text"
              placeholder="e.g. Northlight Studios"
              required
            />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={inviteEmail}
            readOnly={invited}
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Feedback state={state} />
        <SubmitButton label={invited ? "Join studio" : "Create studio"} />
      </form>
      {!invited && (
        <p className="mt-5 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </Card>
  );
}
