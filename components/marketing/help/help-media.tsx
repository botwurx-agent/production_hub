import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { DemoPlayer } from "@/components/marketing/demo-player";
import type { HelpMedia as Media } from "@/lib/help/articles";

/**
 * A help article's screenshot or screen recording, in a browser-style frame.
 *
 * RENDERS NOTHING WHEN THE FILE IS MISSING, unlike <Shot>, which draws a
 * dashed placeholder. A placeholder is useful while designing a marketing
 * page and wrong in a help article: a reader following steps would meet a box
 * saying a capture has not been taken. An article can name a capture before
 * it exists and the picture simply appears once `npm run shots` (or
 * `npm run demos`) writes it.
 */
function pngSize(file: string): { width: number; height: number } | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(24);
    if (fs.readSync(fd, head, 0, 24, 0) < 24) return null;
    if (head.toString("ascii", 12, 16) !== "IHDR") return null;
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

const PUB = path.join(process.cwd(), "public", "marketing");

export function helpMediaExists(m?: Media): boolean {
  if (!m) return false;
  if (m.clip) {
    return ["mp4", "webm"].some((e) => fs.existsSync(path.join(PUB, "demos", `${m.clip}.${e}`)));
  }
  if (m.shot) return fs.existsSync(path.join(PUB, "shots", `${m.shot}.png`));
  return false;
}

export function HelpMedia({
  media,
  priority = false,
  sizes = "(min-width: 1024px) 760px, 100vw",
}: {
  media?: Media;
  priority?: boolean;
  sizes?: string;
}) {
  if (!media || !helpMediaExists(media)) return null;

  let body: React.ReactNode;
  if (media.clip) {
    const has = (e: string) => fs.existsSync(path.join(PUB, "demos", `${media.clip}.${e}`));
    body = (
      <DemoPlayer
        mp4={has("mp4") ? `/marketing/demos/${media.clip}.mp4` : undefined}
        webm={has("webm") ? `/marketing/demos/${media.clip}.webm` : undefined}
        poster={has("jpg") ? `/marketing/demos/${media.clip}.jpg` : undefined}
        alt={media.alt}
      />
    );
  } else {
    const src = `/marketing/shots/${media.shot}.png`;
    const real = pngSize(path.join(PUB, "shots", `${media.shot}.png`)) ?? { width: 1600, height: 1000 };
    body = (
      <Image
        src={src}
        alt={media.alt}
        width={real.width}
        height={real.height}
        sizes={sizes}
        priority={priority}
        className="block h-auto w-full"
      />
    );
  }

  return (
    <figure className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_18px_50px_-24px_rgba(20,20,40,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-2" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        {media.clip && (
          <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-text-faint">
            Screen recording
          </span>
        )}
      </div>
      {body}
      <figcaption className="border-t border-border px-4 py-2.5 text-[13px] text-text-muted">{media.alt}</figcaption>
    </figure>
  );
}
