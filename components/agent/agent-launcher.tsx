"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AgentPanel } from "@/components/agent/agent-panel";

/**
 * The topbar entry point. The panel itself is only mounted once it has been
 * opened, so a producer who never uses it pays nothing for it: no context
 * load, no conversation fetch, no speech API probe.
 *
 * Portaled to the body for the same reason the modals are: a fixed element
 * inside a transformed ancestor positions against that ancestor instead of the
 * viewport, which has bitten this codebase before.
 */
export function AgentLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Cmd/Ctrl+K is the expected way into a thing like this, and Escape out.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Assistant (Cmd+K)"
        aria-label="Open the assistant"
        className="flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-text-muted hover:bg-surface-2 hover:text-text"
      >
        <SparkIcon />
        <span className="hidden text-xs font-semibold sm:inline">Ask</span>
      </button>

      {mounted && open
        ? createPortal(<AgentPanel onClose={() => setOpen(false)} />, document.body)
        : null}
    </>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
