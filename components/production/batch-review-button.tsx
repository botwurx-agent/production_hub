"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  createBatchReview,
  revokeBatchReview,
} from "@/app/(app)/projects/[id]/batch-review-actions";
import type { AiGeneration } from "@/lib/database.types";
import type { BatchReviewSummary } from "@/lib/batch-review";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

function shareOrigin(): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return site || (typeof window !== "undefined" ? window.location.origin : "");
}

// Per-reviewer roll-up of one batch's feedback.
function ResultsBlock({
  projectId, review,
}: {
  projectId: string; review: BatchReviewSummary;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const url = `${shareOrigin()}/rb/${review.token}`;
  const optionOf = (gid: string) => review.generationIds.indexOf(gid) + 1;

  const reviewers = useMemo(() => {
    const set = new Set<string>();
    review.marks.forEach((m) => set.add(m.reviewerName));
    review.comments.forEach((c) => set.add(c.reviewerName));
    return Array.from(set).filter(Boolean);
  }, [review]);

  function copy() {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className={`rounded-[12px] border border-border p-3 ${review.revoked ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-text">{review.title}</span>
        <span className="text-xs text-text-faint">{review.generationIds.length} options</span>
        {review.revoked && <span className="text-xs font-semibold text-red">Link off</span>}
        <span className="ml-auto flex items-center gap-2">
          {!review.revoked && (
            <button onClick={copy} className="rounded-[7px] border border-border px-2 py-1 text-[11px] font-bold text-text-muted hover:text-text">
              {copied ? "Copied" : "Copy link"}
            </button>
          )}
          {!review.revoked && (
            <button
              onClick={() => start(async () => { await revokeBatchReview(projectId, review.id); router.refresh(); })}
              disabled={busy}
              className="rounded-[7px] px-2 py-1 text-[11px] font-semibold text-text-faint hover:text-red">
              Turn off
            </button>
          )}
        </span>
      </div>

      {reviewers.length === 0 ? (
        <p className="mt-2 text-xs text-text-faint">No feedback yet. Share the link.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {reviewers.map((r) => {
            const pick = review.marks.find((m) => m.reviewerName === r && m.isPick);
            const stars = review.marks.filter((m) => m.reviewerName === r && m.starred).map((m) => optionOf(m.generationId));
            const notes = review.comments.filter((c) => c.reviewerName === r);
            return (
              <div key={r} className="rounded-[9px] bg-surface-2/50 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-text">{r}</span>
                  {pick ? (
                    <span className="rounded-pill bg-green-bg px-2 py-0.5 font-extrabold text-green">
                      Picked Option {optionOf(pick.generationId)}
                    </span>
                  ) : (
                    <span className="text-text-faint">no pick yet</span>
                  )}
                  {stars.length > 0 && (
                    <span className="text-amber-500">★ {stars.map((n) => `#${n}`).join(", ")}</span>
                  )}
                </div>
                {notes.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {notes.map((n) => (
                      <li key={n.id} className="flex gap-2 text-[12px]">
                        <span className="shrink-0 rounded bg-black/10 px-1.5 font-bold text-text-muted">
                          #{optionOf(n.generationId)}{n.timecode != null ? ` @${Math.floor(n.timecode / 60)}:${String(Math.floor(n.timecode % 60)).padStart(2, "0")}` : ""}
                        </span>
                        <span className="text-text-muted">{n.body}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BatchReviewButton({
  projectId, shotId, pool, media, reviews,
}: {
  projectId: string;
  shotId: string;
  pool: AiGeneration[];
  media: Record<string, string>;
  reviews: BatchReviewSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const candidates = pool.filter((g) => g.status !== "rejected");

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function create() {
    setErr(null);
    if (selected.length === 0) { setErr("Pick at least one option to send."); return; }
    start(async () => {
      const res = await createBatchReview(projectId, { shotId, generationIds: selected, title: title || null });
      if (!res || res.error || !res.token) { setErr(res?.error ?? "Could not create the link."); return; }
      setNewUrl(`${shareOrigin()}/rb/${res.token}`);
      setCreating(false);
      setSelected([]);
      setTitle("");
      router.refresh();
    });
  }
  function copyNew() {
    if (!newUrl) return;
    navigator.clipboard?.writeText(newUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  const activeCount = reviews.filter((r) => !r.revoked).length;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-xs font-bold text-text transition hover:border-accent hover:text-accent"
        title="Send a few options to someone for a pick + notes">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a3 3 0 1 0-2.83-4M6 12a3 3 0 1 0 0 .01M18 19a3 3 0 1 0-2.83-2M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Send for a pick{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} size="lg" title="Send options for review">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Pick the options you want a read on and share a no-login link. The reviewer plays each, stars,
              marks their pick, and leaves notes; it all comes back here without touching your candidates.
            </p>

            {newUrl && (
              <div className="rounded-[10px] border border-green bg-green-bg/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green">Link ready</p>
                <div className="mt-1 flex items-center gap-2">
                  <input readOnly value={newUrl} className={`${field} text-xs`} onFocus={(e) => e.target.select()} />
                  <Button size="sm" onClick={copyNew}>{copied ? "Copied" : "Copy"}</Button>
                </div>
              </div>
            )}

            {creating ? (
              <div className="space-y-3 rounded-[12px] border border-border bg-surface-2/40 p-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Ask (optional)</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Which reference feels right?" className={`mt-1 ${field}`} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                    Choose options <span className="font-normal normal-case text-text-faint">({selected.length} selected)</span>
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {candidates.map((g) => {
                      const src = media[g.id] ?? g.external_url ?? null;
                      const on = selected.includes(g.id);
                      return (
                        <button key={g.id} onClick={() => toggle(g.id)}
                          className={`relative overflow-hidden rounded-[9px] border-2 transition ${on ? "border-accent" : "border-transparent hover:border-border-strong"}`}
                          style={{ aspectRatio: "16/9", background: "#18181b" }}>
                          {src && (g.kind === "video"
                            ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                            // eslint-disable-next-line @next/next/no-img-element
                            : <img src={src} alt="" className="h-full w-full object-cover" />)}
                          {on && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-extrabold text-accent-fg">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {err && <p className="text-xs font-semibold text-red">{err}</p>}
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setErr(null); }} disabled={busy}>Cancel</Button>
                  <Button size="sm" onClick={create} disabled={busy || selected.length === 0}>
                    {busy ? "Creating…" : `Create link (${selected.length})`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setCreating(true); setNewUrl(null); }}>+ New review</Button>
              </div>
            )}

            {reviews.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Sent reviews &amp; feedback</p>
                {reviews.map((r) => <ResultsBlock key={r.id} projectId={projectId} review={r} />)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
