import Image from "next/image";

/**
 * The hero's evidence: one anchor surface with closeups of the product floating
 * over its corners.
 *
 * WHY A CLUSTER RATHER THAN A SCREENSHOT. A hero gives its picture about 700
 * CSS pixels. A full app screen shrunk to that width is a grey mosaic: you can
 * tell it is software and nothing else. Closeups stay legible at any size, and
 * three of them say three true things at once, which a single screenshot of one
 * page cannot. The three chosen here are deliberately from different ends of the
 * job (a client pointing at a frame, the crew confirming a call, what the job
 * made) because the headline claims one place for all of it, and the picture
 * should be the argument rather than a decoration beside it.
 *
 * EVERY TILE IS REAL. They are cropped by scripts/crop-closeups.mjs out of the
 * demo-studio screenshots capture-shots.mjs already takes, so a tile cannot
 * drift away from the product, and nothing here is drawn to look like an
 * interface that does not exist. That rule is why the composition uses no stock
 * photograph of a person, which is the one part of the reference layout we
 * refuse.
 *
 * The anchor is the review canvas because it is the one surface that survives
 * being small: a photograph with numbered pins on it, not a page of 13px type.
 */

type Tile = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Placement inside the cluster box, as percentages so it scales. */
  style: React.CSSProperties;
};

const TILES: Tile[] = [
  {
    src: "/marketing/shots/close/review-comment.png",
    alt: "A client's pinned comment on a frame, badged as coming from the client.",
    width: 770,
    height: 226,
    style: { top: "6%", right: "0%", width: "58%" },
  },
  {
    src: "/marketing/shots/close/budget-margin.png",
    alt: "A project's margin: billed, job cost, and what that left.",
    width: 740,
    height: 235,
    style: { bottom: "0%", left: "2%", width: "50%" },
  },
  {
    src: "/marketing/shots/close/callsheet-send.png",
    alt: "A call sheet's send control, showing four of seven crew confirmed.",
    width: 662,
    height: 100,
    style: { bottom: "16%", right: "1%", width: "46%" },
  },
];

export function ShotCluster({ className = "" }: { className?: string }) {
  return (
    // The padding is the room the floating tiles hang in: without it their
    // shadows are clipped by the section's own edge on a narrow window.
    <div className={`relative ${className}`}>
      <div className="relative pb-[18%] pr-[10%] pt-[4%]">
        {/* Anchor */}
        <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3.5 py-2.5">
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="ml-2 truncate text-[11px] text-text-faint">
              studio-flows.com/r/bright-water-hero
            </span>
          </div>
          <Image
            src="/marketing/shots/close/review-stage.png"
            alt="The client review canvas: a pack shot with numbered comment pins on it."
            width={1492}
            height={1120}
            priority
            sizes="(min-width: 1024px) 620px, 100vw"
            className="block h-auto w-full"
          />
        </div>

        {TILES.map((t) => (
          <Image
            key={t.src}
            src={t.src}
            alt={t.alt}
            width={t.width}
            height={t.height}
            sizes="(min-width: 1024px) 360px, 50vw"
            style={t.style}
            // Each tile carries the surface and border its own screenshot was
            // cropped out of, so it reads as a piece of the product lifted out
            // rather than a picture pasted on top of one.
            className="absolute h-auto rounded-[13px] border border-border bg-surface p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}
