// A FIXTURE, not a mockup any more: the real ScheduleEditor mounted on
// hardcoded data, because the dev server in a Claude Code session cannot reach
// Supabase (the agent proxy blocks the host) and the layout has to be rendered
// to be judged. Same pattern as /dev/comms. The Hint shots, sets and crew
// positions are real; the three-day live-action job is invented and says so.
// Actions fire and fail here (no session), which is expected. Auth-gated in
// production by the /dev/* rule.
import { ScheduleEditor } from "@/components/production/schedule-editor";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { Sidebar } from "@/components/app-shell/sidebar";
import type { RosterOption, ScheduleDayView, ScheduleRowView, ShotOption } from "@/lib/schedule-data";
import type { StripKind } from "@/lib/schedule-time";

// Dynamic so the ?job=live toggle in the header is honoured; static would
// pre-render one version and ignore the search param.
export const dynamic = "force-dynamic";

let n = 0;
const P = (name: string, position: string, role: "talent" | "crew") => ({ contactId: `c-${name}`, name, position, role });
const row = (dayId: string, kind: StripKind, title: string, durationMin: number, extra: Partial<ScheduleRowView> = {}): ScheduleRowView => ({
  id: `r${++n}`, dayId, position: n, kind, title, location: null, set: null, intExt: null, dayNight: null,
  durationMin, anchoredAt: null, notes: null, shots: [], talent: [], crew: [], ...extra,
});
const sh = (id: string, code: string, description: string) => ({ id, code, description, thumbUrl: null });

const STAGE = "Stage 2, Culver City";
const MC = P("Motion Control Operator", "Motion Control Operator", "crew");
const FS = P("Food Stylist", "Food Stylist", "crew");
const PS = P("Prop Stylist", "Prop Stylist", "crew");
const GF = P("Gaffer", "Gaffer", "crew");
const KG = P("Key Grip", "Key Grip", "crew");
const DP = P("Director of Photography", "Director of Photography", "crew");

const HINT: ScheduleDayView[] = [
  { id: "h1", projectId: "p", dayNumber: 1, date: "2026-09-03", callTime: "8:00", wrapTarget: "6:00 pm", location: STAGE, notes: null, rows: [
    row("h1", "call", "Crew call, load in", 30, { location: STAGE, crew: [GF, KG, MC] }),
    row("h1", "meal", "Breakfast", 30, { anchoredAt: "9:00", location: STAGE, notes: "Craft services on the dock" }),
    row("h1", "setup", "Light Set A, motion control rig check", 60, { location: STAGE, set: "Set A · Cloud wall", crew: [DP, GF, MC] }),
    row("h1", "shot", "Bottle reveal", 120, { location: STAGE, set: "Set A · Cloud wall", crew: [MC, FS, PS],
      shots: [sh("s1a", "1A", "We open closed. A dense wall of pink cloud fills the frame."), sh("s1b", "1B", "The clouds clear away completely and the setup is revealed."), sh("s1c", "1C", "The bottles rotate and lock into perfect alignment.")] }),
    row("h1", "shot", "Cupcake macro", 90, { location: STAGE, set: "Set A", crew: [FS, P("Food Stylist Assistant", "Food Stylist Assistant", "crew")], notes: "Fresh cupcakes from 11:30, do not plate early",
      shots: [sh("s2", "2", "We continue into the strawberry cupcake until it fills the frame.")] }),
    row("h1", "meal", "Lunch", 60, { anchoredAt: "1:00 pm", location: STAGE }),
    row("h1", "move", "Reset to Set B", 30, { location: STAGE, set: "Set B · Cobbler world", crew: [PS, KG] }),
    row("h1", "shot", "Cobbler world", 150, { location: STAGE, set: "Set B · Cobbler world", crew: [MC, PS, FS],
      shots: [sh("s3", "3", "We crest the cupcake and the first fantasy world opens up."), sh("s4", "4", "The transition lands in the cobbler world. Dolly right.")] }),
    row("h1", "wrap", "Wrap", 0),
  ]},
  { id: "h2", projectId: "p", dayNumber: 2, date: "2026-09-04", callTime: "8:00", wrapTarget: "6:00 pm", location: STAGE, notes: null, rows: [
    row("h2", "call", "Crew call", 30, { location: STAGE }),
    row("h2", "meal", "Breakfast", 30, { anchoredAt: "9:00", location: STAGE }),
    row("h2", "setup", "Build pineapple world", 90, { location: STAGE, set: "Set C · Pineapple", crew: [PS] }),
    row("h2", "shot", "Pineapple world", 120, { location: STAGE, set: "Set C · Pineapple", crew: [MC, FS], shots: [sh("s5", "5", "The transition lands in the pineapple world. A sweeping arch.")] }),
    row("h2", "meal", "Lunch", 60, { anchoredAt: "1:00 pm", location: STAGE }),
    row("h2", "move", "Reset to key lime, rig the descent", 45, { location: STAGE, set: "Set D · Key lime" }),
    row("h2", "shot", "Key lime descent", 120, { location: STAGE, set: "Set D · Key lime", shots: [sh("s6", "6", "The transition lands in the key lime world. Then DESCEND."), sh("s7", "7", "Fully submerged. Open, clear, quiet water. Godray shafts.")] }),
    row("h2", "shot", "Product beauty", 60, { location: STAGE, set: "Set E · Beauty", crew: [P("Photographer", "Photographer", "crew"), FS], shots: [sh("s8", "8", "Final product beauty. The Treat Yourself variety pack.")] }),
    row("h2", "wrap", "Wrap", 0),
  ]},
];

const HOUSE = "412 Elm St, Pasadena";
const CAFE = "Roasters Cafe, 88 Colorado Blvd";
const MAYA = P("Maya Chen", "Lead", "talent");
const THEO = P("Theo Okafor", "Supporting", "talent");
const AD = P("1st AD", "1st AD", "crew");
const LIVE: ScheduleDayView[] = [
  { id: "l1", projectId: "p", dayNumber: 1, date: "2026-10-06", callTime: "6:00", wrapTarget: "5:00 pm", location: HOUSE, notes: null, rows: [
    row("l1", "call", "Crew call. Talent to HMU", 60, { location: HOUSE, talent: [MAYA], crew: [AD, P("HMU", "HMU", "crew"), P("Wardrobe", "Wardrobe", "crew")] }),
    row("l1", "shot", "Kitchen, wake-up sequence", 180, { location: HOUSE, set: "Kitchen", intExt: "INT", dayNight: "DAY", talent: [MAYA], crew: [DP, GF, P("Sound", "Sound", "crew")], shots: [sh("l3", "3", "She pours the coffee, light through the blinds."), sh("l4", "4", "CU hands, mug.")] }),
    row("l1", "meal", "Lunch", 60, { anchoredAt: "12:00 pm", location: HOUSE }),
    row("l1", "move", "Company move to street", 60, { location: HOUSE, notes: "Trucks stay on Elm. Basecamp in the driveway." }),
    row("l1", "shot", "Street, leaving the house", 150, { location: HOUSE, set: "Front steps, Elm St", intExt: "EXT", dayNight: "DAY", talent: [MAYA], crew: [P("Steadicam", "Steadicam", "crew"), DP], shots: [sh("l6", "6", "Wide, she steps out. Steadicam follow.")] }),
    row("l1", "wrap", "Wrap", 0),
  ]},
  { id: "l2", projectId: "p", dayNumber: 2, date: "2026-10-07", callTime: "2:00 pm", wrapTarget: "1:00 am", location: HOUSE, notes: null, rows: [
    row("l2", "call", "Crew call (night)", 60, { location: HOUSE, talent: [MAYA], crew: [AD] }),
    row("l2", "shot", "Bedroom, evening wind-down", 180, { location: HOUSE, set: "Bedroom", intExt: "INT", dayNight: "NIGHT", talent: [MAYA], crew: [DP, GF], shots: [sh("l9", "9", "Lamp light, she sets the alarm.")] }),
    row("l2", "meal", "Dinner", 60, { anchoredAt: "8:00 pm", location: HOUSE }),
    row("l2", "shot", "Porch, night", 150, { location: HOUSE, set: "Porch", intExt: "EXT", dayNight: "NIGHT", talent: [MAYA], crew: [GF], shots: [sh("l10", "10", "Porch light on, city hum. Locked off.")] }),
    row("l2", "wrap", "Wrap", 0),
  ]},
  { id: "l3", projectId: "p", dayNumber: 3, date: "2026-10-08", callTime: "7:00", wrapTarget: "4:00 pm", location: CAFE, notes: null, rows: [
    row("l3", "call", "Crew call", 30, { location: CAFE, talent: [MAYA, THEO], crew: [AD] }),
    row("l3", "shot", "Cafe, the meet", 210, { location: CAFE, set: "Counter", intExt: "INT", dayNight: "DAY", talent: [MAYA, THEO], crew: [DP], shots: [sh("l12", "12", "Two-shot at the counter."), sh("l13", "13", "Product insert, cup.")] }),
    row("l3", "meal", "Lunch", 60, { anchoredAt: "12:30 pm", location: CAFE }),
    row("l3", "shot", "Cafe patio", 120, { location: CAFE, set: "Patio", intExt: "EXT", dayNight: "DAY", talent: [MAYA, THEO], shots: [sh("l14", "14", "Wide, they leave together.")] }),
    row("l3", "wrap", "Wrap", 0),
  ]},
];

const SHOTS: ShotOption[] = [
  ...HINT.flatMap((d) => d.rows.flatMap((r) => r.shots.map((s): ShotOption => ({ id: s.id, code: s.code, description: s.description, list: "HINT Treat Yourself Shot List", thumbUrl: null, rowId: r.id })))),
  { id: "s9", code: "9", description: "Alt beauty, top down (unscheduled)", list: "HINT Treat Yourself Shot List", thumbUrl: null, rowId: null },
];
const ROSTER: RosterOption[] = [
  ...[DP, GF, KG, MC, FS, PS].map((p) => ({ contactId: p.contactId, name: p.name, position: p.position, category: "crew" })),
  { contactId: "c-maya", name: "Maya Chen", position: "Lead", category: "talent" },
];

export default function Page({ searchParams }: { searchParams: { job?: string } }) {
  const days = searchParams.job === "live" ? LIVE : HINT;
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar studioName="Studio Flows" assistant />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="flex-1" />
            <a href={searchParams.job === "live" ? "/dev/schedule" : "/dev/schedule?job=live"} className="text-xs font-semibold text-accent hover:underline">
              {searchParams.job === "live" ? "Show Hint (real shots)" : "Show 3-day live action (example)"}
            </a>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted">Fixture · saves fail here</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6">
          <ProjectSubhead projectId="mock" projectTitle={searchParams.job === "live" ? "Morning Ritual (example)" : "Hint Treat Yourself"} section="Schedule" hue="green"
            subtitle="The shoot, day by day. Times fall out of the durations; the day re-flows when anything changes."
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h4M8 18h6" /></svg>} />
          <div className="mt-5">
            <ScheduleEditor projectId="p" days={days} shotOptions={SHOTS} roster={ROSTER} canEdit />
          </div>
        </main>
      </div>
    </div>
  );
}
