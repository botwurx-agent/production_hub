"use client";

import { useEffect, useState } from "react";
import { FitStage, useInView, useSceneClock } from "./scene-kit";
import { BUDGET_MS, BudgetScene, CALL_MS, CallSheetScene, REVIEW_MS, ReviewScene } from "./scenes-hero";
import { SC_BOARD_MS, SC_BUILD_MS, SC_DAY_MS, SC_SHARE_MS, ScheduleBoardScene, ScheduleBuildScene, ScheduleDayScene, ScheduleShareScene } from "./scenes-schedule";
import { CM_ATTACH_MS, CM_LINK_MS, CM_REPLY_MS, CM_SLACK_MS, CM_STUDIO_MS, CommsAttachScene, CommsLinkScene, CommsReplyScene, CommsSlackScene, CommsStudioScene } from "./scenes-comms";
import { GR_LIST_MS, GR_PICK_MS, GR_PROPS_MS, GearListScene, GearPickScene, GearPropsScene, TK_BOARD_MS, TK_CARD_MS, TK_LIST_MS, TK_PEOPLE_MS, TaskBoardScene, TaskCardScene, TaskListScene, TaskPeopleScene } from "./scenes-tasks";
import { IV_BUILD_MS, IV_FLOW_MS, IV_IMPORT_MS, IV_SEND_MS, IV_SIGN_MS, IV_STYLE_MS, InvoiceBuildScene, InvoiceFlowScene, InvoiceImportScene, InvoiceSendScene, InvoiceSignScene, InvoiceStyleScene } from "./scenes-invoicing";
import { CR_ACCESS_MS, CR_ADD_MS, CR_ROSTER_MS, CR_TALENT_MS, CR_USED_MS, CrewAccessScene, CrewAddScene, CrewRosterScene, CrewTalentScene, CrewUsedScene } from "./scenes-crew";
import {
  SL_FRAMES_MS,
  SL_IMPORT_MS,
  SL_ORG_MS,
  SL_ROWS_MS,
  SL_SHARE_MS,
  ShotFramesScene,
  ShotImportScene,
  ShotOrganizeScene,
  ShotRowsScene,
  ShotShareScene,
} from "./scenes-shotlist";
import {
  SB_ASPECT_MS,
  SB_EXPORT_MS,
  SB_GRID_MS,
  SB_IMPORT_MS,
  SB_REVIEW_MS,
  StoryboardAspectScene,
  StoryboardExportScene,
  StoryboardGridScene,
  StoryboardImportScene,
  StoryboardReviewScene,
} from "./scenes-storyboard";
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
  "sl-rows": { ms: SL_ROWS_MS, C: ShotRowsScene, label: "Rows", hue: "blue" },
  "sl-frames": { ms: SL_FRAMES_MS, C: ShotFramesScene, label: "Frames", hue: "blue" },
  "sl-import": { ms: SL_IMPORT_MS, C: ShotImportScene, label: "Import", hue: "blue" },
  "sl-organize": { ms: SL_ORG_MS, C: ShotOrganizeScene, label: "Organize", hue: "blue" },
  "sl-share": { ms: SL_SHARE_MS, C: ShotShareScene, label: "Share", hue: "blue" },
  "sb-grid": { ms: SB_GRID_MS, C: StoryboardGridScene, label: "Frames", hue: "purple" },
  "sb-aspect": { ms: SB_ASPECT_MS, C: StoryboardAspectScene, label: "Shape", hue: "purple" },
  "sb-import": { ms: SB_IMPORT_MS, C: StoryboardImportScene, label: "Import", hue: "purple" },
  "sb-review": { ms: SB_REVIEW_MS, C: StoryboardReviewScene, label: "Review", hue: "purple" },
  "sb-export": { ms: SB_EXPORT_MS, C: StoryboardExportScene, label: "Export", hue: "purple" },
  "sc-day": { ms: SC_DAY_MS, C: ScheduleDayScene, label: "A day", hue: "green" },
  "sc-board": { ms: SC_BOARD_MS, C: ScheduleBoardScene, label: "Board", hue: "green" },
  "sc-build": { ms: SC_BUILD_MS, C: ScheduleBuildScene, label: "Build", hue: "green" },
  "sc-share": { ms: SC_SHARE_MS, C: ScheduleShareScene, label: "Share", hue: "green" },
  "cm-link": { ms: CM_LINK_MS, C: CommsLinkScene, label: "Link", hue: "cyan" },
  "cm-reply": { ms: CM_REPLY_MS, C: CommsReplyScene, label: "Reply", hue: "cyan" },
  "cm-attach": { ms: CM_ATTACH_MS, C: CommsAttachScene, label: "Attachments", hue: "cyan" },
  "cm-slack": { ms: CM_SLACK_MS, C: CommsSlackScene, label: "Slack", hue: "cyan" },
  "cm-studio": { ms: CM_STUDIO_MS, C: CommsStudioScene, label: "Studio", hue: "cyan" },
  "cr-roster": { ms: CR_ROSTER_MS, C: CrewRosterScene, label: "Roster", hue: "orange" },
  "cr-add": { ms: CR_ADD_MS, C: CrewAddScene, label: "Add", hue: "orange" },
  "cr-talent": { ms: CR_TALENT_MS, C: CrewTalentScene, label: "Talent", hue: "orange" },
  "cr-access": { ms: CR_ACCESS_MS, C: CrewAccessScene, label: "Access", hue: "orange" },
  "cr-used": { ms: CR_USED_MS, C: CrewUsedScene, label: "Used", hue: "orange" },
  "tk-board": { ms: TK_BOARD_MS, C: TaskBoardScene, label: "Board", hue: "purple" },
  "tk-card": { ms: TK_CARD_MS, C: TaskCardScene, label: "Card", hue: "purple" },
  "tk-people": { ms: TK_PEOPLE_MS, C: TaskPeopleScene, label: "People", hue: "purple" },
  "tk-list": { ms: TK_LIST_MS, C: TaskListScene, label: "List", hue: "purple" },
  "gr-list": { ms: GR_LIST_MS, C: GearListScene, label: "Gear", hue: "blue" },
  "gr-props": { ms: GR_PROPS_MS, C: GearPropsScene, label: "Props", hue: "blue" },
  "gr-pick": { ms: GR_PICK_MS, C: GearPickScene, label: "Pick", hue: "blue" },
  "iv-flow": { ms: IV_FLOW_MS, C: InvoiceFlowScene, label: "Flow", hue: "green" },
  "iv-build": { ms: IV_BUILD_MS, C: InvoiceBuildScene, label: "Build", hue: "green" },
  "iv-style": { ms: IV_STYLE_MS, C: InvoiceStyleScene, label: "Style", hue: "green" },
  "iv-sign": { ms: IV_SIGN_MS, C: InvoiceSignScene, label: "Sign", hue: "green" },
  "iv-send": { ms: IV_SEND_MS, C: InvoiceSendScene, label: "Send", hue: "green" },
  "iv-import": { ms: IV_IMPORT_MS, C: InvoiceImportScene, label: "Import", hue: "green" },
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
