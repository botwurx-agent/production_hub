"use client";

import { useEffect, useState } from "react";
import { FitStage, useInView, useSceneClock } from "./scene-kit";
import { BUDGET_MS, BudgetScene, CALL_MS, CallSheetScene, REVIEW_MS, ReviewScene } from "./scenes-hero";
import {
  RV_DRAW_MS,
  RV_PINS_MS,
  RV_SHARE_MS,
  RV_VERS_MS,
  RV_VIDEO_MS,
  ReviewDrawScene,
  ReviewPinsScene,
  ReviewShareScene,
  ReviewVersionsScene,
  ReviewVideoScene,
} from "./scenes-review";
import {
  CS_BUILD_MS,
  CS_CHASE_MS,
  CS_DUP_MS,
  CS_MEALS_MS,
  CS_SEND_MS,
  CallSheetBuildScene,
  CallSheetChaseScene,
  CallSheetDuplicateScene,
  CallSheetMealsScene,
  CallSheetSendScene,
} from "./scenes-callsheet";
import {
  BG_LEDGER_MS,
  BG_LINES_MS,
  BG_MARGIN_MS,
  BG_READ_MS,
  BG_SCHED_MS,
  BudgetLedgerScene,
  BudgetLinesScene,
  BudgetMarginScene,
  BudgetReadScene,
  BudgetScheduleScene,
} from "./scenes-budget";
import {
  MB_BUILD_MS,
  MB_EDIT_MS,
  MB_IMPORT_MS,
  MB_ORG_MS,
  MB_REVIEW_MS,
  MoodboardBuildScene,
  MoodboardEditScene,
  MoodboardImportScene,
  MoodboardOrganizeScene,
  MoodboardReviewScene,
} from "./scenes-moodboard";
import { MOOD_MS, MoodboardScene, PIPELINE_MS, PipelineScene } from "./scenes-more";
import { BOARD_MS, COMMS_MS, CommsScene, SCHEDULE_MS, ScheduleScene, StoryboardScene } from "./scenes-panels";

/**
 * Scenes by NAME, because the pages that place them are server components and
 * cannot hand a render function across that boundary.
 */
const SCENES = {
  review: { ms: REVIEW_MS, C: ReviewScene, label: "Client review", hue: "pink" },
  callsheet: { ms: CALL_MS, C: CallSheetScene, label: "Call sheets", hue: "amber" },
  budget: { ms: BUDGET_MS, C: BudgetScene, label: "Budget", hue: "indigo" },
  storyboard: { ms: BOARD_MS, C: StoryboardScene, label: "Storyboards", hue: "purple" },
  schedule: { ms: SCHEDULE_MS, C: ScheduleScene, label: "Schedule", hue: "green" },
  comms: { ms: COMMS_MS, C: CommsScene, label: "Communication", hue: "cyan" },
  moodboard: { ms: MOOD_MS, C: MoodboardScene, label: "Moodboards", hue: "orange" },
  pipeline: { ms: PIPELINE_MS, C: PipelineScene, label: "AI pipeline", hue: "purple" },
  "mb-build": { ms: MB_BUILD_MS, C: MoodboardBuildScene, label: "Build the board", hue: "pink" },
  "mb-import": { ms: MB_IMPORT_MS, C: MoodboardImportScene, label: "Bring references in", hue: "pink" },
  "mb-organize": { ms: MB_ORG_MS, C: MoodboardOrganizeScene, label: "Organize", hue: "pink" },
  "mb-edit": { ms: MB_EDIT_MS, C: MoodboardEditScene, label: "Edit in place", hue: "pink" },
  "mb-review": { ms: MB_REVIEW_MS, C: MoodboardReviewScene, label: "Client review", hue: "pink" },
  "bg-lines": { ms: BG_LINES_MS, C: BudgetLinesScene, label: "Bid against actual", hue: "blue" },
  "bg-ledger": { ms: BG_LEDGER_MS, C: BudgetLedgerScene, label: "Log a cost", hue: "blue" },
  "bg-read": { ms: BG_READ_MS, C: BudgetReadScene, label: "Read the invoice", hue: "blue" },
  "bg-schedule": { ms: BG_SCHED_MS, C: BudgetScheduleScene, label: "Deposits", hue: "blue" },
  "bg-margin": { ms: BG_MARGIN_MS, C: BudgetMarginScene, label: "Margin", hue: "blue" },
  "cs-build": { ms: CS_BUILD_MS, C: CallSheetBuildScene, label: "Build the sheet", hue: "amber" },
  "cs-dup": { ms: CS_DUP_MS, C: CallSheetDuplicateScene, label: "Every day", hue: "amber" },
  "cs-send": { ms: CS_SEND_MS, C: CallSheetSendScene, label: "Send", hue: "amber" },
  "cs-chase": { ms: CS_CHASE_MS, C: CallSheetChaseScene, label: "Chase", hue: "amber" },
  "cs-meals": { ms: CS_MEALS_MS, C: CallSheetMealsScene, label: "Meals", hue: "amber" },
  "rv-share": { ms: RV_SHARE_MS, C: ReviewShareScene, label: "Share", hue: "green" },
  "rv-pins": { ms: RV_PINS_MS, C: ReviewPinsScene, label: "Pins", hue: "green" },
  "rv-video": { ms: RV_VIDEO_MS, C: ReviewVideoScene, label: "Video", hue: "green" },
  "rv-draw": { ms: RV_DRAW_MS, C: ReviewDrawScene, label: "Draw", hue: "green" },
  "rv-versions": { ms: RV_VERS_MS, C: ReviewVersionsScene, label: "Versions", hue: "green" },
} as const;

export type SceneName = keyof typeof SCENES;

/**
 * One scene, playing while on screen and looping. For the feature panels.
 * From `lg` the stage is absolutely positioned inside its box so it can fit
 * the panel's height as well as its width; below that it fits the width.
 */
export function LiveScene({
  name,
  className = "",
  box = false,
}: {
  name: SceneName;
  className?: string;
  /** The container has its own height (a pinned panel): fit both dimensions. */
  box?: boolean;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const { ms, C } = SCENES[name];
  const t = useSceneClock({ duration: ms, playing: inView, loop: true });
  return (
    <div ref={ref} className={`relative ${className}`}>
      <FitStage className={box ? "lg:absolute lg:inset-0" : ""}>
        <C t={t} />
      </FitStage>
    </div>
  );
}

/**
 * The home hero: several main features, one after another, with tabs that say
 * which one you are watching and fill as it plays. The operator's note on the
 * first version was that a single board read as ONE feature (the schedule), so
 * the tabs name the feature out loud and each scene is a different end of the
 * job. A click jumps to that scene and the cycle carries on from there.
 */
export function HeroShowcase({ scenes = ["review", "moodboard", "callsheet", "budget"] }: { scenes?: SceneName[] }) {
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const cur = SCENES[scenes[i]];
  const t = useSceneClock({
    duration: cur.ms,
    playing: inView,
    resetKey: run,
    onEnd: () => {
      setI((x) => (x + 1) % scenes.length);
      setRun((r) => r + 1);
    },
  });

  // The clip recorder restarts from the first scene once the page has painted.
  useEffect(() => {
    const restart = () => {
      setI(0);
      setRun((r) => r + 1);
    };
    window.addEventListener("hero-motion:restart", restart);
    return () => window.removeEventListener("hero-motion:restart", restart);
  }, []);

  const C = cur.C;
  return (
    <div ref={ref} className="mx-auto w-full max-w-[700px]">
      <div className="mb-4 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Features">
        {scenes.map((name, k) => {
          const s = SCENES[name];
          const on = k === i;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setI(k);
                setRun((r) => r + 1);
              }}
              className="relative overflow-hidden rounded-full border px-4 py-2 text-[13px] font-bold transition"
              style={{
                borderColor: on ? `var(--h-${s.hue})` : "var(--border)",
                background: on ? `var(--h-${s.hue}-bg)` : "var(--surface)",
                color: on ? "var(--text)" : "var(--text-muted)",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: `var(--h-${s.hue})` }} />
                {s.label}
              </span>
              {on ? (
                <span
                  className="absolute bottom-0 left-0 h-[3px]"
                  style={{ width: `${(t / cur.ms) * 100}%`, background: `var(--h-${s.hue})` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div key={run} className="hs-in" role="img" aria-label={`Illustration: ${cur.label} in Studio Flows.`}>
        <FitStage max={1.1}>
          <C t={t} />
        </FitStage>
      </div>
      <style>{`
        .hs-in { animation: hs-in .45s cubic-bezier(.34,1.56,.64,1) both }
        @keyframes hs-in { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .hs-in { animation: none } }
      `}</style>
    </div>
  );
}
