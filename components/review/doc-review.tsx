"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PinCanvas } from "@/components/review/pin-canvas";
import { DueBanner } from "@/components/review/due-banner";
import { DocSurfaceView } from "@/components/review/doc-surface";
import {
  AiShotReviewCanvas,
  type ShotAnchor,
} from "@/components/review/ai-shot-review-canvas";
import {
  submitDocComment,
  submitDocDecision,
  resolveDocComment,
} from "@/app/r/[token]/actions";
import type { DocReviewData } from "@/lib/review-links";

const NAME_KEY = "review.name.v1";

const KIND_LABEL: Record<string, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
  ai_shot: "shot",
};

export function DocReview({
  token,
  data,
}: {
  token: string;
  data: DocReviewData;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
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

  async function post(text: string, anchor: ShotAnchor): Promise<boolean> {
    if (!name.trim()) {
      setError("Add your name first.");
      return false;
    }
    setError(null);
    const res = await submitDocComment(
      token,
      name,
      text,
      anchor.pin ?? null,
      anchor.timecode ?? null
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
      await resolveDocComment(token, id, resolved);
      router.refresh();
    });
  }

  function decide(status: "approved" | "changes_requested") {
    if (!name.trim()) return setError("Add your name first.");
    setError(null);
    start(async () => {
      const res = await submitDocDecision(token, name, status);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const decided = data.myDecision;
  const noun = KIND_LABEL[data.kind] ?? "document";

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
              {data.docTitle}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {data.surface.kind === "ai_shot" && data.surface.takeVideoUrl
                ? "Pause the take where you want feedback and comment at that moment, then approve or request changes."
                : `Click anywhere on the ${noun} to leave a pinned comment, then approve or request changes.`}
            </p>
          </div>
          <span className="shrink-0 rounded-pill border border-border-strong px-3 py-1 text-xs font-bold uppercase tracking-wide text-text-muted">
            {noun}
          </span>
        </div>
      </div>

      <DueBanner dueDate={data.dueDate} resolved={Boolean(decided)} />

      <div className="mb-4 max-w-md">
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

      {data.surface.kind === "ai_shot" ? (
        <AiShotReviewCanvas
          surface={data.surface}
          comments={data.comments}
          disabled={!name.trim()}
          disabledHint="Add your name above to comment."
          wide
          onPost={post}
          onResolve={resolve}
        />
      ) : (
        <PinCanvas
          stage={<DocSurfaceView surface={data.surface} />}
          stageBg="var(--surface-2)"
          fit="full"
          comments={data.comments}
          disabled={!name.trim()}
          disabledHint="Add your name above to comment."
          wide
          emptyHint={`Click anywhere on the ${noun} to drop a pin and start.`}
          onPost={(text, pin) => post(text, { pin })}
          onResolve={resolve}
        />
      )}

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

      {error && (
        <p className="mt-4 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {error}
        </p>
      )}

      <p className="mt-12 text-center text-xs text-text-faint">
        Shared securely by {data.studioName}
      </p>
    </div>
  );
}
