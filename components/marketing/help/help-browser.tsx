"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HelpCategory, HelpCategoryId } from "@/lib/help/articles";

export type HelpCard = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategoryId;
  minutes: number;
  steps: number;
  /** Lowercased text the search matches against. */
  text: string;
  /** A real screenshot to show on the card, when the article has one. */
  thumb?: string;
  video?: boolean;
  /** Step titles, drawn on cards that have no screenshot. */
  stepTitles: string[];
};

/**
 * The help index's interactive half: a search box and one chip per category.
 *
 * The chosen topic rides in the URL (`?topic=money`) so a filtered view can be
 * linked to, read once on mount rather than through useSearchParams, which
 * would force the whole marketing page to render dynamically for a filter.
 * Typing in the search ignores the topic: somebody searching "call sheet" from
 * the Money tab means the call sheet article, not nothing.
 */
export function HelpBrowser({
  categories,
  cards,
}: {
  categories: HelpCategory[];
  cards: HelpCard[];
}) {
  const [topic, setTopic] = useState<HelpCategoryId | "all">("all");
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("topic");
    if (t && categories.some((c) => c.id === t)) setTopic(t as HelpCategoryId);
    const q = p.get("q");
    if (q) setQuery(q);
  }, [categories]);

  function pick(t: HelpCategoryId | "all") {
    setTopic(t);
    const url = new URL(window.location.href);
    if (t === "all") url.searchParams.delete("topic");
    else url.searchParams.set("topic", t);
    window.history.replaceState(null, "", url);
  }

  // "/" focuses the search, the convention every docs site uses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (e.key === "/" && el?.tagName !== "INPUT" && el?.tagName !== "TEXTAREA") {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;

  const shown = useMemo(() => {
    if (searching) return cards.filter((c) => words.every((w) => c.text.includes(w)));
    if (topic === "all") return cards;
    return cards.filter((c) => c.category === topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, topic, query]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [cards]);

  const catOf = (id: HelpCategoryId) => categories.find((c) => c.id === id)!;
  const grouped = !searching && topic === "all";

  return (
    <div>
      {/* Search + chips stick under the nav so filtering is always one press away. */}
      <div className="sticky top-16 z-30 -mx-6 border-b border-border bg-bg px-6 py-4 sm:-mx-10 sm:px-10">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the help center, e.g. call sheet, invite, receipt"
            aria-label="Search the help center"
            className="w-full rounded-xl border border-border bg-surface py-3.5 pl-12 pr-14 text-[16px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 text-[12px] text-text-faint sm:block">
            /
          </kbd>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible" role="tablist" aria-label="Filter by topic">
          <Chip active={!searching && topic === "all"} onClick={() => { setQuery(""); pick("all"); }} label="All topics" count={cards.length} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={!searching && topic === c.id}
              onClick={() => { setQuery(""); pick(c.id); }}
              label={c.label}
              count={counts.get(c.id) ?? 0}
              hue={c.hue}
            />
          ))}
        </div>
      </div>

      <div className="pt-10">
        {searching && (
          <p className="mb-6 text-[15px] text-text-muted">
            {shown.length === 0
              ? `Nothing matches "${query.trim()}". Try a simpler word, or browse a topic.`
              : `${shown.length} ${shown.length === 1 ? "guide" : "guides"} for "${query.trim()}"`}
          </p>
        )}

        {grouped ? (
          <div className="space-y-16">
            {categories.map((c) => {
              const list = cards.filter((a) => a.category === c.id);
              if (!list.length) return null;
              return (
                <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--h-${c.hue})` }} aria-hidden />
                      <h2 id={`cat-${c.id}`} className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                        {c.label}
                      </h2>
                      <span className="text-[15px] text-text-muted">{c.blurb}</span>
                    </div>
                    <button type="button" onClick={() => pick(c.id)} className="text-[15px] font-semibold text-accent hover:underline">
                      Only {c.label.toLowerCase()}
                    </button>
                  </div>
                  <Grid cards={list} catOf={catOf} />
                </section>
              );
            })}
          </div>
        ) : (
          <>
            {!searching && topic !== "all" && (
              <div className="mb-6">
                <h2 className="font-display text-3xl font-bold tracking-tight text-text">{catOf(topic).label}</h2>
                <p className="mt-1 text-[16px] text-text-muted">{catOf(topic).blurb}</p>
              </div>
            )}
            <Grid cards={shown} catOf={catOf} />
          </>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  hue,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  hue?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition ${
        active
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      }`}
    >
      {hue && !active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${hue})` }} aria-hidden />}
      {label}
      <span className={active ? "opacity-80" : "text-text-faint"}>{count}</span>
    </button>
  );
}

function Grid({ cards, catOf }: { cards: HelpCard[]; catOf: (id: HelpCategoryId) => HelpCategory }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((a) => {
        const c = catOf(a.category);
        return (
          <li key={a.slug}>
            <Link
              href={`/help/${a.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_16px_40px_-24px_rgba(20,20,40,0.4)]"
            >
              {a.thumb ? (
                <div className="relative aspect-[16/8] overflow-hidden border-b border-border" style={{ background: `var(--h-${c.hue}-bg)` }}>
                  <Image
                    src={a.thumb}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 440px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-left-top transition duration-300 group-hover:scale-[1.02]"
                  />
                  {a.video && (
                    <span className="absolute left-3 top-3 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-text shadow">
                      ▶ Video
                    </span>
                  )}
                </div>
              ) : (
                // No screenshot: the card's picture is the guide itself, its
                // steps as a numbered list on the topic's tint, so every card in
                // a row has the same shape and the reader sees what they will do.
                <div
                  className="relative flex aspect-[16/8] flex-col justify-center gap-2 overflow-hidden border-b border-border px-6"
                  style={{ background: `linear-gradient(135deg, var(--h-${c.hue}-bg) 0%, var(--surface-2) 100%)` }}
                  aria-hidden
                >
                  {a.stepTitles.slice(0, 4).map((t, n) => (
                    <span key={t} className="flex items-center gap-3 text-[14px] font-semibold text-text">
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[12px] font-bold"
                        style={{ boxShadow: `inset 0 0 0 1.5px var(--h-${c.hue})` }}
                      >
                        {n + 1}
                      </span>
                      <span className="truncate">{t}</span>
                    </span>
                  ))}
                  {a.stepTitles.length > 4 && (
                    <span className="pl-9 text-[13px] text-text-muted">+ {a.stepTitles.length - 4} more</span>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-text-faint">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${c.hue})` }} aria-hidden />
                  {c.label}
                </span>
                <h3 className="mt-2 font-display text-[19px] font-bold leading-snug tracking-tight text-text group-hover:text-accent">
                  {a.title}
                </h3>
                <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-text-muted">{a.summary}</p>
                <p className="mt-4 text-[13px] text-text-faint">
                  {a.steps} steps · {a.minutes} min
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
