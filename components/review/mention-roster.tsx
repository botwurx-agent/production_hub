"use client";

import { createContext, useContext } from "react";
import type { MentionCandidate } from "@/lib/mentions";

/**
 * The project roster, available to any comment composer inside it.
 *
 * A CONTEXT RATHER THAN A PROP, for the reason the AI-availability flag is one:
 * seven different surfaces render the same pin composer (the client portal, the
 * in-app review modal, the doc review modal and view, the cut review, the AI
 * shot canvas), and threading a roster through every page that mounts one would
 * mean every future page remembering to pass it.
 *
 * EMPTY IS THE SAFE DEFAULT, and it is what the public client portal gets: with
 * no provider the composer simply shows no mention control, so a client
 * reviewing a cut can never be offered the studio's crew list.
 */
const Ctx = createContext<MentionCandidate[]>([]);

export function MentionRosterProvider({
  roster,
  children,
}: {
  roster: MentionCandidate[];
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={roster}>{children}</Ctx.Provider>;
}

export function useMentionRoster(): MentionCandidate[] {
  return useContext(Ctx);
}
