"use client";

import { useMemo, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import {
  ScrubVideo,
  fmtTimecode,
  type ScrubVideoHandle,
} from "@/components/review/video-player";
import {
  DRAW_COLORS,
  type Drawing,
  type DrawTool,
} from "@/lib/review-drawing";
import { EmojiPicker } from "@/components/review/emoji-picker";
import { DrawToolbar } from "@/components/review/draw-toolbar";
import { CommentReactions } from "@/components/review/comment-reactions";
import type { PortalComment } from "@/lib/review-links";
import { useModalRoomy } from "@/components/ui/modal";

// Frame.io-grade video review: the shared ScrubVideo player (accurate scrubbing,
// frame stepping, speed, loop, shuttle keys) + a comment rail with threaded
// replies, filter / sort / search, and freehand annotation drawn on the frame.

type Filter = "all" | "open" | "resolved" | "mine";
type Sort = "time" | "newest" | "oldest";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "mine", label: "Mine" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "time", label: "Timecode" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];



export function VideoReview({
  videoUrl,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  wide = false,
  meName,
  meKey,
  onPost,
  onResolve,
  onEdit,
  onDelete,
  onReact,
}: {
  videoUrl: string;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  wide?: boolean;
  // Who "Mine" means; the client portal passes the reviewer's typed name.
  meName?: string | null;
  onPost: (
    text: string,
    timecode: number,
    extra?: {
      parentId?: string | null;
      drawing?: Drawing | null;
      timecodeEnd?: number | null;
    }
  ) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
  // Identity of the current viewer for edit/delete rights: the browser key in
  // the public portal, the user id internally. A comment is editable when this
  // matches the one that wrote it.
  meKey?: string | null;
  onEdit?: (id: string, body: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onReact?: (id: string, emoji: string) => void;
}) {
  const playerRef = useRef<ScrubVideoHandle>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  // Out-point of a range comment being composed (in-point is `pending`).
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("time");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<PortalComment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Drawing state: the annotation being composed, and the saved one shown when
  // a comment is selected.
  const [drawMode, setDrawMode] = useState(false);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [tool, setTool] = useState<DrawTool>("pen");
  // Strokes popped by Undo, so Redo can put them back.
  const [redo, setRedo] = useState<Drawing["strokes"]>([]);

  const round2 = (t: number) => Math.round(t * 100) / 100;

  const roots = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const repliesOf = useMemo(() => {
    const map = new Map<string, PortalComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    }
    return map;
  }, [comments]);

  const openCount = roots.filter((c) => !c.resolved).length;
  const resolvedCount = roots.filter((c) => c.resolved).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = roots.filter((c) => {
      if (filter === "open" && c.resolved) return false;
      if (filter === "resolved" && !c.resolved) return false;
      if (filter === "mine" && (!meName || c.author !== meName)) return false;
      if (q) {
        const inSelf = c.body.toLowerCase().includes(q);
        const inReplies = (repliesOf.get(c.id) ?? []).some((r) =>
          r.body.toLowerCase().includes(q)
        );
        if (!inSelf && !inReplies) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "time") return (a.timecode ?? 1e9) - (b.timecode ?? 1e9);
      const d = Date.parse(a.created_at) - Date.parse(b.created_at);
      return sort === "newest" ? -d : d;
    });
  }, [roots, repliesOf, filter, sort, query, meName]);

  // Markers only for unresolved, anchored roots.
  const markers = roots
    .filter((c) => !c.resolved && c.timecode != null)
    .map((c) => ({
      id: c.id,
      timecode: c.timecode as number,
      end: c.timecodeEnd,
      number: c.pinNumber ?? "•",
      active: activeId === c.id,
    }));

  const activeComment = comments.find((c) => c.id === activeId) ?? null;
  // Show the draft while drawing, otherwise the selected comment's annotation.
  const shownDrawing = drawMode ? draft : (activeComment?.drawing ?? null);

  function seekTo(t: number | null, id: string) {
    const c = comments.find((x) => x.id === id);
    // A range comment plays its stretch so you see exactly what is meant.
    if (t != null && c?.timecodeEnd != null && c.timecodeEnd > t) {
      playerRef.current?.playRange(t, c.timecodeEnd);
    } else {
      if (t != null) playerRef.current?.seek(t);
      playerRef.current?.pause();
    }
    setActiveId(id);
    setDrawMode(false);
  }
  function captureHere() {
    const t = playerRef.current?.getTime() ?? currentTime;
    playerRef.current?.pause();
    setPending(round2(t));
    return round2(t);
  }
  // Marks the out-point at the playhead. The in-point is whatever the comment
  // is already pinned to (defaulting to where you started typing).
  function setOutPoint() {
    const now = playerRef.current?.getTime() ?? currentTime;
    const start = pending ?? round2(currentTime);
    if (now <= start) {
      // Out must come after in; nudge the in-point back instead of failing.
      setPending(round2(Math.max(0, now - 1)));
      setPendingEnd(round2(now));
      return;
    }
    if (pending == null) setPending(start);
    setPendingEnd(round2(now));
  }

  function undoStroke() {
    if (!draft?.strokes.length) return;
    const strokes = draft.strokes.slice(0, -1);
    const popped = draft.strokes[draft.strokes.length - 1];
    setRedo((r) => [...r, popped]);
    setDraft(strokes.length ? { ...draft, strokes } : null);
  }
  function redoStroke() {
    if (redo.length === 0) return;
    const next = redo[redo.length - 1];
    setRedo((r) => r.slice(0, -1));
    setDraft((d) =>
      d
        ? { ...d, strokes: [...d.strokes, next] }
        : { w: 16, h: 9, strokes: [next] }
    );
  }

  function startDrawing() {
    captureHere();
    setActiveId(null);
    setDraft(null);
    setRedo([]);
    setDrawMode(true);
  }

  async function post() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    const at = pending ?? round2(currentTime);
    setSending(true);
    const ok = await onPost(t, at, {
      drawing: draft,
      timecodeEnd: pendingEnd != null && pendingEnd > at ? pendingEnd : null,
    });
    setSending(false);
    if (ok) {
      setText("");
      setPending(null);
      setPendingEnd(null);
      setDraft(null);
      setDrawMode(false);
    }
  }

  // Inserts at the caret rather than appending, so an emoji can go mid-sentence.
  // Shared by the main composer and the reply composer.
  function insertAtCaret(
    el: HTMLTextAreaElement | null,
    value: string,
    emoji: string,
    set: (next: string) => void
  ) {
    if (!el) {
      set(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    set(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
  function insertEmoji(e: string) {
    insertAtCaret(textRef.current, text, e, setText);
  }
  function insertReplyEmoji(e: string) {
    insertAtCaret(replyRef.current, replyText, e, setReplyText);
  }

  async function postReply() {
    const t = replyText.trim();
    if (!t || sending || disabled || !replyTo) return;
    setSending(true);
    const ok = await onPost(t, replyTo.timecode ?? 0, { parentId: replyTo.id });
    setSending(false);
    if (ok) {
      setReplyText("");
      setReplyTo(null);
    }
  }

  // Own comment: the portal matches the browser key, the internal surfaces
  // pass the user id as both meKey and the comment's authorKey.
  function isMine(c: PortalComment): boolean {
    return Boolean(meKey && c.authorKey && c.authorKey === meKey);
  }

  async function saveEdit(id: string) {
    const t = editText.trim();
    if (!t || !onEdit) return;
    setSending(true);
    const ok = await onEdit(id, t);
    setSending(false);
    if (ok) setEditingId(null);
  }

  // Expanding the window has to make the MEDIA bigger, not the margins. The
  // canvas already has a roomy layout behind `wide`; reading the modal's state
  // here means every caller gets it without threading a prop.
  const roomy = wide || useModalRoomy();

  const railBtn =
    "grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-surface-2 hover:text-text";

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${
        roomy ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-[1fr_360px]"
      }`}
    >
      <div>
        <ScrubVideo
          ref={playerRef}
          src={videoUrl}
          markers={markers}
          onMarkerClick={(id) => {
            const c = comments.find((x) => x.id === id);
            seekTo(c?.timecode ?? null, id);
          }}
          onTime={setCurrentTime}
          maxHeightClass={roomy ? "max-h-[78vh]" : "max-h-[58vh]"}
          drawing={shownDrawing}
          drawActive={drawMode}
          drawTool={tool}
          drawColor={color}
          drawSize={4}
          onDrawChange={(d) => {
            setDraft(d);
            setRedo([]);
          }}
        />

        {drawMode && (
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
            hint="Mark up the frame, then write your comment."
          />
        )}
      </div>

      {/* Comments */}
      {/* Height matched to the player. The rail already scrolls internally,
          but with no cap it simply grew, taking the grid row and the modal with
          it. */}
      <div
        className={`flex min-h-[320px] flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm ${
          roomy ? "lg:max-h-[78vh]" : "lg:max-h-[58vh]"
        }`}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-1">
            <span className="font-display text-sm font-bold text-text">
              Comments
            </span>
            <span
              className="rounded-pill px-2 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              {roots.length}
            </span>
            <span className="flex-1" />
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={railBtn}
              title="Search comments"
              aria-label="Search comments"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </div>

          {searchOpen && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search comments…"
              autoFocus
              className="mt-2 w-full rounded-[9px] border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
            />
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1">
            {FILTERS.map((f) => {
              const n =
                f.key === "open"
                  ? openCount
                  : f.key === "resolved"
                    ? resolvedCount
                    : null;
              if (f.key === "resolved" && resolvedCount === 0) return null;
              if (f.key === "mine" && !meName) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-pill px-2 py-0.5 text-[11px] font-bold transition ${
                    filter === f.key
                      ? "bg-accent text-accent-fg"
                      : "text-text-faint hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {f.label}
                  {n != null ? ` ${n}` : ""}
                </button>
              );
            })}
            <span className="flex-1" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort comments"
              className="rounded-[7px] border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-text-muted outline-none focus:border-accent"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div
                className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-[13px]"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10 8 6 4-6 4V8z" />
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-text">
                {roots.length === 0
                  ? "No comments yet"
                  : "Nothing matches this filter"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {roots.length === 0
                  ? "Pause where you want feedback and add a comment at that moment."
                  : "Try a different filter or clear the search."}
              </p>
            </div>
          ) : (
            visible.map((c) => {
              const replies = repliesOf.get(c.id) ?? [];
              return (
                <div
                  key={c.id}
                  className={`border-l-[3px] transition ${
                    activeId === c.id
                      ? "border-accent bg-accent-soft/40"
                      : "border-transparent"
                  } ${c.resolved ? "opacity-55" : ""}`}
                >
                  <div
                    onClick={() => seekTo(c.timecode, c.id)}
                    className="flex cursor-pointer items-start gap-2.5 px-3 py-3 hover:bg-surface-2/60"
                  >
                    {c.timecode != null ? (
                      <span className="mt-0.5 flex shrink-0 flex-col items-start gap-0.5">
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-white"
                          style={{
                            backgroundColor: c.resolved
                              ? "var(--border-strong)"
                              : "var(--accent)",
                          }}
                        >
                          {fmtTimecode(c.timecode)}
                        </span>
                        {c.timecodeEnd != null && (
                          <span className="pl-0.5 text-[9px] font-bold tabular-nums text-text-faint">
                            to {fmtTimecode(c.timecodeEnd)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="mt-0.5 h-5 w-12 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-text">
                          {c.author}
                        </span>
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={
                            c.isClient
                              ? { backgroundColor: "var(--h-cyan)", color: "#fff" }
                              : {
                                  backgroundColor: "var(--surface-2)",
                                  color: "var(--text-muted)",
                                }
                          }
                        >
                          {c.isClient ? "Client" : "Studio"}
                        </span>
                        {c.drawing && (
                          <span
                            title="Has a drawing on the frame"
                            className="text-text-faint"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 19l7-7 3 3-7 7-3-3z" />
                              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                            </svg>
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[11px] font-semibold text-text-faint">
                          {c.pinNumber ? `#${c.pinNumber} · ` : ""}
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      {editingId === c.id ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            className="mt-1 min-h-[56px] w-full rounded-[10px] border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text outline-none focus:border-accent"
                          />
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-[11px] font-semibold text-text-faint hover:text-text"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(c.id)}
                              disabled={sending || !editText.trim()}
                              className="rounded-[8px] bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-text-muted">
                          {c.body}
                          {c.editedAt && (
                            <span className="ml-1 text-[10px] font-semibold text-text-faint">
                              (edited)
                            </span>
                          )}
                        </p>
                      )}

                      {onReact && (
                        <CommentReactions
                          reactions={c.reactions}
                          disabled={disabled}
                          onToggle={(emoji) => onReact(c.id, emoji)}
                        />
                      )}

                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyTo(replyTo?.id === c.id ? null : c);
                            setReplyText("");
                          }}
                          className="-my-1 py-1 text-[11px] font-bold text-text-faint transition hover:text-accent"
                        >
                          Reply
                          {replies.length > 0 ? ` (${replies.length})` : ""}
                        </button>
                        {isMine(c) && onEdit && editingId !== c.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(c.id);
                              setEditText(c.body);
                            }}
                            className="-my-1 py-1 text-[11px] font-bold text-text-faint transition hover:text-accent"
                          >
                            Edit
                          </button>
                        )}
                        {isMine(c) && onDelete && (
                          confirmDelete === c.id ? (
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5"
                            >
                              <button
                                onClick={async () => {
                                  await onDelete(c.id);
                                  setConfirmDelete(null);
                                }}
                                className="rounded-[6px] bg-red px-1.5 py-0.5 text-[10px] font-bold text-white"
                              >
                                Delete
                                {replies.length > 0 ? " with replies" : ""}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-[10px] font-semibold text-text-faint hover:text-text"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(c.id);
                              }}
                              className="-my-1 py-1 text-[11px] font-bold text-text-faint transition hover:text-red"
                            >
                              Delete
                            </button>
                          )
                        )}
                        {canResolve && onResolve && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolve(c.id, !c.resolved);
                            }}
                            className="-my-1 inline-flex items-center gap-1 py-1 text-[11px] font-bold text-text-faint transition hover:text-green"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            {c.resolved ? "Resolved · undo" : "Resolve"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {replies.length > 0 && (
                    <div className="ml-4 border-l border-border pl-3 sm:ml-[52px]">
                      {replies.map((r) => (
                        <div
                          key={r.id}
                          onClick={(e) => e.stopPropagation()}
                          className="py-2 pr-3"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-text">
                              {r.author}
                            </span>
                            <span
                              className="rounded-pill px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={
                                r.isClient
                                  ? { backgroundColor: "var(--h-cyan)", color: "#fff" }
                                  : {
                                      backgroundColor: "var(--surface-2)",
                                      color: "var(--text-muted)",
                                    }
                              }
                            >
                              {r.isClient ? "Client" : "Studio"}
                            </span>
                            <span className="ml-auto text-[10px] font-semibold text-text-faint">
                              {timeAgo(r.created_at)}
                            </span>
                          </div>

                          {editingId === r.id ? (
                            <div>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                autoFocus
                                className="mt-1 min-h-[48px] w-full rounded-[10px] border border-border bg-bg px-2.5 py-1.5 text-[12px] text-text outline-none focus:border-accent"
                              />
                              <div className="mt-1.5 flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-[11px] font-semibold text-text-faint hover:text-text"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(r.id)}
                                  disabled={sending || !editText.trim()}
                                  className="rounded-[8px] bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] text-text-muted">
                              {r.body}
                              {r.editedAt && (
                                <span className="ml-1 text-[10px] font-semibold text-text-faint">
                                  (edited)
                                </span>
                              )}
                            </p>
                          )}

                          {onReact && (
                            <CommentReactions
                              reactions={r.reactions}
                              disabled={disabled}
                              onToggle={(emoji) => onReact(r.id, emoji)}
                            />
                          )}

                          {isMine(r) && (onEdit || onDelete) && (
                            <div className="mt-1 flex items-center gap-3">
                              {onEdit && editingId !== r.id && (
                                <button
                                  onClick={() => {
                                    setEditingId(r.id);
                                    setEditText(r.body);
                                  }}
                                  className="text-[10px] font-bold text-text-faint transition hover:text-accent"
                                >
                                  Edit
                                </button>
                              )}
                              {onDelete &&
                                (confirmDelete === r.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <button
                                      onClick={async () => {
                                        await onDelete(r.id);
                                        setConfirmDelete(null);
                                      }}
                                      className="rounded-[6px] bg-red px-1.5 py-0.5 text-[10px] font-bold text-white"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="text-[10px] font-semibold text-text-faint hover:text-text"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(r.id)}
                                    className="text-[10px] font-bold text-text-faint transition hover:text-red"
                                  >
                                    Delete
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {replyTo?.id === c.id && (
                    <div className="ml-4 pb-3 pr-3 sm:ml-[52px]">
                      <textarea
                        ref={replyRef}
                        value={replyText}
                        disabled={disabled}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          disabled
                            ? (disabledHint ?? "Add your name to reply.")
                            : `Reply to ${c.author}…`
                        }
                        autoFocus
                        className="min-h-[52px] w-full rounded-[10px] border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-60"
                      />
                      <div className="mt-1.5 flex items-center gap-2">
                        <EmojiPicker onPick={insertReplyEmoji} />
                        <span className="flex-1" />
                        <button
                          onClick={() => setReplyTo(null)}
                          className="text-[11px] font-semibold text-text-faint hover:text-text"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={postReply}
                          disabled={disabled || sending || !replyText.trim()}
                          className="rounded-[8px] bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
                        >
                          {sending ? "Posting…" : "Reply"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {disabled && disabledHint && (
            <p
              className="mb-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
              style={{
                backgroundColor: "var(--h-amber-bg)",
                color: "var(--h-amber)",
              }}
            >
              {disabledHint}
            </p>
          )}

          <textarea
            ref={textRef}
            value={text}
            disabled={disabled}
            onFocus={() => {
              if (pending == null) captureHere();
            }}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comment at this moment…"
            className="min-h-[64px] w-full rounded-[11px] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
          />

          {/* Toolbar. Always rendered, only inert when gated: hiding the tools
              until a name is typed made drawing and emoji undiscoverable. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[11px] font-bold tabular-nums"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {fmtTimecode(pending ?? currentTime)}
              {pendingEnd != null && (
                <>
                  <span className="opacity-60">to</span>
                  {fmtTimecode(pendingEnd)}
                  <button
                    onClick={() => setPendingEnd(null)}
                    aria-label="Clear the out point"
                    className="ml-0.5 opacity-60 transition hover:opacity-100"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </span>

            <button
              onClick={() => captureHere()}
              disabled={disabled}
              title="Pin the comment to the current frame"
              aria-label="Pin to current frame"
              className="grid h-7 w-7 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5" />
                <path d="M9 10.8V4h6v6.8a2 2 0 0 0 .6 1.4l1.4 1.4V17H7v-3.4l1.4-1.4a2 2 0 0 0 .6-1.4z" />
              </svg>
            </button>

            <button
              onClick={setOutPoint}
              disabled={disabled}
              title="Mark the end of a stretch, so the note covers a range"
              className="inline-flex h-7 items-center gap-1 rounded-[8px] px-1.5 text-[11px] font-bold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4v16M19 4v16M5 12h14" />
              </svg>
              {pendingEnd == null ? "Range" : "Move out"}
            </button>

            <button
              onClick={() => (drawMode ? setDrawMode(false) : startDrawing())}
              disabled={disabled}
              title="Draw on this frame"
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
