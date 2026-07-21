"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitBatchComment, setBatchMark } from "@/app/rb/[token]/actions";
import { ScrubVideo, fmtTime, type ScrubVideoHandle } from "@/components/review/video-player";
import type { BatchReviewData, BatchComment, BatchMark } from "@/lib/batch-review";

const fmt = fmtTime;

function upsertMark(
  list: BatchMark[],
  gid: string,
  reviewer: string,
  patch: { starred?: boolean; isPick?: boolean }
): BatchMark[] {
  const i = list.findIndex((m) => m.generationId === gid && m.reviewerName === reviewer);
  if (i >= 0) {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    return next;
  }
  return [
    ...list,
    { generationId: gid, reviewerName: reviewer, starred: patch.starred ?? false, isPick: patch.isPick ?? false },
  ];
}

export function BatchReview({ token, data }: { token: string; data: BatchReviewData }) {
  const [name, setName] = useState("");
  useEffect(() => {
    const n = typeof window !== "undefined" ? localStorage.getItem("review.name") : null;
    if (n) setName(n);
  }, []);
  function saveName(v: string) {
    setName(v);
    try { localStorage.setItem("review.name", v); } catch { /* ignore */ }
  }

  const items = data.items;
  const [index, setIndex] = useState(0);
  const [comments, setComments] = useState<BatchComment[]>(data.comments);
  const [marks, setMarks] = useState<BatchMark[]>(data.marks);
  const [, start] = useTransition();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const playerRef = useRef<ScrubVideoHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const reviewer = name.trim();
  const named = reviewer.length > 0;
  const cur = items[index] ?? null;
  const isVideo = cur?.kind === "video" && Boolean(cur.mediaUrl);

  const myPickId = useMemo(
    () => marks.find((m) => m.reviewerName === reviewer && m.isPick)?.generationId ?? null,
    [marks, reviewer]
  );
  const myMark = (gid: string) => marks.find((m) => m.generationId === gid && m.reviewerName === reviewer);
  const curComments = useMemo(
    () =>
      comments
        .filter((c) => c.generationId === cur?.generationId)
        .sort((a, b) => (a.timecode ?? 1e9) - (b.timecode ?? 1e9) || a.createdAt.localeCompare(b.createdAt)),
    [comments, cur]
  );
  const commentCount = (gid: string) => comments.filter((c) => c.generationId === gid).length;

  function requireName(): boolean {
    if (!named) { setErr("Add your name at the top first."); return false; }
    setErr(null);
    return true;
  }

  function toggleStar(gid: string) {
    if (!requireName()) return;
    const next = !(myMark(gid)?.starred ?? false);
    setMarks((p) => upsertMark(p, gid, reviewer, { starred: next }));
    start(async () => { await setBatchMark(token, gid, reviewer, { starred: next }); });
  }
  function pick(gid: string) {
    if (!requireName()) return;
    setMarks((p) => {
      const cleared = p.map((m) => (m.reviewerName === reviewer ? { ...m, isPick: false } : m));
      return upsertMark(cleared, gid, reviewer, { isPick: true });
    });
    start(async () => { await setBatchMark(token, gid, reviewer, { isPick: true }); });
  }
  function postComment() {
    if (!requireName() || !cur) return;
    const body = text.trim();
    if (!body) return;
    const tc = isVideo ? Math.round(currentTime * 100) / 100 : null;
    const optimistic: BatchComment = {
      id: `tmp-${comments.length}-${body.length}`,
      generationId: cur.generationId,
      reviewerName: reviewer,
      body,
      timecode: tc,
      createdAt: new Date().toISOString(),
    };
    setComments((p) => [...p, optimistic]);
    setText("");
    start(async () => {
      const res = await submitBatchComment(token, cur.generationId, reviewer, body, tc);
      if (res?.error) setErr(res.error);
    });
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text">Nothing to review</h1>
        <p className="mt-2 text-sm text-text-muted">This set has no options.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:py-10">
      {/* Header + name */}
      <div className="mb-5 rounded-[16px] border border-border bg-surface p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          {data.shotTitle ? `${data.shotTitle} · ` : ""}Which one?
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-text">{data.title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {items.length} option{items.length === 1 ? "" : "s"}. Play each, star the ones you like, mark your
          pick, and leave notes. Your feedback goes straight back to the team.
        </p>
        <div className="mt-3 max-w-sm">
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Your name</label>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="e.g. Alex (Creative Director)"
            className="mt-1 w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* Stage */}
        <div>
          <div className="relative">
            {cur?.mediaUrl ? (
              isVideo ? (
                <ScrubVideo
                  ref={playerRef}
                  key={cur.generationId}
                  src={cur.mediaUrl}
                  markers={curComments
                    .filter((c) => c.timecode != null)
                    .map((c) => ({ id: c.id, timecode: c.timecode as number, number: "•" }))}
                  onMarkerClick={(id) => {
                    const c = comments.find((x) => x.id === id);
                    if (c?.timecode != null) { playerRef.current?.seek(c.timecode); playerRef.current?.pause(); }
                  }}
                  onTime={setCurrentTime}
                  maxHeightClass="max-h-[70vh]"
                />
              ) : (
                <div className="flex items-center justify-center overflow-hidden rounded-[16px] p-3" style={{ backgroundColor: "#0b0b0d", minHeight: 360 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cur.mediaUrl} alt="" className="max-h-[70vh] w-full rounded-[10px] object-contain" />
                </div>
              )
            ) : (
              <div className="grid place-items-center overflow-hidden rounded-[16px] p-3" style={{ backgroundColor: "#0b0b0d", minHeight: 360 }}>
                <span className="px-6 text-center text-sm text-white/50">No preview for this option.</span>
              </div>
            )}
            <span className="absolute left-3 top-3 z-10 rounded-[6px] bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
              Option {index + 1} / {items.length}
            </span>
            {cur && myPickId === cur.generationId && (
              <span className="absolute right-3 top-3 z-10 rounded-[6px] bg-green px-2 py-0.5 text-[11px] font-extrabold text-white">
                Your pick
              </span>
            )}
          </div>

          {/* Decision row */}
          {cur && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => pick(cur.generationId)}
                className="rounded-[11px] px-4 py-2 text-sm font-bold transition"
                style={
                  myPickId === cur.generationId
                    ? { background: "var(--green)", color: "#fff" }
                    : { background: "var(--h-green-bg)", color: "var(--h-green)" }
                }
              >
                {myPickId === cur.generationId ? "✓ This is my pick" : "This is my pick"}
              </button>
              <button
                onClick={() => toggleStar(cur.generationId)}
                className="rounded-[11px] px-4 py-2 text-sm font-bold transition"
                style={
                  myMark(cur.generationId)?.starred
                    ? { background: "#fbbf24", color: "#0b0b0d" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)" }
                }
              >
                {myMark(cur.generationId)?.starred ? "★ Starred" : "☆ Star"}
              </button>
              {cur.model && <span className="text-xs text-text-faint">{cur.model}</span>}
            </div>
          )}

          {/* Filmstrip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {items.map((it, i) => {
              const mk = myMark(it.generationId);
              return (
                <button
                  key={it.generationId}
                  onClick={() => setIndex(i)}
                  className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-[9px] border-2 transition ${
                    i === index ? "border-accent" : "border-transparent hover:border-border-strong"
                  }`}
                  style={{ background: "#18181b" }}
                >
                  {it.mediaUrl ? (
                    it.kind === "video" ? (
                      <video src={`${it.mediaUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.mediaUrl} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{i + 1}</span>
                  {mk?.isPick && <span className="absolute right-1 top-1 rounded bg-green px-1 text-[9px] font-extrabold text-white">✓</span>}
                  {mk?.starred && !mk?.isPick && <span className="absolute right-1 top-1 text-[11px] text-amber-300">★</span>}
                  {commentCount(it.generationId) > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">
                      {commentCount(it.generationId)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comments */}
        <div className="flex min-h-[360px] flex-col overflow-hidden rounded-[16px] border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <span className="font-display text-sm font-bold text-text">Notes on option {index + 1}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {curComments.length === 0 ? (
              <p className="text-sm text-text-faint">No notes yet. Add one below.</p>
            ) : (
              curComments.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-text">{c.reviewerName || "Reviewer"}</span>
                    {c.timecode != null && (
                      <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-accent">
                        {fmt(c.timecode)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-text-muted">{c.body}</p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border p-3">
            {isVideo && (
              <div className="mb-2 text-[11px] font-semibold text-text-muted">
                Pinned to <span className="tabular-nums text-accent">{fmt(currentTime)}</span> · pause where you want feedback
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={named ? "Add a note on this option…" : "Add your name above to comment"}
              disabled={!named}
              className="min-h-[64px] w-full rounded-[11px] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
            />
            {err && <p className="mt-1 text-xs font-medium text-red">{err}</p>}
            <div className="mt-2 flex justify-end">
              <button
                onClick={postComment}
                disabled={!named || !text.trim()}
                className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
              >
                Post note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
