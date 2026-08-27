"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ChatGlyph,
  GmailGlyph,
  SlackGlyph,
} from "@/components/communication/comms-ui";

/**
 * The platform filter across the top of the Communication page: All, Email,
 * Slack, Google Chat, each chip wearing its service's own mark and the count
 * of linked conversations. Selecting a chip narrows the page to that service;
 * selecting it again returns to All, so there is no dead end.
 *
 * The filtered-out sections are HIDDEN, not unmounted, so an email thread you
 * had open stays open when you glance at Slack and come back.
 *
 * The choice persists in localStorage: a per-person view preference about one
 * page, the same call as the task board's grouping, not studio state worth a
 * migration. It hydrates after mount, so the server render (always "all")
 * never mismatches.
 */

export type FilterKey = "all" | "gmail" | "slack" | "gchat";
const STORE_KEY = "comms.filter";

function isFilterKey(v: string | null): v is FilterKey {
  return v === "all" || v === "gmail" || v === "slack" || v === "gchat";
}

/**
 * The filter state, shared by the project page and the studio-wide page. One
 * localStorage key on purpose: "show me Slack" is a preference about how this
 * person reads communication, not about which page they said it on.
 */
export function useCommsFilter() {
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (isFilterKey(stored)) setFilter(stored);
    } catch {
      // Blocked storage just means the filter starts on All.
    }
  }, []);

  function pick(key: FilterKey) {
    const next = filter === key ? "all" : key;
    setFilter(next);
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch {
      // Best effort; the click still filters this visit.
    }
  }

  return { filter, pick };
}

/** The chip row alone: service marks, labels, counts, one active at a time. */
export function CommsChips({
  filter,
  onPick,
  emailCount,
  slackCount,
  chatCount,
}: {
  filter: FilterKey;
  onPick: (key: FilterKey) => void;
  emailCount: number;
  slackCount: number;
  chatCount: number;
}) {
  const chips: {
    key: FilterKey;
    label: string;
    glyph: ReactNode | null;
    count: number | null;
  }[] = [
    { key: "all", label: "All", glyph: null, count: null },
    { key: "gmail", label: "Email", glyph: <GmailGlyph size={13} />, count: emailCount },
    { key: "slack", label: "Slack", glyph: <SlackGlyph size={13} />, count: slackCount },
    { key: "gchat", label: "Google Chat", glyph: <ChatGlyph size={13} />, count: chatCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by platform"
      className="mb-5 flex flex-wrap items-center gap-2"
    >
      {chips.map((c) => {
        const active = filter === c.key;
        return (
          <button
            key={c.key}
            role="tab"
            aria-selected={active}
            onClick={() => onPick(c.key)}
            className={`inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? "border-accent bg-accent-soft text-accent shadow-sm"
                : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
            }`}
          >
            {c.glyph}
            {c.label}
            {c.count !== null && (
              <span
                className={`rounded-pill px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                  active ? "bg-surface text-accent" : "bg-surface-2 text-text-faint"
                }`}
              >
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CommsFilter({
  email,
  slack,
  chat,
  emailCount,
  slackCount,
  chatCount,
}: {
  email: ReactNode;
  slack: ReactNode;
  chat: ReactNode;
  emailCount: number;
  slackCount: number;
  chatCount: number;
}) {
  const { filter, pick } = useCommsFilter();

  return (
    <div>
      <CommsChips
        filter={filter}
        onPick={pick}
        emailCount={emailCount}
        slackCount={slackCount}
        chatCount={chatCount}
      />

      <div className="grid grid-cols-1 gap-6">
        <div className={filter === "all" || filter === "gmail" ? "" : "hidden"}>
          {email}
        </div>
        <div className={filter === "all" || filter === "slack" ? "" : "hidden"}>
          {slack}
        </div>
        <div className={filter === "all" || filter === "gchat" ? "" : "hidden"}>
          {chat}
        </div>
      </div>
    </div>
  );
}
