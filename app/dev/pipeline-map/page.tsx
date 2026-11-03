// A FIXTURE: the real PipelineMap mounted on invented data, because a dev
// server in a Claude Code session cannot reach Supabase. The job ("Golden
// Hour", a sparkling water spot) is made up and says so; the shapes are the
// real ones the pipeline stores (start/end frames, motion refs, picked takes).
// Arranged positions persist in this browser only. Auth-gated in production by
// the /dev/* rule.
import { Sidebar } from "@/components/app-shell/sidebar";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { MapFixture } from "./map-fixture";

export default function Page() {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar studioName="Studio Flows" assistant />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 px-4 py-6 md:px-6">
          <ProjectSubhead
            projectId="mock"
            projectTitle="Golden Hour (example)"
            section="AI Pipeline"
            hue="purple"
            subtitle="Script to prompt to images to video, with provenance on every generation."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" /><circle cx="14.5" cy="14.5" r="2.5" />
              </svg>
            }
          />
          <div className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <MapFixture />
          </div>
        </main>
      </div>
    </div>
  );
}
