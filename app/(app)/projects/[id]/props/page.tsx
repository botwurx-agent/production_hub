import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { signThumbs } from "@/lib/asset-storage";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { SendToReviewButton } from "@/components/projects/send-to-review-button";
import {
  PropsWorkspace,
  type OptionUrls,
} from "@/components/production/props-workspace";
import type { Prop, PropOption } from "@/lib/props";

export default async function ProjectPropsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // Options come back embedded rather than as a second query, so the page is
  // one round trip however many props there are.
  const [{ data: rows }, { data: vendorRows }, { data: docReview }] = await Promise.all([
    supabase
      .from("props")
      .select(
        "id, name, category, qty, notes, source, contact_id, status, picked_option_id, options:prop_options(id, name, storage_path, mime_type, url, source, notes, position)"
      )
      .eq("project_id", project.id)
      .order("position", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("project_id", project.id)
      .eq("type", "vendor")
      .order("name", { ascending: true }),
    // target_id is the project, like the shot list: one prop list per job, so
    // the whole thing goes out in one link rather than a link per glass.
    supabase
      .from("doc_reviews")
      .select("id")
      .eq("project_id", project.id)
      .eq("target_type", "props")
      .eq("target_id", project.id)
      .maybeSingle(),
  ]);

  const props: Prop[] = (rows ?? []).map((r) => {
    const raw = r as unknown as Prop & {
      options: (PropOption & { position: number })[];
    };
    return {
      ...raw,
      // Postgres does not promise an order inside an embedded select, so the
      // options are sorted here rather than trusted. Without it "Option 1" can
      // change which photo it means between two loads of the same page.
      options: [...(raw.options ?? [])].sort((a, b) => a.position - b.position),
    };
  });

  // One signing pass for every option image on the page. Resized copies, since
  // these draw at card and thumbnail size and a prop-house photo is large.
  const paths = props
    .flatMap((p) => p.options)
    .map((o) => o.storage_path)
    .filter((p): p is string => Boolean(p));
  const signed = await signThumbs(paths, 800);

  const optionUrls: OptionUrls = {};
  for (const p of props) {
    for (const o of p.options) {
      const url = o.storage_path ? signed.get(o.storage_path) : null;
      if (url) optionUrls[o.id] = url;
    }
  }

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Props"
        hue="pink"
        subtitle="What the job needs on the table, the options for each, and which one won."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
            <path d="M3 8.5v7L12 20l9-4.5v-7" />
            <path d="M12 13v7" />
          </svg>
        }
        action={
          <SendToReviewButton
            projectId={project.id}
            kind="props"
            targetId={project.id}
            inReview={Boolean(docReview)}
          />
        }
      />
      <PropsWorkspace
        projectId={project.id}
        props={props}
        optionUrls={optionUrls}
        vendors={(vendorRows ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
