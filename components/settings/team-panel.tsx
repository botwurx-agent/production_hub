"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusTag, type Hue } from "@/components/status-tag";
import {
  inviteMember,
  revokeInvite,
  changeMemberRole,
  removeMember,
} from "@/app/(app)/settings/team-actions";
import type { MembershipRole } from "@/lib/database.types";

const roleHue: Record<string, Hue> = {
  owner: "indigo",
  admin: "purple",
  member: "blue",
};

type Member = { id: string; role: MembershipRole; email: string | null; isSelf: boolean };
type Pending = { id: string; email: string; role: MembershipRole; token: string };

export function TeamPanel({
  members,
  pending,
  canManage,
}: {
  members: Member[];
  pending: Pending[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("member");
  const [err, setErr] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkFor = (token: string) => `${origin}/invite/${token}`;

  function copy(token: string) {
    navigator.clipboard?.writeText(linkFor(token)).then(
      () => {
        setCopied(token);
        setTimeout(() => setCopied((c) => (c === token ? null : c)), 1800);
      },
      () => {}
    );
  }

  function invite() {
    setErr(null);
    setLastToken(null);
    start(async () => {
      const res = await inviteMember(email, role);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      if (res?.token) {
        setLastToken(res.token);
        copy(res.token);
      }
      setEmail("");
      router.refresh();
    });
  }

  function setMemberRole(id: string, r: MembershipRole) {
    start(async () => {
      await changeMemberRole(id, r);
      router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      await removeMember(id);
      router.refresh();
    });
  }
  function revoke(id: string) {
    start(async () => {
      await revokeInvite(id);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        {members.length} member{members.length === 1 ? "" : "s"}
        {pending.length > 0 ? ` · ${pending.length} pending` : ""} in this studio.
      </p>

      {/* Members */}
      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-border px-3 py-2.5"
          >
            <span className="min-w-0 truncate text-sm font-medium text-text">
              {m.email ?? "Team member"}
              {m.isSelf && <span className="text-text-faint"> (you)</span>}
            </span>
            <div className="flex items-center gap-2">
              {canManage && !m.isSelf && m.role !== "owner" ? (
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => setMemberRole(m.id, e.target.value as MembershipRole)}
                  className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold text-text"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              ) : (
                <StatusTag hue={roleHue[m.role] ?? "blue"}>{m.role}</StatusTag>
              )}
              {canManage && !m.isSelf && m.role !== "owner" && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={busy}
                  className="text-xs font-semibold text-text-faint transition hover:text-red disabled:opacity-50"
                  title="Remove from studio"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
            Pending invites
          </p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-dashed border-border px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-text">
                  {p.email}
                  <span className="ml-2 text-xs font-normal text-text-faint">
                    invited as {p.role}
                  </span>
                </span>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copy(p.token)}
                      className="rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text"
                    >
                      {copied === p.token ? "Copied" : "Copy link"}
                    </button>
                    <button
                      onClick={() => revoke(p.id)}
                      disabled={busy}
                      className="text-xs font-semibold text-text-faint transition hover:text-red disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form */}
      {canManage && (
        <div className="mt-5 rounded-[12px] border border-border bg-surface-2/40 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
            Invite a teammate
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="teammate@studio.com"
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MembershipRole)}
              className="rounded-[10px] border border-border bg-surface px-2 py-2 text-sm font-semibold text-text"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={invite}
              disabled={busy || !email.trim()}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
            >
              {busy ? "Working…" : "Invite"}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Members can view and work on every project. Admins can also manage the
            team. We generate a private invite link you send them; it&apos;s copied to
            your clipboard automatically.
          </p>
          {lastToken && (
            <div className="mt-2 flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-2 sm:flex-row sm:items-center">
              <input
                readOnly
                value={linkFor(lastToken)}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-xs text-text outline-none"
              />
              <button
                onClick={() => copy(lastToken)}
                className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
              >
                {copied === lastToken ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          {err && (
            <p className="mt-2 rounded-[9px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
