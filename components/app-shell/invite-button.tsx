"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteMember } from "@/app/(app)/settings/team-actions";
import { inviteToProject } from "@/app/(app)/projects/[id]/team-actions";

/**
 * One place to add a person, on every page.
 *
 * Adding someone used to live in exactly two places: Settings for a teammate,
 * and the project hub's hero for a collaborator. Which meant the answer to "how
 * do I get this person in" depended on which of the two you happened to want
 * and, for a collaborator, on being on the hub rather than any of the twenty
 * pages under it.
 *
 * It reads the PROJECT FROM THE URL rather than taking it as a prop. The topbar
 * renders above every route, so threading a project id down to it would mean
 * every page that has one remembering to pass it, and every page that does not
 * passing null. The path already knows.
 *
 * This does NOT replace the share-for-review buttons on assets and docs. Those
 * are correct where they are: sharing one specific cut belongs on that cut, not
 * in a global menu that would then have to ask which cut.
 */

const STUDIO_TIERS = [
  { key: "member", label: "Member", hint: "Full access to the whole studio" },
  { key: "admin", label: "Admin", hint: "Also manages people and settings" },
] as const;

const PROJECT_TIERS = [
  { key: "editor", label: "Editor", hint: "Works the job: uploads, edits, adds" },
  { key: "reviewer", label: "Reviewer", hint: "Reads it, comments, approves" },
] as const;

type Scope = "project" | "studio";

export function InviteButton() {
  const pathname = usePathname();
  const router = useRouter();

  // /projects/<uuid> and anything under it. The list page itself is
  // /projects with nothing after, so it correctly yields no project.
  const projectId = useMemo(() => {
    const m = pathname?.match(/^\/projects\/([0-9a-fA-F-]{36})(?:\/|$)/);
    return m ? m[1] : null;
  }, [pathname]);

  const [open, setOpen] = useState(false);
  // Defaults to the narrower grant when there is a project in view, because
  // that is nearly always what someone standing on a job means.
  const [scope, setScope] = useState<Scope>(projectId ? "project" : "studio");
  const [email, setEmail] = useState("");
  const [projectRole, setProjectRole] = useState<"editor" | "reviewer">("editor");
  const [studioRole, setStudioRole] = useState<"member" | "admin">("member");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; emailed: boolean } | null>(null);
  const [busy, start] = useTransition();

  function reset() {
    setEmail("");
    setErr(null);
    setSent(null);
  }

  function openPanel() {
    // The scope is re-derived on every open rather than held from last time, so
    // walking from a project to the dashboard and inviting cannot silently
    // grant project access to the job you just left.
    setScope(projectId ? "project" : "studio");
    reset();
    setOpen(true);
  }

  function submit() {
    const clean = email.trim();
    if (!clean) return;
    setErr(null);
    setSent(null);
    start(async () => {
      const res =
        scope === "project" && projectId
          ? await inviteToProject(projectId, clean, projectRole)
          : await inviteMember(clean, studioRole);
      if (res && "error" in res && res.error) {
        setErr(res.error);
        return;
      }
      const emailed = Boolean(res && "emailed" in res && res.emailed);
      // Only take the clipboard when the link IS the delivery mechanism.
      if (!emailed && res && "token" in res && res.token) {
        const path = scope === "project" ? "project-invite" : "invite";
        navigator.clipboard
          ?.writeText(`${window.location.origin}/${path}/${res.token}`)
          .catch(() => {});
      }
      setEmail("");
      setSent({ email: clean, emailed });
      router.refresh();
    });
  }

  const tiers = scope === "project" ? PROJECT_TIERS : STUDIO_TIERS;
  const active = scope === "project" ? projectRole : studioRole;
  const pick = (k: string) =>
    scope === "project"
      ? setProjectRole(k as "editor" | "reviewer")
      : setStudioRole(k as "member" | "admin");

  return (
    <>
      <button
        onClick={openPanel}
        title="Invite someone"
        aria-label="Invite someone"
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
        <span className="hidden sm:inline">Invite</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite someone" size="md">
        <div className="space-y-4">
          {/* Only offered when there is a project to scope to. On the dashboard
              this collapses to a single sentence rather than a picker with one
              real choice in it. */}
          {projectId ? (
            <div className="flex gap-2">
              {(
                [
                  ["project", "To this project"],
                  ["studio", "To the whole studio"],
                ] as [Scope, string][]
              ).map(([key, label]) => {
                const on = scope === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setScope(key);
                      reset();
                    }}
                    className={`flex-1 rounded-[11px] border px-3 py-2 text-sm font-semibold transition ${
                      on
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-text-muted hover:border-border-strong"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              They will join the studio and see every project in it. To give
              someone one project only, invite them from that project.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => {
              const on = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => pick(t.key)}
                  className={`flex-1 rounded-[11px] border px-3 py-2 text-left transition ${
                    on ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className={`block text-sm font-bold ${on ? "text-accent" : "text-text"}`}>
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">
                    {t.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="name@email.com"
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={submit} disabled={busy || !email.trim()}>
              {busy ? "Inviting…" : "Send invite"}
            </Button>
          </div>

          {sent && !err && (
            <p
              className={`rounded-[10px] px-3 py-2 text-sm font-medium ${
                sent.emailed ? "bg-green-bg text-green" : "bg-amber-bg text-amber"
              }`}
            >
              {sent.emailed
                ? `Invite sent to ${sent.email}.`
                : `Invite created for ${sent.email}. Email is not set up here, so send them the link we copied.`}
            </p>
          )}
          {err && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {err}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
