// A MOCKUP of the schedule builder, for the operator to judge the layout and
// feel the cascade before any schema exists. Hardcoded data (the Hint shots
// and crew are real; the three-day live-action job is an invented example and
// says so). Renders the real Sidebar, ProjectSubhead and tokens so it can be
// judged in context. Auth-gated in production by the /dev/* middleware rule.
// Delete when the real page lands at /projects/[id]/schedule.
import { ScheduleMockup } from "@/components/dev/schedule-mockup";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { Sidebar } from "@/components/app-shell/sidebar";

export const dynamic = "force-static";

export default function Page() {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar studioName="Studio Flows" assistant />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="flex-1" />
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted">
              Mockup · nothing here saves
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6">
          <ProjectSubhead
            projectId="mock"
            projectTitle="Hint Treat Yourself"
            section="Schedule"
            hue="green"
            subtitle="The shoot, day by day. Times fall out of the durations; the day re-flows when anything changes."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h4M8 18h6" />
              </svg>
            }
          />
          <div className="mt-5">
            <ScheduleMockup />
          </div>
        </main>
      </div>
    </div>
  );
}
