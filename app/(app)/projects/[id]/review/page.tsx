import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card, EmptyState } from "@/components/ui/card";
import { AssetCard } from "@/components/projects/asset-card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { StatusTag } from "@/components/status-tag";
import { ASSET_STATUS } from "@/lib/status";
import { loadProjectAssets } from "@/lib/project-data";
import type { AssetStatus } from "@/lib/database.types";

// The review pipeline: assets that are in the review cycle, grouped by state.
// (The Assets page is the full library; this is the subset that needs review.)
const SECTIONS: { status: AssetStatus; label: string }[] = [
  { status: "in_review", label: "Awaiting review" },
  { status: "needs_changes", label: "Changes requested" },
  { status: "approved", label: "Approved" },
];

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { assets, reviewLinkByAsset } = await loadProjectAssets(
    supabase,
    project.id
  );

  const inReview = assets.filter((a) =>
    SECTIONS.some((s) => s.status === a.status)
  );

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Review & approvals"
        hue="pink"
        subtitle="Assets in the review cycle. Comment, sign off, or share with the client."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3 8-8" />
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
          </svg>
        }
      />

      {inReview.length === 0 ? (
        <EmptyState
          hue="pink"
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3 8-8" />
              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
            </svg>
          }
          title="Nothing in review yet"
          description="When a deliverable is ready for feedback, set its status to “In review” on the Assets page and it will appear here."
          action={
            <Link
              href={`/projects/${project.id}/assets`}
              className="rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
            >
              Go to Assets
            </Link>
          }
          steps={[
            {
              title: "Set “In review”",
              text: "On the Assets page, flip a deliverable's status to In review.",
            },
            {
              title: "Collect feedback",
              text: "Pin comments internally, or share a link with the client.",
            },
            {
              title: "Sign off",
              text: "Approve or request changes; it moves through the pipeline.",
            },
          ]}
        />
      ) : (
        <div className="space-y-8">
          {SECTIONS.map((section) => {
            const items = inReview.filter((a) => a.status === section.status);
            if (items.length === 0) return null;
            const meta = ASSET_STATUS[section.status];
            return (
              <div key={section.status}>
                <div className="mb-3 flex items-center gap-2">
                  <StatusTag hue={meta.hue}>{section.label}</StatusTag>
                  <span className="text-xs font-semibold text-text-faint">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => (
                    <AssetCard
                      key={a.id}
                      asset={a}
                      projectId={project.id}
                      studioId={ctx.studio.id}
                      currentUserId={ctx.userId}
                      reviewLink={reviewLinkByAsset.get(a.id) ?? null}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
