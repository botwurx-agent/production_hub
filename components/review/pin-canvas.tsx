"use client";

import { useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { DrawCanvas } from "@/components/review/draw-canvas";
import { DrawToolbar } from "@/components/review/draw-toolbar";
import { EmojiPicker } from "@/components/review/emoji-picker";
import { DRAW_COLORS, type Drawing, type DrawTool } from "@/lib/review-drawing";
import type { PortalComment } from "@/lib/review-links";
import { useModalRoomy } from "@/components/ui/modal";

// Frame.io-style pinned review over an arbitrary surface: click the surface to
// drop the next numbered pin and open a matching comment; the sidebar stays in
// sync. Context-agnostic — the parent supplies the surface (an image or a
// read-only doc) and the post/resolve handlers.
export function PinCanvas({
  stage,
  stageBg = "#141118",
  fit = "auto",
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  emptyHint = "Click anywhere to drop a pin and start.",
  wide = false,
  onPost,
  onResolve,
}: {
  stage: React.ReactNode;
  stageBg?: string;
  // "auto" hugs the surface (images); "full" stretches to the stage (docs).
  fit?: "auto" | "full";
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  emptyHint?: string;
  // Full-page reviews get a roomier comment rail.
  wide?: boolean;
  onPost: (
    text: string,
    pin: { x: number; y: number } | null,
    extra?: { drawing?: Drawing | null }
  ) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  // Markup on the surface itself, for when a pin plus words is not enough.
  const [drawMode, setDrawMode] = useState(false);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [tool, setTool] = useState<DrawTool>("arrow");
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [redo, setRedo] = useState<Drawing["strokes"]>([]);

  const pins = comments.filter(
    (c) => !c.resolved && c.x != null && c.y != null && c.pinNumber != null
  );
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const visible = comments.filter((c) => showResolved || !c.resolved);
  const nextPin =
    comments.reduce((m, c) => (c.pinNumber && c.pinNumber > m ? c.pinNumber : m), 0) + 1;

  function placePin(e: React.MouseEvent) {
    // While drawing, a click on the surface is a stroke, not a pin.
    if (drawMode) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPending({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setActiveId(null);
  }

  async function post() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    setSending(true);
    const ok = await onPost(t, pending, { drawing: draft });
    setSending(false);
    if (ok) {
      setText("");
      setPending(null);
      setDraft(null);
      setRedo([]);
      setDrawMode(false);
    }
  }

  function undoStroke() {
    if (!draft?.strokes.length) return;
    const popped = draft.strokes[draft.strokes.length - 1];
    const strokes = draft.strokes.slice(0, -1);
    setRedo((r) => [...r, popped]);
    setDraft(strokes.length ? { ...draft, strokes } : null);
  }
  function redoStroke() {
    if (redo.length === 0) return;
    const next = redo[redo.length - 1];
    setRedo((r) => r.slice(0, -1));
    setDraft((d) =>
      d ? { ...d, strokes: [...d.strokes, next] } : { w: 16, h: 9, strokes: [next] }
    );
  }
  function insertEmoji(e: string) {
    const el = textRef.current;
    if (!el) {
      setText((t) => t + e);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + e + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + e.length, start + e.length);
    });
  }

  const activeComment = comments.find((c) => c.id === activeId) ?? null;
  const shownDrawing = drawMode ? draft : (activeComment?.drawing ?? null);

  // Expanding the window has to make the MEDIA bigger, not the margins. The
  // canvas already has a roomy layout behind `wide`; reading the modal's state
  // here means every caller gets it without threading a prop.
  const roomy = wide || useModalRoomy();

  const teardrop =
    "grid h-7 w-7 place-items-center rounded-[50%_50%_50%_2px] border-2 border-white text-xs font-extrabold text-white shadow-lg";

  return (
    <div className={`grid grid-cols-1 gap-4 ${roomy ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-[1fr_340px]"}`}>
      {/* Stage — a stable viewing environment for judging the work */}
      <div
        // `safe center` rather than plain centring: a centred flex item that
        // grows wider than its container overflows equally in both directions,
        // and the left half becomes unreachable because scrolling cannot go
        // below zero. `safe` falls back to start-alignment exactly when that
        // would happen, which is what makes zooming past the frame usable.
        className="flex items-start [justify-content:safe_center] overflow-auto rounded-[16px] p-4"
        style={{ backgroundColor: stageBg }}
      >
        <div
          ref={wrapRef}
          onClick={placePin}
          className={`relative cursor-crosshair ${
            fit === "full" ? "block w-full" : "inline-block"
          }`}
        >
          {stage}

          <DrawCanvas
            drawing={shownDrawing}
            active={drawMode}
            tool={tool}
            color={color}
            size={4}
            onChange={(d) => {
              setDraft(d);
              setRedo([]);
            }}
          />

          {pins.map((c) => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(c.id);
                setPending(null);
              }}
              className="absolute z-10 transition-transform hover:scale-110"
              style={{ left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%,-100%)" }}
              aria-label={`Comment ${c.pinNumber}`}
            >
              <span
                className={teardrop}
                style={{
                  backgroundColor: "var(--accent)",
                  transform: "rotate(45deg)",
                  outline: activeId === c.id ? "3px solid var(--accent-soft)" : "none",
                }}
              >
                <span style={{ transform: "rotate(-45deg)" }}>{c.pinNumber}</span>
              </span>
            </button>
          ))}

          {pending && (
            <span
              className="absolute z-10 animate-pulse"
              style={{ left: `${pending.x}%`, top: `${pending.y}%`, transform: "translate(-50%,-100%)" }}
            >
              <span
                className={teardrop}
                style={{ backgroundColor: "var(--h-amber)", transform: "rotate(45deg)" }}
              >
                <span style={{ transform: "rotate(-45deg)" }}>{nextPin}</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {drawMode && (
        <div className="lg:col-start-1">
          <DrawToolbar
            tool={tool}
            onTool={setTool}
            color={color}
            onColor={setColor}
            draft={draft}
            canRedo={redo.length > 0}
            onUndo={undoStroke}
            onRedo={redoStroke}
            onClear={() => {
              setDraft(null);
              setRedo([]);
            }}
            onCancel={() => {
              setDrawMode(false);
              setDraft(null);
              setRedo([]);
            }}
            hint="Mark up the frame, then write your note."
          />
        </div>
      )}

      {/* Comments. Capped for the same reason as the video rail: it scrolls
          internally, but uncapped it grows the grid row and pushes the stage
          out of view. */}
      <div
        className={`flex min-h-[320px] flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm ${
          roomy ? "lg:max-h-[78vh]" : "lg:max-h-[58vh]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-text">Comments</span>
            <span
              className="rounded-pill px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {comments.length}
            </span>
          </div>
          {resolvedCount > 0 && (
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div
                className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-[13px]"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-text">No comments yet</p>
              <p className="mt-1 text-xs text-text-muted">{emptyHint}</p>
            </div>
          ) : (
            visible.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex cursor-pointer gap-2.5 border-l-[3px] px-4 py-3 transition ${
                  activeId === c.id
                    ? "border-accent bg-accent-soft/50"
                    : "border-transparent hover:bg-surface-2/60"
                } ${c.resolved ? "opacity-55" : ""}`}
              >
                {c.pinNumber != null ? (
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: c.resolved ? "var(--border-strong)" : "var(--accent)" }}
                  >
                    {c.pinNumber}
                  </span>
                ) : (
                  <span className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-text">{c.author}</span>
                    <span
                      className="rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={
                        c.isClient
                          ? { backgroundColor: "var(--h-cyan)", color: "#fff" }
                          : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }
                      }
                    >
                      {c.isClient ? "Client" : "Studio"}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold text-text-faint">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-text-muted">
                    {c.body}
                  </p>
                  {canResolve && onResolve && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolve(c.id, !c.resolved);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-text-faint transition hover:text-green"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {c.resolved ? "Resolved · undo" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {disabled && disabledHint ? (
            <p
              className="mb-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
              style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
            >
              {disabledHint}
            </p>
          ) : pending ? (
            <p className="mb-2 text-[11.5px] font-bold" style={{ color: "var(--h-amber)" }}>
              📍 Pin {nextPin} placed — write your note
            </p>
          ) : null}
          <textarea
            ref={textRef}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder={pending ? "Comment on this spot…" : "Add a comment, or click to pin one…"}
            className="min-h-[64px] w-full rounded-[11px] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
          />
          {/* Always rendered, inert when gated, so the tools stay discoverable. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setDrawMode((v) => !v);
                if (drawMode) {
                  setDraft(null);
                  setRedo([]);
                }
              }}
              disabled={disabled}
              title="Draw on the frame"
              className={`inline-flex h-7 items-center gap-1 rounded-[8px] px-1.5 text-[11px] font-bold transition hover:bg-surface-2 disabled:opacity-40 ${
                drawMode || draft ? "text-accent" : "text-text-muted hover:text-text"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
              {draft ? "Drawing" : "Draw"}
            </button>
            <EmojiPicker onPick={insertEmoji} />
            {pending && (
              <button
                onClick={() => setPending(null)}
                className="text-xs font-semibold text-text-faint hover:text-text"
              >
                Clear pin
              </button>
            )}
            <span className="flex-1" />
            <button
              onClick={post}
              disabled={disabled || sending || !text.trim()}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
            >
              {sending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
