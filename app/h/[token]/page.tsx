import type { Metadata } from "next";
import { loadHandoffByToken, recordHandoffView } from "@/lib/editor-handoff";
import { serviceConfigured } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Shots for the edit",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function secs(n: number | null) {
  if (n === null || !Number.isFinite(n)) return null;
  return `${n.toFixed(1)}s`;
}

/**
 * The editor's page. Built for TAKING, not judging.
 *
 * The review portal shows the same shots and is the wrong tool here: it has no
 * downloads, and its job is to collect a decision. This page collects nothing.
 * Every row is a file with a number on it, because the first thing any editor
 * does is drop a folder into a bin and expect it to sort into the cut order.
 */
export default async function EditorHandoffPage({
  params,
}: {
  params: { token: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          Not available
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          This link cannot be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const data = await loadHandoffByToken(params.token);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          This link is not available
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          It may have been turned off. Ask the studio for a new one.
        </p>
      </Centered>
    );
  }

  await recordHandoffView(params.token);

  const updated = data.updatedAt
    ? new Date(data.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-7">
          <p className="text-xs font-bold uppercase tracking-wide text-text-faint">
            {data.studioName} &middot; {data.projectTitle}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-text">
            {data.label || "Shots for the edit"}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            {data.readyCount} of {data.shots.length} shots ready, in cut order.
            Files download numbered, so they sort correctly in a bin.
          </p>
          {/* Stated out loud because this page is LIVE. An editor who pulled
              files yesterday has no other way to know something moved. */}
          {updated && (
            <p className="mt-2 inline-block rounded-[9px] bg-surface-2 px-2.5 py-1 text-[12px] text-text-muted">
              This page always shows the current picks. Last change {updated}.
            </p>
          )}
        </header>

        <ol className="grid gap-3">
          {data.shots.map((shot) => (
            <li
              key={shot.shotId}
              className="grid gap-3 rounded-[13px] border border-border bg-surface p-3 sm:grid-cols-[180px_1fr]"
            >
              <div className="overflow-hidden rounded-[9px] bg-surface-2">
                {shot.isVideo && shot.previewUrl ? (
                  <video
                    src={shot.previewUrl}
                    poster={shot.posterUrl ?? undefined}
                    controls
                    preload="metadata"
                    className="aspect-video w-full object-contain"
                  />
                ) : shot.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shot.posterUrl}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-video w-full place-items-center text-[11.5px] text-text-faint">
                    Not picked yet
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  Shot {shot.position}
                </span>
                <h2 className="font-display text-[15px] font-bold text-text">
                  {shot.title}
                </h2>
                {shot.beat && (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-text-muted">
                    {shot.beat}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-faint">
                  {secs(shot.durationSec) && <span>{secs(shot.durationSec)}</span>}
                  {shot.resolution && <span>{shot.resolution}</span>}
                  {shot.model && <span>{shot.model}</span>}
                </div>

                <div className="mt-auto pt-3">
                  {shot.generationId ? (
                    <a
                      href={`/h/${params.token}/file?g=${shot.generationId}`}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 font-display text-[13px] font-bold text-accent-fg transition hover:opacity-90"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
                      </svg>
                      {shot.filename}
                    </a>
                  ) : (
                    <span className="text-[12px] text-text-faint">
                      No take picked yet. Check back, or ask the studio.
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-[12px] text-text-faint">
          Sent from Studio Flows
        </p>
      </div>
    </div>
  );
}
