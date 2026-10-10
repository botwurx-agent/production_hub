"use client";

import { createContext, useContext } from "react";

/**
 * Whether the comment composer is being used by the studio's own team.
 *
 * A CONTEXT RATHER THAN A PROP, for the reason the mention roster is one: the
 * same pin and video composers are mounted by the client portal and by seven
 * in-app surfaces, and a prop would have to be remembered on every one.
 *
 * FALSE IS THE SAFE DEFAULT, and it is what the public portal gets, since it
 * lives outside the app layout that mounts the provider. With no provider the
 * composer offers no "Team only" switch at all, so a client can never be shown
 * the control, let alone a note it would hide.
 */
const Ctx = createContext(false);

export function TeamReviewProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={true}>{children}</Ctx.Provider>;
}

export function useTeamReview(): boolean {
  return useContext(Ctx);
}

/** The switch in a composer's toolbar. Renders nothing outside the app. */
export function TeamOnlyToggle({
  on,
  onChange,
  disabled = false,
  compact = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const team = useTeamReview();
  if (!team) return null;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      title={
        on
          ? "Only your team will see this. Click to let the client see it too."
          : "The client will see this. Click to keep it to your team."
      }
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
        on
          ? "border-amber bg-amber-bg text-text"
          : "border-border text-muted hover:text-text"
      }`}
    >
      <LockIcon on={on} />
      {compact ? (on ? "Team" : "Team only") : "Team only"}
    </button>
  );
}

/** The tag on a posted comment the client cannot see. */
export function TeamOnlyTag() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-amber bg-amber-bg px-1.5 py-px text-[10px] font-bold text-text"
      title="Only your team can see this. It is hidden from the client review link."
    >
      <LockIcon on />
      Team only
    </span>
  );
}

function LockIcon({ on }: { on: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path
        d={on ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.6-1.7"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
