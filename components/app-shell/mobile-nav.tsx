"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { navFor, isActive } from "@/components/app-shell/nav-items";
import { CommunicationBadge } from "@/components/app-shell/communication-badge";
import { RunnerIcon } from "@/components/app-shell/nav-icons";
import { openAgent } from "@/components/agent/agent-open";
import {
  StudioSwitcher,
  type StudioOption,
} from "@/components/app-shell/studio-switcher";

/**
 * The phone's navigation: a hamburger that opens the sidebar as a drawer.
 *
 * It replaces a row of pills that shared the 390px top bar with a brand mark,
 * Runner, Invite, the bell, the theme toggle and the avatar. Six destinations
 * were left about 110px of horizontally scrolling runway, so the second one was
 * already cut in half and the rest were found by swiping a strip of chrome
 * nobody reads as scrollable. It also quietly dropped /dashboard, which made
 * the documented home of the app unreachable on a phone.
 *
 * A drawer rather than a bottom tab bar because there are seven destinations
 * plus Runner, and a tab bar holds four or five before it starts hiding things
 * behind a "More" that is the same problem again. The drawer is the sidebar:
 * same order, same icons, same labels, same badge, from the same array.
 */
export function MobileNav({
  studioName,
  logoUrl,
  collaborator = false,
  studios = [],
  activeStudioId = "",
  assistant = false,
}: {
  studioName: string;
  logoUrl?: string | null;
  collaborator?: boolean;
  studios?: StudioOption[];
  activeStudioId?: string;
  assistant?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = navFor(collaborator);

  useEffect(() => setMounted(true), []);

  // Close on navigation. Without this the drawer stays over the page you just
  // asked for, which reads as the tap having failed.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const row =
    "flex items-center gap-3 rounded-[11px] px-3 py-3 text-[15px] font-semibold transition";

  return (
    <>
      {/* 44px square, which is the smallest thing a thumb hits reliably. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-text-muted transition hover:bg-surface-2 hover:text-text lg:hidden short:!grid"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden short:!block">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                className="absolute inset-y-0 left-0 flex w-[276px] max-w-[82vw] flex-col border-r border-border bg-surface shadow-lg"
              >
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
                  <StudioSwitcher
                    studios={studios}
                    activeId={activeStudioId}
                    name={studioName}
                    logoUrl={logoUrl}
                    collapsed={false}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation"
                    className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                  {assistant ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          openAgent();
                        }}
                        className={`${row} w-full text-text-muted hover:bg-surface-2 hover:text-text`}
                      >
                        <RunnerIcon />
                        Runner
                      </button>
                      <div className="!my-2 border-t border-border" />
                    </>
                  ) : null}

                  {items.map(({ href, label, Icon }) => {
                    const active = isActive(pathname, href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`${row} ${
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-text-muted hover:bg-surface-2 hover:text-text"
                        }`}
                      >
                        <Icon />
                        {label}
                        {href === "/communication" && <CommunicationBadge />}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
