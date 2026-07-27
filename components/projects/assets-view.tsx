"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssetCard } from "@/components/projects/asset-card";
import type { AssetWithVersions } from "@/components/projects/asset-types";
import { ASSET_STATUS, ASSET_STATUS_ORDER, ASSET_TYPE_LABEL } from "@/lib/status";

// Frame.io-style toolbar over the library: filter by status or type, sort by a
// field with a direction toggle. Client-side over the already-loaded set, so
// switching is instant and no refetch is involved.

type SortKey = "name" | "added" | "updated" | "type" | "versions";

const SORTS: { key: SortKey; label: string; asc: string; desc: string }[] = [
  { key: "name", label: "Name", asc: "A to Z", desc: "Z to A" },
  { key: "added", label: "Date added", asc: "Oldest first", desc: "Newest first" },
  { key: "updated", label: "Last updated", asc: "Oldest first", desc: "Newest first" },
  { key: "type", label: "Type", asc: "A to Z", desc: "Z to A" },
  { key: "versions", label: "Versions", asc: "Fewest first", desc: "Most first" },
];

const TYPE_KEYS = ["image", "video", "storyboard", "reference", "cut", "other"];

function lastTouched(a: AssetWithVersions): number {
  const newest = a.versions.reduce((max, v) => {
    const t = Date.parse(v.created_at);
    return Number.isNaN(t) ? max : Math.max(max, t);
  }, 0);
  return newest || Date.parse(a.created_at) || 0;
}

function Chip({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition ${
          open ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <span className="text-text-faint">{label}</span>
        <span className="text-text">{value}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-56 overflow-hidden rounded-[13px] border border-border bg-surface p-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-sm transition hover:bg-surface-2 ${
        active ? "font-bold text-text" : "font-medium text-text-muted"
      }`}
    >
      {children}
      {active && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

export function AssetsView({
  assets,
  projectId,
  studioId,
  currentUserId,
  reviewLinkByAsset,
  emailEnabled,
}: {
  assets: AssetWithVersions[];
  projectId: string;
  studioId: string;
  currentUserId: string;
  reviewLinkByAsset: Record<
    string,
    { id: string; token: string; recipient: string | null }
  >;
  emailEnabled: boolean;
}) {
  // "all" | status:<s> | type:<t>
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [desc, setDesc] = useState(true);
  const [ready, setReady] = useState(false);

  // Remember the choice per project, the way Frame.io does.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`assets.view.${projectId}`);
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v.filter === "string") setFilter(v.filter);
        if (typeof v.sort === "string") setSort(v.sort);
        if (typeof v.desc === "boolean") setDesc(v.desc);
      }
    } catch {
      // ignore unreadable preferences
    }
    setReady(true);
  }, [projectId]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        `assets.view.${projectId}`,
        JSON.stringify({ filter, sort, desc })
      );
    } catch {
      // ignore quota / private mode
    }
  }, [ready, projectId, filter, sort, desc]);

  const shown = useMemo(() => {
    const [kind, value] = filter.split(":");
    const list = assets.filter((a) => {
      if (kind === "status") return a.status === value;
      if (kind === "type") return a.type === value;
      return true;
    });
    const dir = desc ? -1 : 1;
    return [...list].sort((a, b) => {
      let n = 0;
      if (sort === "name") n = a.name.localeCompare(b.name);
      else if (sort === "type") n = a.type.localeCompare(b.type);
      else if (sort === "versions") n = a.versions.length - b.versions.length;
      else if (sort === "updated") n = lastTouched(a) - lastTouched(b);
      else n = Date.parse(a.created_at) - Date.parse(b.created_at);
      // Name is the stable tie-break so equal keys never shuffle.
      if (n === 0 && sort !== "name") n = a.name.localeCompare(b.name);
      return n * dir;
    });
  }, [assets, filter, sort, desc]);

  const activeSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];
  const filterLabel =
    filter === "all"
      ? "All files"
      : filter.startsWith("status:")
        ? ASSET_STATUS[filter.slice(7) as keyof typeof ASSET_STATUS]?.label ??
          "All files"
        : (ASSET_TYPE_LABEL[filter.slice(5)] ?? "All files");

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const a of assets) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }
    return { byStatus, byType };
  }, [assets]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Chip label="Filtered by" value={filterLabel}>
          {(close) => (
            <>
              <MenuItem
                active={filter === "all"}
                onClick={() => {
                  setFilter("all");
                  close();
                }}
              >
                All files
              </MenuItem>
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-text-faint">
                Status
              </p>
              {ASSET_STATUS_ORDER.filter((s) => counts.byStatus[s]).map((s) => (
                <MenuItem
                  key={s}
                  active={filter === `status:${s}`}
                  onClick={() => {
                    setFilter(`status:${s}`);
                    close();
                  }}
                >
                  <span>
                    {ASSET_STATUS[s].label}{" "}
                    <span className="text-text-faint">
                      {counts.byStatus[s]}
                    </span>
                  </span>
                </MenuItem>
              ))}
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-text-faint">
                Type
              </p>
              {TYPE_KEYS.filter((t) => counts.byType[t]).map((t) => (
                <MenuItem
                  key={t}
                  active={filter === `type:${t}`}
                  onClick={() => {
                    setFilter(`type:${t}`);
                    close();
                  }}
                >
                  <span>
                    {ASSET_TYPE_LABEL[t]}{" "}
                    <span className="text-text-faint">{counts.byType[t]}</span>
                  </span>
                </MenuItem>
              ))}
            </>
          )}
        </Chip>

        <Chip label="Sorted by" value={activeSort.label}>
          {(close) => (
            <>
              {SORTS.map((s) => (
                <MenuItem
                  key={s.key}
                  active={sort === s.key}
                  onClick={() => {
                    setSort(s.key);
                    close();
                  }}
                >
                  {s.label}
                </MenuItem>
              ))}
            </>
          )}
        </Chip>

        <button
          onClick={() => setDesc((v) => !v)}
          title="Reverse the order"
          className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 3v18M7 21l-3-3M7 21l3-3M17 21V3M17 3l-3 3M17 3l3 3" />
          </svg>
          {desc ? activeSort.desc : activeSort.asc}
        </button>

        {filter !== "all" && (
          <button
            onClick={() => setFilter("all")}
            className="ml-auto text-xs font-semibold text-text-faint transition hover:text-text"
          >
            Clear filter ({shown.length} of {assets.length})
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-semibold text-text">
            No files match this filter
          </p>
          <button
            onClick={() => setFilter("all")}
            className="mt-1 text-xs font-semibold text-accent hover:underline"
          >
            Show all {assets.length}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shown.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              projectId={projectId}
              studioId={studioId}
              currentUserId={currentUserId}
              reviewLink={reviewLinkByAsset[a.id] ?? null}
              emailEnabled={emailEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
