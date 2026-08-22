"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  inviteToProject,
  revokeProjectInvite,
  removeProjectMember,
} from "@/app/(app)/projects/[id]/team-actions";

export type ProjectPerson = { memberId: string; email: string; role: string | null };
export type ProjectPending = {
  id: string;
  email: string;
  token: string;
  role: string | null;
};

/**
 * The two tiers, in the order they are offered: the safer one first.
 *
 * Only the literal 'reviewer' restricts anything, in the UI and in
 * can_edit_project alike, so every legacy 'collaborator' row reads as an editor
 * and nobody already on a project is quietly demoted.
 */
const ROLES = [
  { key: "editor", label: "Editor", hint: "Works the job: uploads, edits, adds" },
  { key: "reviewer", label: "Reviewer", hint: "Reads it, comments, approves" },
] as const;

function roleLabel(role: string | null): string {
  return role === "reviewer" ? "Reviewer" : "Editor";
}

function inviteLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/project-invite/${token}`;
}

export function ProjectPeople({
  projectId,
  members,
  pending,
}: {
  projectId: string;
  members: ProjectPerson[];
  pending: ProjectPending[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "reviewer">("editor");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Outcome of the invite we just created: who, and whether the email sent.
  // It does not send when the deployment has no mail configured, in which case
  // copying the link is the whole flow.
  const [sentTo, setSentTo] = useState<{ email: string; emailed: boolean } | null>(
    null
  );
  const [pendingT, start] = useTransition();

  const count = members.length;

  function copy(token: string) {
    navigator.clipboard?.writeText(inviteLink(token)).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function invite() {
    const clean = email.trim();
    if (!clean) return;
    setErr(null);
    setSentTo(null);
    start(async () => {
      const res = await inviteToProject(projectId, clean, role);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setEmail("");
      setSentTo({ email: clean, emailed: Boolean(res?.emailed) });
      // Only take over the clipboard when the link is how they get in.
      if (res?.token && !res.emailed) copy(res.token);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm transition hover:border-border-strong hover:text-text"
        title="Invite people to this project"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
        People{count > 0 ? ` · ${count}` : ""}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="People on this project">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm text-text-muted">
              Invite crew (DP, AD, PA, etc.) to this project only. They will not
              see the rest of the studio. We email them the invite link.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => setRole(r.key)}
                    className={`flex-1 rounded-[11px] border px-3 py-2 text-left transition ${
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <span
                      className={`block text-sm font-bold ${active ? "text-accent" : "text-text"}`}
                    >
                      {r.label}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">
                      {r.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") invite();
                }}
                placeholder="name@email.com"
                className="min-w-0 flex-1"
              />
              <Button size="sm" onClick={invite} disabled={pendingT || !email.trim()}>
                {pendingT ? "Inviting…" : "Invite"}
              </Button>
            </div>
            {sentTo && !err && (
              <p
                className={`mt-2 rounded-[10px] px-3 py-2 text-sm font-medium ${
                  sentTo.emailed ? "bg-green-bg text-green" : "bg-amber-bg text-amber"
                }`}
              >
                {sentTo.emailed
                  ? `Invite sent to ${sentTo.email}.`
                  : `Invite created for ${sentTo.email}. Email is not set up here, so send them the copied link.`}
              </p>
            )}
            {err && (
              <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                {err}
              </p>
            )}
          </div>

          {members.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
                On this project
              </h3>
              <ul className="space-y-1">
                {members.map((m) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between gap-2 rounded-[9px] px-2 py-1.5 hover:bg-surface-2/60"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-text">{m.email}</span>
                      <span
                        className="shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                        style={
                          m.role === "reviewer"
                            ? { backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }
                            : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }
                        }
                      >
                        {roleLabel(m.role)}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        start(async () => {
                          await removeProjectMember(m.memberId, projectId);
                          router.refresh();
                        })
                      }
                      className="shrink-0 text-xs font-semibold text-text-faint hover:text-red"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
                Pending
              </h3>
              <ul className="space-y-1">
                {pending.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-[9px] px-2 py-1.5 hover:bg-surface-2/60"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-text-muted">{p.email}</span>
                      <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                        {roleLabel(p.role)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => copy(p.token)}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        {copied === p.token ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        onClick={() =>
                          start(async () => {
                            await revokeProjectInvite(p.id, projectId);
                            router.refresh();
                          })
                        }
                        className="text-xs font-semibold text-text-faint hover:text-red"
                      >
                        Revoke
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
