"use client";

import { useTransition } from "react";
import {
  disconnectEmailAccount,
  disconnectFreshbooks,
} from "@/app/(app)/settings/connections-actions";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";

export type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
};

type ProviderMeta = {
  key: string;
  label: string;
  glyph: string;
  startPath: string;
  blurb: string;
};

const PROVIDERS: ProviderMeta[] = [
  {
    key: "google",
    label: "Google",
    glyph: "G",
    startPath: "/auth/google/start",
    blurb:
      "Bring Gmail email (with attachment import), Google Chat spaces, Google Drive files, and your Google Calendar into the app, tied to the right job. Reconnect to grant new access.",
  },
  {
    key: "slack",
    label: "Slack",
    glyph: "S",
    startPath: "/auth/slack/start",
    blurb:
      "Bring Slack conversations into the Communication hub, tied to the right job.",
  },
  {
    key: "figma",
    label: "Figma",
    glyph: "F",
    startPath: "/auth/figma/start",
    blurb:
      "Import frames from a Figma file straight into a project's assets, rendered as images.",
  },
];

function AccountRow({ account }: { account: ConnectedAccount }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-text">
          {account.email}
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

function FreshbooksConnection({
  configured,
  connectedEmail,
}: {
  configured: boolean;
  connectedEmail: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-sm font-bold"
          style={{ backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }}
        >
          FB
        </span>
        <div>
          <div className="text-sm font-semibold text-text">FreshBooks</div>
          <div className="text-xs text-text-faint">
            Create and send invoices from a project, then track paid status. Your
            invoice template, payments, and books stay in FreshBooks.
          </div>
        </div>
      </div>

      {connectedEmail !== null && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border px-3 py-2.5">
          <div className="min-w-0 truncate text-sm font-semibold text-text">
            {connectedEmail || "FreshBooks account"}
          </div>
          <div className="flex items-center gap-2">
            <StatusTag hue="green">Connected</StatusTag>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => start(() => disconnectFreshbooks())}
            >
              {pending ? "..." : "Disconnect"}
            </Button>
          </div>
        </div>
      )}

      {configured ? (
        connectedEmail === null && (
          <a
            href="/auth/freshbooks/start"
            className="inline-flex items-center gap-2 rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            Connect FreshBooks
          </a>
        )
      ) : (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-yellow">
          FreshBooks is not configured yet. Add its OAuth credentials (see docs)
          to enable it.
        </p>
      )}
    </div>
  );
}

export function Connections({
  configured,
  accounts,
  freshbooks,
}: {
  configured: Record<string, boolean>;
  accounts: ConnectedAccount[];
  freshbooks: { connectedEmail: string | null };
}) {
  return (
    <div className="space-y-6">
      {PROVIDERS.map((p) => {
        const mine = accounts.filter((a) => a.provider === p.key);
        const isConfigured = Boolean(configured[p.key]);
        return (
          <div key={p.key} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border bg-surface-2 text-sm font-bold text-text-muted">
                {p.glyph}
              </span>
              <div>
                <div className="text-sm font-semibold text-text">{p.label}</div>
                <div className="text-xs text-text-faint">{p.blurb}</div>
              </div>
            </div>

            {mine.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}

            {isConfigured ? (
              <a
                href={p.startPath}
                className="inline-flex items-center gap-2 rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
              >
                {mine.length > 0 ? `Connect another ${p.label}` : `Connect ${p.label}`}
              </a>
            ) : (
              <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-yellow">
                {p.label} is not configured yet. Add its OAuth credentials (see
                docs) to enable it.
              </p>
            )}
          </div>
        );
      })}

      <FreshbooksConnection
        configured={Boolean(configured.freshbooks)}
        connectedEmail={freshbooks.connectedEmail}
      />
    </div>
  );
}
