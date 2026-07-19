"use client";

import { PinCanvas } from "@/components/review/pin-canvas";
import { VideoReview } from "@/components/review/video-review";
import { DocSurfaceView } from "@/components/review/doc-surface";
import type { DocSurface, DocShotMedia, PortalComment } from "@/lib/review-links";

// A comment anchor: an image pin (percent coords) OR a video timecode (seconds).
export type ShotAnchor = {
  pin?: { x: number; y: number } | null;
  timecode?: number | null;
};

// Review canvas for an AI pipeline shot. If the shot has a playable take video,
// review it with the timecode scrubber (frames shown above as reference). Before
// a take exists (image stage), fall back to the pin canvas over the frames. So
// the review surface matches where the shot is in the pipeline.
export function AiShotReviewCanvas({
  surface,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  wide = false,
  onPost,
  onResolve,
}: {
  surface: Extract<DocSurface, { kind: "ai_shot" }>;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  wide?: boolean;
  onPost: (text: string, anchor: ShotAnchor) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  if (surface.takeVideoUrl) {
    return (
      <div className="space-y-3">
        {surface.frames.length > 0 && <FrameStrip frames={surface.frames} />}
        <VideoReview
          videoUrl={surface.takeVideoUrl}
          comments={comments}
          canResolve={canResolve}
          disabled={disabled}
          disabledHint={disabledHint}
          wide={wide}
          onPost={(text, timecode) => onPost(text, { timecode })}
          onResolve={onResolve}
        />
      </div>
    );
  }

  return (
    <PinCanvas
      stage={<DocSurfaceView surface={surface} />}
      stageBg="var(--surface-2)"
      fit="full"
      comments={comments}
      canResolve={canResolve}
      disabled={disabled}
      disabledHint={disabledHint}
      wide={wide}
      emptyHint="Click a frame to drop a pin and start."
      onPost={(text, pin) => onPost(text, { pin })}
      onResolve={onResolve}
    />
  );
}

// The picked start/end frames as small reference tiles above the take video.
function FrameStrip({ frames }: { frames: DocShotMedia[] }) {
  return (
    <div className="flex flex-wrap gap-3 rounded-[14px] border border-border bg-surface-2/40 p-3">
      {frames.map((f) => (
        <div key={f.id} className="w-40">
          <div
            className="mb-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: f.role === "start" ? "var(--h-cyan)" : "var(--h-pink)" }}
          >
            {f.label}
          </div>
          <div
            className="relative overflow-hidden rounded-[8px] border border-border bg-black/70"
            style={{ aspectRatio: "16/9" }}
          >
            {f.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.signedUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-white/50">
                No preview
              </span>
            )}
          </div>
          {f.openUrl && (
            <a
              href={f.openUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[11px] font-bold text-accent hover:underline"
            >
              Open ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
