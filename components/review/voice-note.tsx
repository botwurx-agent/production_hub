"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { uploadVoiceNote } from "@/app/(app)/voice-actions";
import { uploadClientVoiceNote } from "@/app/r/[token]/actions";
import {
  MAX_VOICE_SECONDS,
  RECORDER_TYPES,
  fmtVoice,
} from "@/lib/voice-note";

/**
 * Voice notes on review comments.
 *
 * A CONTEXT, like the Team only switch, because eight surfaces mount the same
 * two composers and none of them should have to know whether it is in the
 * app or on the client portal. The app layout mounts the signed-in provider;
 * the portal mounts one bound to its review link. A composer with no provider
 * above it simply offers no microphone.
 *
 * Playback never signs a URL into the page. `src(id)` names an access-checked
 * route that redirects to a short-lived signed file.
 */
type VoiceApi = {
  upload: (form: FormData) => Promise<{ path: string } | { error: string }>;
  src: (commentId: string) => string;
};

const VoiceContext = createContext<VoiceApi | null>(null);

export function AppVoiceProvider({ children }: { children: ReactNode }) {
  return (
    <VoiceContext.Provider
      value={{ upload: (f) => uploadVoiceNote(f), src: (id) => `/api/voice/${id}` }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function PortalVoiceProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return (
    <VoiceContext.Provider
      value={{
        upload: (f) => uploadClientVoiceNote(token, f),
        src: (id) => `/r/${token}/voice/${id}`,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export type VoiceDraft = { blob: Blob; mime: string; seconds: number };
export type VoiceAttachment = { path: string; seconds: number | null };

/**
 * The composer's half: holds a recorded draft and uploads it at post time.
 * `upload()` resolves to null when there is nothing to send, the attachment
 * when it went up, and false when it failed (with `error` set), so a failed
 * upload never posts a comment that silently lost its voice note.
 */
export function useVoiceDraft() {
  const api = useContext(VoiceContext);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function upload(): Promise<VoiceAttachment | null | false> {
    if (!draft || !api) return null;
    const form = new FormData();
    const ext = draft.mime.includes("mp4") ? "m4a" : draft.mime.includes("ogg") ? "ogg" : "webm";
    form.append("file", new File([draft.blob], `voice.${ext}`, { type: draft.mime }));
    let res: { path: string } | { error: string } | undefined;
    try {
      res = await api.upload(form);
    } catch {
      res = undefined;
    }
    if (!res || "error" in res) {
      setError(res && "error" in res ? res.error : "The voice note did not upload. Try again.");
      return false;
    }
    setError(null);
    return { path: res.path, seconds: Math.round(draft.seconds * 10) / 10 };
  }
  return {
    available: Boolean(api),
    draft,
    setDraft,
    error,
    clear: () => {
      setDraft(null);
      setError(null);
    },
    upload,
  };
}

function pickType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of RECORDER_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* keep looking */
    }
  }
  return "";
}

/**
 * The microphone button and what follows it: recording with a running clock
 * and Stop, then a playable preview of the take with a remove button. Nothing
 * uploads until the comment is posted, so abandoning a take costs nothing.
 */
export function VoiceRecorder({
  voice,
  disabled,
}: {
  voice: ReturnType<typeof useVoiceDraft>;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const previewUrl = useBlobUrl(voice.draft?.blob ?? null);

  useEffect(() => {
    setSupported(pickType() !== null && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => stopTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTracks() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setProblem(null);
    const type = pickType();
    if (type === null) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem("The microphone is blocked. Allow it in the browser to record.");
      return;
    }
    streamRef.current = stream;
    const rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const seconds = (Date.now() - startRef.current) / 1000;
      stopTracks();
      setPhase("idle");
      const mime = (rec.mimeType || type || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type: mime });
      if (blob.size > 0 && seconds >= 0.5) voice.setDraft({ blob, mime, seconds });
      else setProblem("That was too short to keep.");
    };
    recRef.current = rec;
    startRef.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setPhase("recording");
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startRef.current) / 1000;
      setElapsed(s);
      if (s >= MAX_VOICE_SECONDS) rec.state !== "inactive" && rec.stop();
    }, 200);
  }

  function stop() {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  if (!voice.available || !supported) return null;

  if (phase === "recording") {
    return (
      <span className="inline-flex h-7 items-center gap-2 rounded-[8px] border border-border bg-surface px-2 text-[11px] font-bold text-text">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--h-red)" }} />
        <span className="tabular-nums">
          {fmtVoice(elapsed)} / {fmtVoice(MAX_VOICE_SECONDS)}
        </span>
        <button
          onClick={stop}
          className="rounded-[6px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg"
        >
          Stop
        </button>
      </span>
    );
  }

  if (voice.draft && previewUrl) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <audio src={previewUrl} controls preload="metadata" className="h-8 w-[200px] max-w-full" />
        {/* A fresh browser recording carries no length until it has played
            once, so the player reads 0:00; the length we measured is the truth. */}
        <span className="text-[11px] font-semibold tabular-nums text-text-muted">
          {fmtVoice(voice.draft.seconds)}
        </span>
        <button
          onClick={voice.clear}
          title="Remove the voice note"
          aria-label="Remove the voice note"
          className="grid h-7 w-7 place-items-center rounded-[8px] text-text-faint transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        {voice.error && (
          <span role="alert" className="text-[11px] font-medium text-text">
            {voice.error}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={start}
        disabled={disabled}
        title="Record a voice note"
        aria-label="Record a voice note"
        className="inline-flex h-7 items-center gap-1 rounded-[8px] px-1.5 text-[11px] font-bold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        Voice
      </button>
      {(problem || voice.error) && (
        <span className="text-[11px] font-medium text-text">{problem ?? voice.error}</span>
      )}
    </>
  );
}

function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** A posted voice note, under its comment. Loads nothing until played. */
export function VoicePlayer({
  commentId,
  seconds,
}: {
  commentId: string;
  seconds: number | null;
}) {
  const api = useContext(VoiceContext);
  if (!api) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <audio src={api.src(commentId)} controls preload="none" className="h-8 w-full max-w-[240px]" />
      {seconds != null && (
        <span className="text-[11px] font-semibold tabular-nums text-text-muted">
          {fmtVoice(seconds)}
        </span>
      )}
    </div>
  );
}
