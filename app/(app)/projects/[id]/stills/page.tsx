import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { signThumbs } from "@/lib/asset-storage";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { LocationStills, type StillView } from "@/components/viewfinder/location-stills";

export const dynamic = "force-dynamic";

export const metadata = { title: "Location stills" };

export default async function StillsPage({ params }: { params: { id: string } }) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, title").eq("id", params.id).maybeSingle();
  if (!project) notFound();

  const { data: rows } = await supabase
    .from("location_stills")
    .select("id, storage_path, width, height, body_id, focal_mm, aspect_id, tilt_deg, roll_deg, phone_camera, note, scene_setup_id, taken_at")
    .eq("project_id", project.id)
    .order("taken_at", { ascending: false });
  const list = rows ?? [];
  // Resized copies for the grid: these are reference frames, not artwork
  // being judged, and a scout can bring back dozens.
  const thumbs = await signThumbs(list.map((r) => r.storage_path), 900);

  const stills: StillView[] = list.map((r) => ({
    id: r.id,
    thumb: thumbs.get(r.storage_path) ?? null,
    width: r.width,
    height: r.height,
    bodyId: r.body_id,
    focal: r.focal_mm,
    aspectId: r.aspect_id,
    tilt: r.tilt_deg,
    roll: r.roll_deg,
    phoneCamera: r.phone_camera,
    note: r.note,
    sceneId: r.scene_setup_id,
    takenAt: r.taken_at,
  }));

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Location stills"
        hue="orange"
        subtitle="Frames taken through the phone viewfinder, each with the lens it was framed for."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h3l2-3h8l2 3h3v13H3z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        }
      />
      <LocationStills
        projectId={project.id}
        stills={stills}
        canEdit={canEditProject(ctx, project.id)}
        canReadRoom={!ctx.isCollaborator}
      />
    </div>
  );
}
