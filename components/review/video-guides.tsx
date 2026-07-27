"use client";

// Overlay guides for judging a frame: broadcast safe areas, rule-of-thirds, and
// crop masks showing where a social cutdown would land on a 16:9 master. The
// last one matters for this ICP: a commercial job ships 9:16 and 1:1 versions,
// and the question "does the product survive the crop" comes up on every review.

export type GuideMode =
  | "off"
  | "thirds"
  | "safe"
  | "crop-1x1"
  | "crop-4x5"
  | "crop-9x16";

export const GUIDE_OPTIONS: { key: GuideMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "thirds", label: "Rule of thirds" },
  { key: "safe", label: "Title and action safe" },
  { key: "crop-1x1", label: "Crop 1:1" },
  { key: "crop-4x5", label: "Crop 4:5" },
  { key: "crop-9x16", label: "Crop 9:16" },
];

const CROP_RATIO: Record<string, number> = {
  "crop-1x1": 1,
  "crop-4x5": 4 / 5,
  "crop-9x16": 9 / 16,
};

export function GuideOverlay({
  mode,
  // Natural size of the media, so a crop mask is computed against the real
  // frame rather than the letterboxed player box.
  mediaWidth,
  mediaHeight,
}: {
  mode: GuideMode;
  mediaWidth: number;
  mediaHeight: number;
}) {
  if (mode === "off") return null;

  const line = "absolute bg-white/45";

  if (mode === "thirds") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]">
        <span className={`${line} left-1/3 top-0 h-full w-px`} />
        <span className={`${line} left-2/3 top-0 h-full w-px`} />
        <span className={`${line} left-0 top-1/3 h-px w-full`} />
        <span className={`${line} left-0 top-2/3 h-px w-full`} />
      </div>
    );
  }

  if (mode === "safe") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]">
        {/* Action safe 90%, title safe 80%: the broadcast convention. */}
        <span className="absolute inset-[5%] border border-white/40" />
        <span className="absolute inset-[10%] border border-dashed border-white/55" />
        <span className="absolute bottom-[10.5%] left-[10.5%] rounded-[4px] bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white/80">
          Title safe
        </span>
      </div>
    );
  }

  // Crop masks: dim everything outside the target aspect, centred.
  const target = CROP_RATIO[mode];
  if (!target || !mediaWidth || !mediaHeight) return null;
  const source = mediaWidth / mediaHeight;

  // Percentage of the frame the crop keeps, on whichever axis is trimmed.
  const keep = target < source ? target / source : source / target;
  const bar = ((1 - keep) / 2) * 100;
  const vertical = target < source;

  return (
    <div className="pointer-events-none absolute inset-0 z-[6]">
      {vertical ? (
        <>
          <span
            className="absolute inset-y-0 left-0 bg-black/55"
            style={{ width: `${bar}%` }}
          />
          <span
            className="absolute inset-y-0 right-0 bg-black/55"
            style={{ width: `${bar}%` }}
          />
          <span
            className="absolute inset-y-0 border-x border-white/60"
            style={{ left: `${bar}%`, right: `${bar}%` }}
          />
        </>
      ) : (
        <>
          <span
            className="absolute inset-x-0 top-0 bg-black/55"
            style={{ height: `${bar}%` }}
          />
          <span
            className="absolute inset-x-0 bottom-0 bg-black/55"
            style={{ height: `${bar}%` }}
          />
          <span
            className="absolute inset-x-0 border-y border-white/60"
            style={{ top: `${bar}%`, bottom: `${bar}%` }}
          />
        </>
      )}
      <span className="absolute left-2 top-2 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
        {mode.replace("crop-", "").replace("x", ":")} crop
      </span>
    </div>
  );
}
