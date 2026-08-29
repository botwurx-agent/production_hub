"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * Whether the modal the caller sits inside has been given more room.
 *
 * Context rather than a prop because the components that care (a review canvas,
 * a big table) sit several levels down and the ones between have no business
 * knowing. Consumers read it to lay out for the space they actually have: the
 * review canvases already take a `wide` prop that switches the media and the
 * comment rail to their larger sizes, so expanding the window makes the VIDEO
 * bigger rather than just adding margin around it.
 */
const ModalRoom = createContext(false);
export function useModalRoomy() {
  return useContext(ModalRoom);
}

type Size = { w: number; h: number };

const MIN_W = 420;
const MIN_H = 320;
/** Leave a strip of backdrop, so it still reads as a window over the page. */
const EDGE = 24;

/**
 * The floor has to yield to the viewport, or it is not a floor, it is an
 * overflow. A phone is 390px wide, so a flat 420px minimum made every modal
 * carrying a remembered size wider than the screen and scrolled the whole PAGE
 * sideways behind the backdrop. Take the smaller of the two, never the larger.
 */
function clamp(size: Size): Size {
  if (typeof window === "undefined") return size;
  const maxW = window.innerWidth - EDGE;
  const maxH = window.innerHeight - EDGE;
  return {
    w: Math.max(Math.min(MIN_W, maxW), Math.min(size.w, maxW)),
    h: Math.max(Math.min(MIN_H, maxH), Math.min(size.h, maxH)),
  };
}

export function Modal({
  open,
  onClose,
  title,
  children,
  titleNode,
  actions,
  bodyClassName = "min-h-0 flex-1 overflow-y-auto p-5",
  size = "md",
  resizable,
  id,
}: {
  open: boolean;
  onClose: () => void;
  /** Always supplied: it labels the dialog even when titleNode replaces it. */
  title: string;
  /**
   * A richer heading than a string, for a window whose title is editable or
   * carries its own meta line. The plain `title` still names the dialog.
   */
  titleNode?: ReactNode;
  /** Header controls, placed before Expand and Close. */
  actions?: ReactNode;
  /**
   * The body's own classes. A viewer wants a stage that centres its media on a
   * neutral ground, not the default padded scroller.
   */
  bodyClassName?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  /**
   * Defaults to on for lg and xl. A small confirm dialog has nothing to gain
   * from more room, and a resize grip on one is just clutter.
   */
  resizable?: boolean;
  /**
   * Remembers the size this modal was left at, per browser. Without an id it
   * still resizes, it just opens at its default every time.
   */
  id?: string;
}) {
  const maxW =
    size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-md";
  const canResize = resizable ?? size !== "md";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [custom, setCustom] = useState<Size | null>(null);
  const [full, setFull] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  const storeKey = id ? `modal.size.${id}` : null;

  // Restore the remembered size, clamped in case the window has since shrunk
  // past it.
  useEffect(() => {
    if (!open || !storeKey) return;
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (raw === "full") {
        setFull(true);
        return;
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Size;
        if (parsed?.w && parsed?.h) setCustom(clamp(parsed));
      }
    } catch {}
  }, [open, storeKey]);

  const remember = useCallback(
    (value: Size | "full" | null) => {
      if (!storeKey) return;
      try {
        if (value === null) window.localStorage.removeItem(storeKey);
        else
          window.localStorage.setItem(
            storeKey,
            value === "full" ? "full" : JSON.stringify(value),
          );
      } catch {}
    },
    [storeKey],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function startResize(e: React.PointerEvent) {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    // Pointer capture so the drag survives the cursor leaving the handle, which
    // at 16px happens immediately.
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFull(false);
    e.preventDefault();
  }

  function onResize(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    // Doubled because the panel is centred: it grows from both edges at once,
    // so the cursor travels half the distance the size changes.
    setCustom(
      clamp({
        w: d.w + (e.clientX - d.x) * 2,
        h: d.h + (e.clientY - d.y) * 2,
      }),
    );
  }

  function endResize() {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (custom) remember(custom);
  }

  function toggleFull() {
    const next = !full;
    setFull(next);
    setCustom(null);
    remember(next ? "full" : null);
  }

  if (!open || !mounted) return null;

  // Roomy once the operator has asked for space, whichever way they asked.
  const roomy = full || (custom?.h ?? 0) > window.innerHeight * 0.75;

  // Below `sm` a remembered size is ignored outright and the panel goes back
  // to its responsive width. A size dragged out on a desktop says nothing
  // useful about a phone, and honouring it there only ever makes the window
  // worse than the default would have been.
  const narrow = window.innerWidth < 640;
  const panelStyle: React.CSSProperties = full
    ? { width: `calc(100vw - ${EDGE}px)`, height: `calc(100dvh - ${EDGE}px)` }
    : custom && !narrow
      ? { width: custom.w, height: custom.h }
      : {};

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Capped to the viewport and scrolled INTERNALLY. Without this a long
          body (a review with seven client comments) grew the panel past the
          screen and pushed the media off the top, where the operator could not
          see the thing they were reviewing. */}
      <div
        ref={panelRef}
        style={panelStyle}
        className={`relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden ${
          full || (custom && !narrow) ? "" : maxW
        } rounded-[18px] border border-border bg-surface shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          {titleNode ?? (
            <h2 className="min-w-0 truncate font-display text-lg font-bold text-text">
              {title}
            </h2>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {canResize && (
              <button
                onClick={toggleFull}
                aria-label={full ? "Restore size" : "Expand"}
                title={full ? "Restore size" : "Expand"}
                className="grid h-8 w-8 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                {full ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 3v6H3M15 21v-6h6M3 15h6v6M21 9h-6V3" />
                  </svg>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="16"
                height="16"
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
        </div>

        <ModalRoom.Provider value={roomy}>
          <div className={bodyClassName}>{children}</div>
        </ModalRoom.Provider>

        {/* No grip on a phone: a dragged size is ignored at that width, so the
            handle would be a control that visibly does nothing. */}
        {canResize && !full && !narrow && (
          <div
            onPointerDown={startResize}
            onPointerMove={onResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            role="separator"
            aria-label="Resize"
            title="Drag to resize"
            className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize touch-none text-text-faint transition hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M14 6 6 14M14 11l-3 3" />
            </svg>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
