"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getTranscript,
  saveTranscript,
  transcribePiece,
} from "@/app/(app)/transcript-actions";
import { getClientTranscript } from "@/app/r/[token]/actions";
import {
  MAX_TRANSCRIBE_BYTES,
  MAX_TRANSCRIBE_SECONDS,
  TRANSCRIBE_RATE,
  chunkIsSilent,
  clock,
  encodeWav,
  planChunks,
  promptTail,
  searchSegments,
  segmentAt,
  toSrt,
  toText,
  toVtt,
  type Segment,
  type TranscriptData,
} from "@/lib/transcript";

/**
 * Transcripts under the video player. A CONTEXT, like voice notes and the
 * Team only switch, because the same VideoReview is mounted by the in-app
 * review window, the master cut page and the client portal: the app layout
 * provides reading, transcribing and editing; the portal provides reading
 * only. With no provider the panel is not drawn at all.
 */
export type TranscriptApi = {
  load: (versionId: string) => Promise<{ transcript: TranscriptData | null; canGenerate: boolean }>;
  transcribe?: (
    versionId: string,
    form: FormData
  ) => Promise<{ segments: Segment[]; language: string | null } | { error: string }>;
  save?: (
    versionId: string,
    input: { segments: Segment[]; language: string | null; duration: number | null }
  ) => Promise<{ ok: true } | { error: string }>;
};

const TranscriptContext = createContext<TranscriptApi | null>(null);

/** Supplies an implementation directly; the two below are the real ones. */
export function TranscriptApiProvider({ api, children }: { api: TranscriptApi; children: ReactNode }) {
  return <TranscriptContext.Provider value={api}>{children}</TranscriptContext.Provider>;
}

export function AppTranscriptProvider({ children }: { children: ReactNode }) {
  return (
    <TranscriptContext.Provider
      value={{
        load: (id) => getTranscript(id),
        transcribe: (id, form) => transcribePiece(id, form),
        save: (id, input) => saveTranscript(id, input),
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
}

export function PortalTranscriptProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return (
    <TranscriptContext.Provider
      value={{
        load: async (id) => ({
          transcript: await getClientTranscript(token, id),
          canGenerate: false,
        }),
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
}

type Run =
  | { phase: "download" }
  | { phase: "decode" }
  | { phase: "pieces"; done: number; total: number }
  | { phase: "save" };

/** Pull the soundtrack out of the file at 16kHz mono, in the browser. */
async function readSoundtrack(url: string, onPhase: (r: Run) => void) {
  onPhase({ phase: "download" });
  const res = await fetch(url);
  if (!res.ok) throw new Error("The file could not be downloaded for transcription.");
  const size = Number(res.headers.get("content-length") || 0);
  if (size > MAX_TRANSCRIBE_BYTES) {
    throw new Error("This file is too large to transcribe in the browser (over 1.5GB).");
  }
  const bytes = await res.arrayBuffer();
  onPhase({ phase: "decode" });
  const Ctx =
    (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) throw new Error("This browser cannot read audio. Try Chrome, Edge or Safari.");
  const ctx = new Ctx(1, 1, TRANSCRIBE_RATE);
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(bytes);
  } catch {
    throw new Error(
      "The browser could not read the sound in this file. An MP4 or MOV with AAC audio works best."
    );
  }
  if (buffer.duration > MAX_TRANSCRIBE_SECONDS) {
    throw new Error("Transcripts are limited to 45 minutes. This file is longer.");
  }
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buffer.numberOfChannels;
  }
  return { samples: mono, rate: buffer.sampleRate, duration: buffer.duration };
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(s: string) {
  return s.replace(/[^\w .-]+/g, "").trim().replace(/\s+/g, "_") || "transcript";
}

export function TranscriptPanel({
  versionId,
  mediaUrl,
  currentTime,
  exportName,
  roomy,
  onSeek,
  onComment,
}: {
  versionId: string;
  mediaUrl: string;
  currentTime: number;
  exportName?: string;
  roomy?: boolean;
  onSeek: (t: number) => void;
  /** Start a comment on a line; absent when commenting is not open. */
  onComment?: (s: Segment) => void;
}) {
  const api = useContext(TranscriptContext);
  const [data, setData] = useState<TranscriptData | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [menu, setMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;
    let live = true;
    setLoaded(false);
    setData(null);
    setError(null);
    api
      .load(versionId)
      .then((r) => {
        if (!live) return;
        setData(r?.transcript ?? null);
        setCanGenerate(Boolean(r?.canGenerate && api.transcribe));
      })
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [api, versionId]);

  const segments = useMemo(() => data?.segments ?? [], [data]);
  const active = segmentAt(segments, currentTime);
  const hits = useMemo(() => new Set(searchSegments(segments, query)), [segments, query]);
  const shown = query.trim() ? segments.map((s, i) => i).filter((i) => hits.has(i)) : segments.map((_, i) => i);

  // Keep the line being spoken in view, scrolling the panel only, never the page.
  useEffect(() => {
    if (query.trim() || editing != null || active < 0) return;
    const box = listRef.current;
    const row = box?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }, [active, query, editing]);

  if (!api || !loaded) return null;
  if (!data && !canGenerate) return null;

  async function generate() {
    if (!api?.transcribe || !api.save) return;
    setError(null);
    try {
      const { samples, rate, duration } = await readSoundtrack(mediaUrl, setRun);
      const plan = planChunks(samples, rate);
      const all: Segment[] = [];
      let language: string | null = null;
      for (let i = 0; i < plan.length; i++) {
        setRun({ phase: "pieces", done: i, total: plan.length });
        const [from, to] = plan[i];
        if (chunkIsSilent(samples, rate, from, to)) continue;
        const form = new FormData();
        const wav = encodeWav(samples.subarray(from, to), rate);
        form.append("file", new Blob([wav as BlobPart], { type: "audio/wav" }), "piece.wav");
        form.append("offset", String(from / rate));
        form.append("prompt", promptTail(all));
        const res = await api.transcribe(versionId, form);
        if (!res || "error" in res) {
          throw new Error(res && "error" in res ? res.error : "The transcription did not finish.");
        }
        all.push(...res.segments);
        language = language ?? res.language;
      }
      setRun({ phase: "save" });
      const saved = await api.save(versionId, { segments: all, language, duration });
      if (!saved || "error" in saved) {
        throw new Error(saved && "error" in saved ? saved.error : "The transcript could not be saved.");
      }
      setData({ segments: all, language, duration, updatedAt: new Date().toISOString() });
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The transcription did not finish.");
    } finally {
      setRun(null);
    }
  }

  async function saveEdit(i: number) {
    if (!api?.save || !data) return;
    const text = editText.replace(/\s+/g, " ").trim();
    setEditing(null);
    if (!text || text === data.segments[i].text) return;
    const next = data.segments.map((s, j) => (j === i ? { ...s, text } : s));
    const prev = data;
    setData({ ...data, segments: next });
    const res = await api.save(versionId, { segments: next, language: data.language, duration: data.duration });
    if (!res || "error" in res) {
      setData(prev);
      setError(res && "error" in res ? res.error : "The change was not saved.");
    }
  }

  const runLabel =
    run?.phase === "download"
      ? "Downloading the file..."
      : run?.phase === "decode"
        ? "Reading the audio..."
        : run?.phase === "pieces"
          ? `Transcribing ${Math.min(run.done + 1, run.total)} of ${run.total}...`
          : run?.phase === "save"
            ? "Saving..."
            : null;

  const base = safeName(exportName ?? "transcript");

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-text"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={`transition ${open ? "rotate-90" : ""}`}>
            <path d="m9 6 6 6-6 6" />
          </svg>
          Transcript
        </button>
        {data && (
          <span className="text-xs font-semibold text-text-faint">
            {segments.length ? `${segments.length} lines` : "No speech found"}
          </span>
        )}
        <span className="flex-1" />
        {data && segments.length > 0 && open && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search what was said"
            aria-label="Search the transcript"
            className="h-7 w-44 rounded-[8px] border border-border bg-surface-2 px-2 text-xs text-text outline-none focus:border-accent"
          />
        )}
        {data && segments.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="inline-flex h-7 items-center rounded-[8px] px-2 text-xs font-bold text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              Export
            </button>
            {menu && (
              <div className="absolute right-0 top-8 z-20 w-56 rounded-[10px] border border-border bg-surface p-1 shadow-lg">
                {[
                  { label: "Captions (.srt)", hint: "Premiere, Resolve, YouTube", go: () => download(`${base}.srt`, toSrt(segments), "application/x-subrip") },
                  { label: "Web captions (.vtt)", hint: "Vimeo, web players", go: () => download(`${base}.vtt`, toVtt(segments), "text/vtt") },
                  { label: "Text with timecodes (.txt)", hint: "For an email or a doc", go: () => download(`${base}.txt`, toText(segments), "text/plain") },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => {
                      o.go();
                      setMenu(false);
                    }}
                    className="block w-full rounded-[7px] px-2.5 py-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="block text-xs font-semibold text-text">{o.label}</span>
                    <span className="block text-[11px] text-text-faint">{o.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canGenerate && data && !run && (
          <button
            onClick={generate}
            title="Transcribe this version again"
            className="inline-flex h-7 items-center rounded-[8px] px-2 text-xs font-bold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            Redo
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 py-2.5">
          {error && (
            <p role="alert" className="mb-2 flex items-start gap-2 text-xs font-medium text-text">
              <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--h-red)" }} />
              {error}
            </p>
          )}
          {run ? (
            <p className="flex items-center gap-2 py-3 text-sm text-text">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              {runLabel}
              <span className="text-xs text-text-faint">Keep this window open.</span>
            </p>
          ) : !data ? (
            <div className="flex flex-wrap items-center gap-3 py-2">
              <p className="min-w-[220px] flex-1 text-sm text-text-muted">
                Turn the speech in this version into text: search what was said,
                click a line to jump to it, comment on a line, and export captions.
              </p>
              <button
                onClick={generate}
                className="rounded-[10px] bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
              >
                Transcribe
              </button>
            </div>
          ) : segments.length === 0 ? (
            <p className="py-2 text-sm text-text-muted">
              No speech was found in this version.
            </p>
          ) : (
            <div
              ref={listRef}
              className={`relative overflow-y-auto ${roomy ? "max-h-[260px]" : "max-h-[200px]"}`}
            >
              {shown.length === 0 && (
                <p className="py-2 text-sm text-text-muted">Nothing matches that.</p>
              )}
              {shown.map((i) => {
                const s = segments[i];
                const isActive = i === active && !query.trim();
                return (
                  <div
                    key={i}
                    data-line={i}
                    className={`group flex items-start gap-2 rounded-[8px] px-1.5 py-1 ${
                      isActive ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <button
                      onClick={() => onSeek(s.start)}
                      className="w-12 shrink-0 pt-0.5 text-left text-[11px] font-semibold tabular-nums text-text-faint hover:text-accent"
                    >
                      {clock(s.start)}
                    </button>
                    {editing === i ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => saveEdit(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditing(null);
                          }
                        }}
                        className="h-7 flex-1 rounded-[7px] border border-accent bg-surface px-2 text-sm text-text outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onSeek(s.start)}
                        className={`flex-1 text-left text-sm leading-snug ${isActive ? "font-semibold text-text" : "text-text"}`}
                      >
                        {s.text}
                      </button>
                    )}
                    {editing !== i && (
                      <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        {onComment && (
                          <button
                            onClick={() => onComment(s)}
                            className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold text-text-muted hover:bg-surface hover:text-text"
                          >
                            Comment
                          </button>
                        )}
                        {canGenerate && (
                          <button
                            onClick={() => {
                              setEditing(i);
                              setEditText(s.text);
                            }}
                            className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold text-text-muted hover:bg-surface hover:text-text"
                          >
                            Edit
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
