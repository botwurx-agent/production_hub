import fs from "node:fs";
import path from "node:path";
import { DemoPlayer } from "@/components/marketing/demo-player";

/**
 * A short looping product demo, recorded by scripts/capture-demos.mjs.
 *
 * WHY A CLIP AND NOT A SCREENSHOT. On the canvas pages every claim we make is
 * an INTERACTION: creation is drag-only, selecting a card turns the tool rail
 * into that card's editor, an arrow is drawn by dragging between two cards. A
 * still frame cannot show any of those, so the page ends up asserting in prose
 * what a six-second loop simply demonstrates. It is also what Milanote does on
 * every section of their home page, and it is why their page explains itself
 * with one sentence where ours needs four bullets.
 *
 * Same rules as the screenshots, for the same reasons: the real demo studio and
 * never a mockup, and the same 1503x852 viewport so a clip's section is the
 * same height as a still's.
 *
 * THE EXISTENCE CHECK RUNS ON THE SERVER, exactly as <Shot> does, which is why
 * this half is not a client component: a page can be designed and reviewed
 * before the clips are recorded, and a missing clip is an obvious labelled
 * placeholder rather than a broken black rectangle.
 *
 * Two files per clip and both are wanted. Playwright records WebM/VP8 and can
 * record nothing else; iOS Safari's WebM support is patchy enough that some
 * iPhones would show a blank frame, so the recorder also writes MP4/H.264 and
 * the player lists it first. A clip costs about 180KB, which is less than any
 * of the screenshots it sits beside.
 */
export function DemoVideo({
  clip,
  alt,
  hue = "indigo",
}: {
  /** Basename in public/marketing/demos, without an extension. */
  clip: string;
  alt: string;
  hue?: string;
}) {
  const dir = path.join(process.cwd(), "public", "marketing", "demos");
  const has = (ext: string) => fs.existsSync(path.join(dir, `${clip}.${ext}`));
  const mp4 = has("mp4");
  const webm = has("webm");

  if (!mp4 && !webm) {
    return (
      <div
        className="grid aspect-[1503/852] place-items-center px-8 text-center"
        style={{
          background: `linear-gradient(135deg, var(--h-${hue}-bg) 0%, var(--surface-2) 55%, var(--surface) 100%)`,
        }}
      >
        <div>
          <p
            className="font-display text-sm font-bold"
            style={{ color: `var(--h-${hue})` }}
          >
            {clip}
          </p>
          <p className="mt-1 text-xs text-text-faint">
            Clip not recorded yet. Run <code>npm run demos</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DemoPlayer
      alt={alt}
      poster={has("jpg") ? `/marketing/demos/${clip}.jpg` : undefined}
      mp4={mp4 ? `/marketing/demos/${clip}.mp4` : undefined}
      webm={webm ? `/marketing/demos/${clip}.webm` : undefined}
    />
  );
}
