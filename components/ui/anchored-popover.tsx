"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A popover that renders into document.body and positions itself against an
// anchor element. Two reasons it has to work this way: the panels it opens in
// scroll (overflow-y-auto clips absolutely positioned children), and a menu
// opened from a button near an edge has to flip rather than run off the panel.
// Positioning is clamped to the viewport either way.
export function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  width,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  width: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const h = panelRef.current?.offsetHeight ?? 240;
      const gap = 6;
      // Prefer opening upward (the composer sits at the bottom of the rail);
      // drop below when there is not enough headroom.
      const above = r.top - h - gap;
      const top = above >= 8 ? above : Math.min(r.bottom + gap, window.innerHeight - h - 8);
      const left = Math.max(
        8,
        Math.min(r.left, window.innerWidth - width - 8)
      );
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    // Capture phase so it follows any scrolling ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width,
        // Hidden until measured, so it never flashes in the wrong place.
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-[200] rounded-[12px] border border-border bg-surface p-2 shadow-lg"
    >
      {children}
    </div>,
    document.body
  );
}
