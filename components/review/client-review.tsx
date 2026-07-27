"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { viewerKind, officeEmbedUrl } from "@/lib/file-kind";
import { DueBanner } from "@/components/review/due-banner";
import { VersionCompare } from "@/components/review/version-compare";
import { fileSize, shortDate, timeAgo } from "@/lib/format";
import { PinReview } from "@/components/review/pin-review";
import type { Drawing } from "@/lib/review-drawing";
import { VideoReview } from "@/components/review/video-review";
import { reviewerKey } from "@/lib/reviewer-key";
import {
  submitClientComment,
  editClientComment,
  deleteClientComment,
  toggleClientReaction,
  submitClientDecision,
  resolveClientComment,
} from "@/app/r/[token]/actions";
import type { PortalData } from "@/lib/review-links";

const NAME_KEY = "review.name.v1";

export function ClientReview({
  token,
  origin,
  data,
}: {
  token: string;
  origin: string;
  data: PortalData;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  // Identifies this browser so the reviewer can edit/delete their own comments
  // and see which reactions are theirs, with no login.
  const [myKey, setMyKey] = useState("");
  // Which version the canvas and comment thread are showing. Defaults to the
  // current one; picking an older version is a read-only look back.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {}
    // Creates the cookie on first visit; the server reads it on later renders
    // to mark which reactions are this visitor's.
    setMyKey(reviewerKey());
  }, []);

  function rememberName(v: string) {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {}
  }

  const current = useMemo(
    () =>
      data.versions.find((v) => v.id === data.asset.currentVersionId) ??
      data.versions[0] ??
      null,
    [data]
  );
  const latest = current;
  // The version actually on screen. Older versions are viewable with their own
  // comments, so feedback from an earlier round is never stranded.
  const viewing = useMemo(
    () => data.versions.find((v) => v.id === viewingId) ?? latest,
    [data.versions, viewingId, latest]
  );
  const isOlder = Boolean(viewing && latest && viewing.id !== latest.id);
  const comments = viewing
    ? data.comments.filter((c) => c.version_id === viewing.id)
    : [];
  const kind = viewing ? viewerKind(viewing.mime_type, data.asset.name) : null;
  const isImage = kind === "image";
  const isVideo = kind === "video";

  function fileUrl(versionId: string) {
    return `${origin}/r/${token}/file?v=${versionId}`;
  }

  // Pin-review post handler: returns whether it succeeded (so the pin clears).
  async function postPinned(
    text: string,
    pin: { x: number; y: number } | null
  ): Promise<boolean> {
    if (!viewing) return false;
    if (!name.trim()) {
      setError("Add your name first.");
      return false;
    }
    setError(null);
    const res = await submitClientComment(token, viewing.id, name, text, pin);
    if (res?.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  // Video post handler: attaches a timecode instead of an (x,y) pin.
  async function editComment(id: string, body: string): Promise<boolean> {
    const res = await editClientComment(token, id, myKey, body);
    if (res?.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }
  async function deleteComment(id: string): Promise<boolean> {
    const res = await deleteClientComment(token, id, myKey);
    if (res?.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }
  function react(id: string, emoji: string) {
    start(async () => {
      const res = await toggleClientReaction(token, id, emoji, myKey, name);
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  async function postTimed(
    text: string,
    timecode: number,
    extra?: {
      parentId?: string | null;
      drawing?: Drawing | null;
      timecodeEnd?: number | null;
    }
  ): Promise<boolean> {
    if (!viewing) return false;
    if (!name.trim()) {
      setError("Add your name first.");
      return false;
    }
    setError(null);
    const res = await submitClientComment(
      token,
      viewing.id,
      name,
      text,
      null,
      timecode,
      extra?.parentId ?? null,
      extra?.drawing ?? null,
      extra?.timecodeEnd ?? null,
      myKey
    );
    if (res?.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  function resolve(id: string, resolved: boolean) {
    start(async () => {
      await resolveClientComment(token, id, resolved);
      router.refresh();
    });
  }

  function sendComment() {
    if (!current) return;
    if (!name.trim()) return setError("Add your name first.");
    if (!comment.trim()) return setError("Write a comment first.");
    setError(null);
    start(async () => {
      const res = await submitClientComment(token, viewing.id, name, comment);
      if (res?.error) setError(res.error);
      else {
        setComment("");
        router.refresh();
      }
    });
  }

  function decide(status: "approved" | "changes_requested") {
    if (!current) return;
    if (!name.trim()) return setError("Add your name first.");
    setError(null);
    start(async () => {
      const res = await submitClientDecision(token, latest.id, name, status);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const decided = data.myDecision;

  const nameField = (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
        Your name
      </label>
      <input
        value={name}
        onChange={(e) => rememberName(e.target.value)}
        placeholder="e.g. Jordan at Acme"
        className="mt-1.5 w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
      />
    </div>
  );

  // Switching version swaps the review canvas AND the comment thread, so
  // feedback from an earlier round stays reachable instead of being a bare
  // download link. Older versions are read-only: the open round is the latest.
  const versionSwitcher = data.versions.length > 1 && viewing && (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-text-faint">Version</span>
      {data.versions.map((v) => {
        const on = v.id === viewing.id;
        return (
          <button
            key={v.id}
            onClick={() => setViewingId(v.id)}
            title={`${shortDate(v.created_at)}${
              v.id === latest?.id ? " (latest)" : ""
            }`}
            className={`rounded-pill px-2.5 py-1 text-xs font-bold transition ${
              on
                ? "bg-accent text-accent-fg"
                : "border border-border text-text-muted hover:border-border-strong hover:text-text"
            }`}
          >
            v{v.version_number}
            {v.id === latest?.id ? " · latest" : ""}
          </button>
        );
      })}
    </div>
  );

  const olderBanner = isOlder && viewing && (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-[11px] px-3 py-2 text-xs font-semibold"
      style={{
        backgroundColor: "var(--h-amber-bg)",
        color: "var(--h-amber)",
      }}
    >
      <span>
        You are looking back at v{viewing.version_number} and its comments. It
        is read-only.
      </span>
      <button
        onClick={() => setViewingId(null)}
        className="rounded-[8px] bg-white/25 px-2 py-0.5 font-bold underline-offset-2 hover:underline"
      >
        Back to v{latest?.version_number}
      </button>
    </div>
  );

  const metaRow = viewing && (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-faint">
      <span>
        Version {viewing.version_number}
        {viewing.size_bytes ? ` · ${fileSize(viewing.size_bytes)}` : ""}
        {viewing.created_at ? ` · ${shortDate(viewing.created_at)}` : ""}
      </span>
      <a
        href={fileUrl(viewing.id)}
        download={data.asset.name}
        className="font-semibold text-accent hover:underline"
      >
        Download
      </a>
    </div>
  );

  const decision = (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button
        onClick={() => decide("approved")}
        disabled={busy}
        className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
          decided === "approved"
            ? "border-green bg-green-bg text-green"
            : "border-border-strong text-text-muted hover:border-green hover:text-green"
        }`}
      >
        {decided === "approved" ? "You approved this" : "Approve"}
      </button>
      <button
        onClick={() => decide("changes_requested")}
        disabled={busy}
        className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
          decided === "changes_requested"
            ? "border-red bg-red-bg text-red"
            : "border-border-strong text-text-muted hover:border-red hover:text-red"
        }`}
      >
        {decided === "changes_requested" ? "You requested changes" : "Request changes"}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:py-12">
      <div className="mb-6 overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--accent), var(--h-purple) 55%, var(--h-cyan))",
          }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              {data.studioName} · {data.projectTitle}
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-text">
              {data.asset.name}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {isImage
                ? "Click anywhere on the image to leave a pinned comment, then approve or request changes."
                : isVideo
                  ? "Pause at any moment and comment on that timecode, then approve or request changes."
                  : "Please review and approve, or request changes."}
            </p>
          </div>
          {current && (
            <div className="flex shrink-0 items-center gap-2">
              {isImage && data.versions.length >= 2 && (
                <button
                  onClick={() => setCompareMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold transition ${
                    compareMode
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border-strong text-text-muted hover:text-text"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="7" height="16" rx="1" />
                    <rect x="14" y="4" width="7" height="16" rx="1" />
                  </svg>
                  {compareMode ? "Back to review" : "Compare versions"}
                </button>
              )}
              <span className="rounded-pill border border-border-strong px-3 py-1 text-xs font-bold text-text-muted">
                Version {viewing.version_number}
              </span>
            </div>
          )}
        </div>
      </div>

      <DueBanner dueDate={data.dueDate} resolved={Boolean(decided)} />

      {!current ? (
        <p className="rounded-[14px] border border-dashed border-border px-4 py-12 text-center text-sm text-text-faint">
          There is nothing to review here yet.
        </p>
      ) : isImage && compareMode ? (
        <>
          <VersionCompare
            versions={data.versions}
            currentId={viewing.id}
            urlFor={fileUrl}
            alt={data.asset.name}
          />
          {metaRow}
        </>
      ) : isImage ? (
        <>
          <div className="mb-4 max-w-md">{nameField}</div>
          {versionSwitcher}
          {olderBanner}
          <PinReview
            imageUrl={fileUrl(viewing.id)}
            alt={data.asset.name}
            comments={comments}
            disabled={isOlder || !name.trim()}
            disabledHint={
              isOlder
                ? `v${viewing.version_number} is an earlier version, so it is read-only.`
                : "Add your name above to comment."
            }
            wide
            onPost={postPinned}
            onResolve={resolve}
          />
          {metaRow}
          {!isOlder && decision}
          {error && (
            <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </>
      ) : isVideo ? (
        <>
          <div className="mb-4 max-w-md">{nameField}</div>
          {versionSwitcher}
          {olderBanner}
          <VideoReview
            videoUrl={fileUrl(viewing.id)}
            comments={comments}
            disabled={isOlder || !name.trim()}
            disabledHint={
              isOlder
                ? `v${viewing.version_number} is an earlier version, so it is read-only.`
                : "Add your name above to comment."
            }
            wide
            meName={name.trim() || null}
            meKey={myKey || null}
            onPost={postTimed}
            onResolve={resolve}
            onEdit={editComment}
            onDelete={deleteComment}
            onReact={react}
          />
          {metaRow}
          {!isOlder && decision}
          {error && (
            <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <ReviewPreview
            name={data.asset.name}
            versionNumber={viewing.version_number}
            url={fileUrl(viewing.id)}
            mime={viewing.mime_type}
          />
          {metaRow}

          <div className="mt-8 max-w-md">{nameField}</div>
          {decision}

          <div className="mt-8 border-t border-border pt-6">
            <h2 className="font-display text-base font-bold text-text">Comments</h2>
            {comments.length > 0 ? (
              <ol className="mt-4 space-y-4">
                {comments.map((c) => (
                  <li key={c.id}>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">{c.author}</span>
                      {!c.isClient && (
                        <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                          Studio
                        </span>
                      )}
                      <span className="text-xs text-text-faint">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-text-faint">
                No comments yet. Add the first one below.
              </p>
            )}

            <div className="mt-5">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment for the studio..."
                className="min-h-[84px] w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={sendComment}
                  disabled={busy || !comment.trim()}
                  className="rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy ? "Sending..." : "Comment"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </>
      )}

      <p className="mt-12 text-center text-xs text-text-faint">
        Shared securely by {data.studioName}
      </p>
    </div>
  );
}

function ReviewPreview({
  name,
  versionNumber,
  url,
  mime,
}: {
  name: string;
  versionNumber: number;
  url: string;
  mime: string | null;
}) {
  const kind = viewerKind(mime, name);

  const frame =
    "w-full overflow-hidden rounded-[16px] border border-border bg-surface-2/40";

  if (kind === "image") {
    return (
      <div className={`${frame} flex items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-[70vh] w-full object-contain" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className={`${frame} flex items-center justify-center`}>
        <video src={url} controls className="max-h-[70vh] w-full" />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className={`${frame} p-6`}>
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={name}
        className="h-[75vh] w-full rounded-[16px] border border-border bg-white"
      />
    );
  }
  if (kind === "office") {
    return (
      <iframe
        src={officeEmbedUrl(url)}
        title={name}
        className="h-[75vh] w-full rounded-[16px] border border-border bg-white"
      />
    );
  }
  if (kind === "text") {
    return (
      <iframe
        src={url}
        title={name}
        className="h-[60vh] w-full rounded-[16px] border border-border bg-white"
      />
    );
  }
  return (
    <div className={`${frame} flex flex-col items-center gap-3 py-16 text-center`}>
      <p className="text-sm text-text-muted">
        Preview isn&apos;t available for this file type.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
      >
        Open v{versionNumber}
      </a>
    </div>
  );
}
