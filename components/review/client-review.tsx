"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { viewerKind, officeEmbedUrl } from "@/lib/file-kind";
import { fileSize, shortDate, timeAgo } from "@/lib/format";
import { PinReview } from "@/components/review/pin-review";
import { VideoReview } from "@/components/review/video-review";
import {
  submitClientComment,
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
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {}
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
  const previous = data.versions.filter((v) => v.id !== current?.id);
  const comments = current
    ? data.comments.filter((c) => c.version_id === current.id)
    : [];
  const kind = current ? viewerKind(current.mime_type, data.asset.name) : null;
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
    if (!current) return false;
    if (!name.trim()) {
      setError("Add your name first.");
      return false;
    }
    setError(null);
    const res = await submitClientComment(token, current.id, name, text, pin);
    if (res?.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  // Video post handler: attaches a timecode instead of an (x,y) pin.
  async function postTimed(text: string, timecode: number): Promise<boolean> {
    if (!current) return false;
    if (!name.trim()) {
      setError("Add your name first.");
      return false;
    }
    setError(null);
    const res = await submitClientComment(
      token,
      current.id,
      name,
      text,
      null,
      timecode
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
      const res = await submitClientComment(token, current.id, name, comment);
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
      const res = await submitClientDecision(token, current.id, name, status);
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

  const metaRow = current && (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-faint">
      <span>
        Version {current.version_number}
        {current.size_bytes ? ` · ${fileSize(current.size_bytes)}` : ""}
        {current.created_at ? ` · ${shortDate(current.created_at)}` : ""}
        {previous.length > 0 && (
          <>
            {"  ·  Previous: "}
            {previous.map((v, i) => (
              <span key={v.id}>
                {i > 0 ? ", " : ""}
                <a
                  href={fileUrl(v.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  v{v.version_number}
                </a>
              </span>
            ))}
          </>
        )}
      </span>
      <a
        href={fileUrl(current.id)}
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
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
            <span className="shrink-0 rounded-pill border border-border-strong px-3 py-1 text-xs font-bold text-text-muted">
              Version {current.version_number}
            </span>
          )}
        </div>
      </div>

      {!current ? (
        <p className="rounded-[14px] border border-dashed border-border px-4 py-12 text-center text-sm text-text-faint">
          There is nothing to review here yet.
        </p>
      ) : isImage ? (
        <>
          <div className="mb-4 max-w-md">{nameField}</div>
          <PinReview
            imageUrl={fileUrl(current.id)}
            alt={data.asset.name}
            comments={comments}
            disabled={!name.trim()}
            disabledHint="Add your name above to comment."
            onPost={postPinned}
            onResolve={resolve}
          />
          {metaRow}
          {decision}
          {error && (
            <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </>
      ) : isVideo ? (
        <>
          <div className="mb-4 max-w-md">{nameField}</div>
          <VideoReview
            videoUrl={fileUrl(current.id)}
            comments={comments}
            disabled={!name.trim()}
            disabledHint="Add your name above to comment."
            onPost={postTimed}
            onResolve={resolve}
          />
          {metaRow}
          {decision}
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
            versionNumber={current.version_number}
            url={fileUrl(current.id)}
            mime={current.mime_type}
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
