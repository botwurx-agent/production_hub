"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AgentPanel } from "@/components/agent/agent-panel";
import { onOpenAgent } from "@/components/agent/agent-open";

/**
 * Mounted once in the app shell. Owns whether the Runner panel is open and
 * nothing else, so the triggers (the sidebar row, the mobile topbar button)
 * are plain buttons that call openAgent().
 *
 * The panel is only rendered once it has been opened, so a producer who never
 * uses it pays nothing: no context load, no conversation fetch, no speech API
 * probe.
 *
 * Portaled to the body for the same reason the modals are: a fixed element
 * inside a transformed ancestor positions against that ancestor rather than
 * the viewport, which has bitten this codebase before.
 */
export function AgentMount() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => onOpenAgent(() => setOpen(true)), []);

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

  if (!mounted || !open) return null;
  return createPortal(<AgentPanel onClose={() => setOpen(false)} />, document.body);
}
