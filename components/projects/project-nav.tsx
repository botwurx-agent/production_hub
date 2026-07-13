"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTile } from "@/components/ui/icon-tile";

// StudioBinder-style project top nav: the phase bands (Plan / Visualize / Review /
// Produce) as tabs, each opening a dropdown of the module cards in that band, for
// quick jumping around a project from anywhere.

type Mod = { seg: string; label: string; sub: string; hue: string; icon: ReactNode; ai?: boolean };
type Band = { key: string; label: string; hue: string; icon: ReactNode; mods: Mod[] };

const I = (d: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const Ismall = (d: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const BANDS: Band[] = [
  {
    key: "plan",
    label: "Plan",
    hue: "blue",
    icon: I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>),
    mods: [
      { seg: "brief", label: "Brief", sub: "The creative direction", hue: "blue", icon: Ismall(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>) },
      { seg: "assets", label: "Assets", sub: "The project library", hue: "purple", icon: Ismall(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>) },
    ],
  },
  {
    key: "visualize",
    label: "Visualize",
    hue: "purple",
    icon: I(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" /></>),
    mods: [
      { seg: "pipeline", label: "AI Pipeline", sub: "Script → images → video", hue: "purple", ai: true, icon: Ismall(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /><circle cx="14.5" cy="14" r="2.5" /></>) },
      { seg: "storyboards", label: "Storyboards", sub: "Plan the edit, frame by frame", hue: "indigo", icon: Ismall(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" /></>) },
      { seg: "shot-list", label: "Shot list", sub: "Lay out every shot", hue: "purple", icon: Ismall(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>) },
      { seg: "moodboard", label: "Moodboard", sub: "Collect references & style", hue: "cyan", icon: Ismall(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>) },
    ],
  },
  {
    key: "review",
    label: "Review",
    hue: "pink",
    icon: I(<><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>),
    mods: [
      { seg: "review", label: "Review & approvals", sub: "Comment, pin, sign off", hue: "pink", icon: Ismall(<><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>) },
      { seg: "communication", label: "Communication", sub: "Email, chat & notes", hue: "blue", icon: Ismall(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />) },
    ],
  },
  {
    key: "produce",
    label: "Produce",
    hue: "green",
    icon: I(<><path d="M3 11l19-9-9 19-2-8-8-2z" /></>),
    mods: [
      { seg: "contacts", label: "Project contacts", sub: "Crew, talent, vendors", hue: "orange", icon: Ismall(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>) },
      { seg: "calendar", label: "Calendar", sub: "Shoot & delivery dates", hue: "blue", icon: Ismall(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>) },
      { seg: "callsheet", label: "Call sheet", sub: "Industry call sheet + PDF", hue: "green", icon: Ismall(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h8M8 18h5" /></>) },
      { seg: "gear", label: "Gear & crew", sub: "Equipment and roster", hue: "cyan", icon: Ismall(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>) },
      { seg: "budget", label: "Budget", sub: "Bid vs actual", hue: "indigo", icon: Ismall(<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />) },
      { seg: "delivery", label: "Delivery & billing", sub: "Final files and invoices", hue: "green", icon: Ismall(<><path d="M16.5 9.4 7.5 4.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>) },
    ],
  },
];

export function ProjectNav({
  projectId,
  projectType,
}: {
  projectId: string;
  projectType: string;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : "";
  const seg = rest.split("/")[0];
  const isAi = projectType === "ai_video";

  const [open, setOpen] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeBand = BANDS.find((b) => b.mods.some((m) => m.seg === seg))?.key ?? null;

  function toggle(key: string, el: HTMLElement) {
    if (open === key) {
      setOpen(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const width = 300;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
    setOpen(key);
  }

  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(null);
    }
    function onScroll() {
      setOpen(null);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mb-5 border-b border-border print:hidden">
      <div className="flex items-center gap-1 overflow-x-auto pb-px">
        <div className="relative shrink-0">
          <Link
            href={base}
            className={`flex items-center gap-1.5 rounded-t-[10px] px-3 py-2.5 text-sm font-semibold transition ${
              seg === "" ? "text-accent" : "text-text-muted hover:text-text"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
            </svg>
            Overview
          </Link>
          {seg === "" && (
            <span className="absolute bottom-[-1px] left-3 right-3 h-0.5 rounded-full bg-accent" />
          )}
        </div>

        {BANDS.map((b) => {
          const mods = b.mods.filter((m) => !m.ai || isAi);
          const isActive = activeBand === b.key;
          const isOpen = open === b.key;
          return (
            <div key={b.key} className="relative shrink-0">
              <button
                onClick={(e) => toggle(b.key, e.currentTarget)}
                className={`flex items-center gap-1.5 rounded-t-[10px] px-3 py-2.5 text-sm font-semibold transition ${
                  isActive || isOpen ? "text-text" : "text-text-muted hover:text-text"
                }`}
                style={isActive || isOpen ? { color: `var(--h-${b.hue})` } : undefined}
              >
                {b.icon}
                {b.label}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {(isActive || isOpen) && (
                <span
                  className="absolute bottom-[-1px] left-3 right-3 h-0.5 rounded-full"
                  style={{ backgroundColor: `var(--h-${b.hue})` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        (() => {
          const b = BANDS.find((x) => x.key === open);
          if (!b) return null;
          const mods = b.mods.filter((m) => !m.ai || isAi);
          return createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: 300, zIndex: 60 }}
              className="rounded-[16px] border border-border bg-surface p-2 shadow-xl"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span style={{ color: `var(--h-${b.hue})` }}>{b.icon}</span>
                <span className="text-sm font-bold text-text">{b.label}</span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {mods.map((m) => {
                  const active = seg === m.seg;
                  return (
                    <Link
                      key={m.seg}
                      href={`${base}/${m.seg}`}
                      onClick={() => setOpen(null)}
                      className={`flex items-center gap-3 rounded-[11px] p-2 transition ${
                        active ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <IconTile hue={m.hue} size="sm">
                        {m.icon}
                      </IconTile>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-text">{m.label}</div>
                        <div className="truncate text-xs text-text-muted">{m.sub}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>,
            document.body
          );
        })()}
    </div>
  );
}
