"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { switchStudio } from "@/app/(app)/studio-actions";

export type StudioOption = { id: string; name: string; role: string };

// The sidebar header. For someone in one studio it is a plain label, exactly as
// before. For someone in several it becomes the switcher, because that is the
// only place in the app where "which studio am I in" is already being answered.
export function StudioSwitcher({
  studios,
  activeId,
  name,
  logoUrl,
  collapsed,
}: {
  studios: StudioOption[];
  activeId: string;
  name: string;
  logoUrl?: string | null;
  collapsed: boolean;
}) {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const multiple = studios.length > 1;

  const mark = logoUrl ? (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt={name} className="h-full w-full object-contain p-0.5" />
    </span>
  ) : (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-fg shadow-sm">
      <span className="text-xs font-extrabold tracking-tight">SF</span>
    </span>
  );

  const label = (
    <div className="min-w-0 text-left">
      <div className="truncate text-sm font-bold leading-tight text-text">
        {busy ? "Switching…" : name}
      </div>
      <div className="text-[11px] leading-tight text-text-faint">
        {multiple ? "Switch studio" : "Studio Flows"}
      </div>
    </div>
  );

  function choose(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      const res = await switchStudio(id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      // Land on the dashboard rather than staying put: the current URL may
      // carry a project or client id that belongs to the studio we just left.
      router.push("/dashboard");
      router.refresh();
    });
  }

  if (!multiple) {
    return (
      <>
        {mark}
        {!collapsed && label}
      </>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title={collapsed ? `${name} (switch studio)` : "Switch studio"}
        className={`flex min-w-0 flex-1 items-center rounded-[10px] transition hover:bg-surface-2 ${
          collapsed ? "justify-center" : "gap-2 px-1 py-1"
        }`}
      >
        {mark}
        {!collapsed && label}
        {!collapsed && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto shrink-0 text-text-faint"
            aria-hidden
          >
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
          </svg>
        )}
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        width={232}
      >
        <p className="px-2 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
          Your studios
        </p>
        <ul className="space-y-0.5">
          {studios.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => choose(s.id)}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-text">
                    {s.name}
                  </span>
                  <span className="block text-[11px] capitalize text-text-faint">
                    {s.role}
                  </span>
                </span>
                {s.id === activeId && (
                  <span className="shrink-0 text-accent" aria-label="Current">
                    &#10003;
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p className="mt-1 px-2 pb-0.5 text-[11px] font-medium text-red">{error}</p>
        )}
      </AnchoredPopover>
    </>
  );
}
