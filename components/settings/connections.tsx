"use client";

import { useTransition } from "react";
import { disconnectEmailAccount } from "@/app/(app)/settings/connections-actions";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";

export type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
};

function GoogleGlyph() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border bg-surface-2 text-sm font-bold text-text-muted">
      G
    </span>
  );
}

function AccountRow({ account }: { account: ConnectedAccount }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <GoogleGlyph />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">
            {account.email}
          </div>
          <div className="text-xs text-text-faint">Gmail</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusTag hue="green">Connected</StatusTag>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => start(() => disconnectEmailAccount(account.id))}
        >
          {pending ? "..." : "Disconnect"}
        </Button>
      </div>
    </div>
  );
}

export function Connections({
  configured,
  accounts,
}: {
  configured: boolean;
  accounts: ConnectedAccount[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Connect Gmail to bring a project&apos;s email into the app and pull
        attachments straight into its assets. Read access only for now.
      </p>

      {accounts.length > 0 &&
        accounts.map((a) => <AccountRow key={a.id} account={a} />)}

      {configured ? (
        <a
          href="/auth/google/start"
          className="inline-flex items-center gap-2 rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
        >
          <span className="grid h-4 w-4 place-items-center rounded bg-accent-fg text-[10px] font-bold text-accent">
            G
          </span>
          {accounts.length > 0 ? "Connect another account" : "Connect Gmail"}
        </a>
      ) : (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-yellow">
          Gmail connection is not configured yet. Add the Google OAuth
          credentials (see docs) to enable it.
        </p>
      )}
    </div>
  );
}
