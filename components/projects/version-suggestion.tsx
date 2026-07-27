"use client";

// The inline nudge shown when a name looks like a new version of an existing
// file. It suggests, never blocks: "keep separate" is always one click, and a
// genuinely different deliverable that happens to be named v2 is unaffected.
export function VersionSuggestion({
  parentName,
  nextVersion,
  accepted,
  onAccept,
  onUndo,
}: {
  parentName: string;
  nextVersion: number;
  accepted: boolean;
  onAccept: () => void;
  onUndo: () => void;
}) {
  if (accepted) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[11px] border border-accent bg-accent-soft px-3 py-2">
        <p className="text-xs font-semibold text-accent">
          Adding as version {nextVersion} of &quot;{parentName}&quot;
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 text-xs font-semibold text-accent underline underline-offset-2"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[11px] border border-border-strong bg-surface-2/60 px-3 py-2.5">
      <p className="text-xs font-semibold text-text">
        Looks like a new version of &quot;{parentName}&quot;
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Adding it as a version keeps the history, the comments, and the
        client&apos;s review link in one place.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-[9px] bg-accent px-2.5 py-1 text-xs font-bold text-accent-fg transition hover:bg-accent-strong"
        >
          Add as version {nextVersion}
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="text-xs font-semibold text-text-faint transition hover:text-text"
        >
          Keep as a separate file
        </button>
      </div>
    </div>
  );
}
