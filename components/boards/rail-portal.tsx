"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Anything that escapes the tool rail sideways: a hover tooltip, the shape
 * picker, a card tool's flyout.
 *
 * WHY THIS EXISTS, and it is a CSS rule worth knowing. The rail scrolls
 * vertically, because thirteen labelled tools are taller than a short laptop
 * viewport. But setting `overflow-y: auto` does NOT leave the other axis alone:
 * per spec, an axis of `visible` paired with a non-visible axis computes to
 * `auto`. So the rail silently became a HORIZONTAL scroll container too, and
 * every absolutely positioned tooltip sitting at `left-full` added its own
 * width to the scrollable area. Hovering a tool with a longer line made the
 * rail scroll sideways.
 *
 * Neither obvious fix works, both measured in a browser rather than assumed:
 * `overflow-x: clip` is coerced to `hidden` when the other axis is `auto`, and
 * `hidden` stops the scrolling but then CLIPS the tooltip, which would also
 * have hidden the shape picker and every card-tool flyout.
 *
 * So the rail clips its horizontal axis and these render in a portal instead,
 * anchored to the button by its measured rect. Out of the scroll container, so
 * there is nothing to scroll to and nothing to clip.
 *
 * Positioned `fixed` and re-measured on open, and closed on scroll rather than
 * followed, because a panel that lags its anchor by a frame reads worse than
 * one that gets out of the way.
 */
export function RailPortal({
  anchor,
  open,
  onClose,
  width,
  children,
}: {
  anchor: React.RefObject<HTMLElement>;
  open: boolean;
  /** Omit for a tooltip, which closes with the hover that opened it. */
  onClose?: () => void;
  width: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const a = anchor.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    // To the right of the rail, and pulled back inside the window rather than
    // pushed off it on a narrow screen.
    const left = Math.min(r.right + 8, window.innerWidth - width - 8);
    setPos({ top: Math.max(8, r.top), left: Math.max(8, left) });
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open || !onClose) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (anchor.current?.contains(t) || ref.current?.contains(t)) return;
      onClose!();
    }
    // A listener, never a backdrop element: a backdrop over the canvas
    // swallowed the drop of a shape being dragged out of the picker, which made
    // that tool unusable for as long as it shipped.
    const t = window.setTimeout(
      () => document.addEventListener("pointerdown", onDown),
      0,
    );
    const bail = () => onClose!();
    window.addEventListener("scroll", bail, true);
    window.addEventListener("resize", bail);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", bail, true);
      window.removeEventListener("resize", bail);
    };
  }, [open, onClose, anchor]);

  if (!mounted || !open || !pos) return null;
  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, width, zIndex: 60 }}
      className={onClose ? undefined : "pointer-events-none"}
    >
      {children}
    </div>,
    document.body,
  );
}
