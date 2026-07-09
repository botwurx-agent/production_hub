"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
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

export function LoginForm() {
  const [state, action] = useFormState(signIn, null);
  return (
    <Card className="p-7">
      <h1 className="font-display text-xl font-extrabold">Welcome back</h1>
      <p className="mt-1 text-sm text-text-muted">
        Sign in to your studio workspace.
      </p>
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
        <Feedback state={state} />
        <SubmitButton label="Sign in" />
      </form>
      <p className="mt-5 text-center text-sm text-text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          Create a studio
        </Link>
      </p>
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
