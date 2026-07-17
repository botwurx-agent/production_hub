"use client";

import { useState } from "react";

export type CompareVersion = {
  id: string;
  version_number: number;
  created_at?: string;
};

// Side-by-side compare of two image versions. Each pane has its own version
// picker, so any two versions (before/after a revision) can sit next to each
// other. Context-agnostic: the parent supplies a urlFor(id) that returns a
// viewable image URL (the token-gated proxy in the portal, a signed URL in-app).
export function VersionCompare({
  versions,
  currentId,
  urlFor,
  alt = "",
}: {
  versions: CompareVersion[];
  currentId: string | null;
  urlFor: (id: string) => string;
  alt?: string;
}) {
  const sorted = [...versions].sort(
    (a, b) => b.version_number - a.version_number
  );
  const current = sorted.find((v) => v.id === currentId) ?? sorted[0] ?? null;
  const older = sorted.find((v) => v.id !== current?.id) ?? current;

  const [leftId, setLeftId] = useState<string | null>(older?.id ?? null);
  const [rightId, setRightId] = useState<string | null>(current?.id ?? null);

  if (sorted.length < 2) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ComparePane
        label="Compare"
        versions={sorted}
        selectedId={leftId}
        onSelect={setLeftId}
        urlFor={urlFor}
        alt={alt}
      />
      <ComparePane
        label="Against"
        versions={sorted}
        selectedId={rightId}
        onSelect={setRightId}
        urlFor={urlFor}
        alt={alt}
      />
    </div>
  );
}

function ComparePane({
  label,
  versions,
  selectedId,
  onSelect,
  urlFor,
  alt,
}: {
  label: string;
  versions: CompareVersion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  urlFor: (id: string) => string;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {label}
        </span>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold text-text outline-none focus:border-border-strong"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              Version {v.version_number}
            </option>
          ))}
        </select>
      </div>
      <div className="grid aspect-[4/3] place-items-center bg-surface-2">
        {selectedId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFor(selectedId)}
            alt={alt}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-text-faint">No version</span>
        )}
      </div>
    </div>
  );
}
