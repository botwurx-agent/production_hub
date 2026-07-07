"use client";

import type { DocSurface } from "@/lib/review-links";

// Read-only renders of the doc surfaces the client reviews. These are the
// pinnable "stage" inside PinCanvas, so they must lay out deterministically
// (no inputs, no interactivity) and fill the available width.

const shotChip =
  "inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold";

export function DocSurfaceView({ surface }: { surface: DocSurface }) {
  if (surface.kind === "shot_list") return <ShotListSurface surface={surface} />;
  if (surface.kind === "storyboard") return <StoryboardSurface surface={surface} />;
  return <MoodboardSurface surface={surface} />;
}

function ShotListSurface({
  surface,
}: {
  surface: Extract<DocSurface, { kind: "shot_list" }>;
}) {
  const empty = surface.groups.every((g) => g.cards.length === 0);
  return (
    <div className="w-full rounded-[12px] bg-surface p-4 text-text sm:p-6">
      {surface.cover?.title && (
        <div className="mb-5 border-b border-border pb-4">
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            {surface.cover.title}
          </h2>
          {surface.cover.subtitle && (
            <p className="mt-0.5 text-sm text-text-muted">{surface.cover.subtitle}</p>
          )}
        </div>
      )}

      {empty ? (
        <p className="py-10 text-center text-sm text-text-faint">
          This shot list is empty.
        </p>
      ) : (
        <div className="space-y-6">
          {surface.groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="font-display text-base font-bold">{g.title}</h3>
                {g.subtitle && (
                  <span className="text-xs text-text-faint">{g.subtitle}</span>
                )}
                <span className="ml-auto text-xs font-semibold text-text-faint">
                  {g.cards.length} {g.cards.length === 1 ? "shot" : "shots"}
                </span>
              </div>
              <div className="space-y-2.5">
                {g.cards.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface-2/40 p-3 sm:flex-row sm:items-start"
                    style={{ borderLeft: "4px solid var(--h-indigo)" }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-xs font-extrabold tabular-nums text-white"
                        style={{ backgroundColor: "var(--h-indigo)" }}
                      >
                        {i + 1}
                      </span>
                      <div className="grid h-[72px] w-24 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface">
                        {c.signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.signedUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-semibold text-text-faint">
                            No image
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="whitespace-pre-wrap break-words text-sm text-text">
                        {c.description || (
                          <span className="text-text-faint">No description</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.shotSize && (
                          <span
                            className={shotChip}
                            style={{ backgroundColor: "var(--h-blue-bg)", color: "var(--h-blue)" }}
                          >
                            {c.shotSize}
                          </span>
                        )}
                        {c.shotType && (
                          <span
                            className={shotChip}
                            style={{ backgroundColor: "var(--h-purple-bg)", color: "var(--h-purple)" }}
                          >
                            {c.shotType}
                          </span>
                        )}
                        {c.movement && (
                          <span
                            className={shotChip}
                            style={{ backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }}
                          >
                            {c.movement}
                          </span>
                        )}
                        {(c.code || c.day) && (
                          <span className={`${shotChip} bg-surface-2 text-text-muted`}>
                            {[c.code, c.day].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoryboardSurface({
  surface,
}: {
  surface: Extract<DocSurface, { kind: "storyboard" }>;
}) {
  if (surface.frames.length === 0) {
    return (
      <div className="w-full rounded-[12px] bg-surface p-10 text-center">
        <p className="text-sm text-text-faint">This storyboard has no frames yet.</p>
      </div>
    );
  }
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {surface.frames.map((f, i) => (
        <div
          key={f.id}
          className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface text-text shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            {f.scene && (
              <span className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-text-muted">
                {f.scene}
              </span>
            )}
            <span className="text-sm font-extrabold">Frame {i + 1}</span>
          </div>
          <div className="grid aspect-[16/10] place-items-center overflow-hidden bg-surface-2/60">
            {f.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.signedUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-text-faint">No image</span>
            )}
          </div>
          <div className="space-y-1.5 p-3">
            {f.description && (
              <p className="whitespace-pre-wrap break-words text-sm text-text">
                {f.description}
              </p>
            )}
            {f.sound && (
              <p className="text-xs text-text-muted">
                <span className="font-bold uppercase tracking-wide text-text-faint">Sound </span>
                {f.sound}
              </p>
            )}
            {f.notes && (
              <p className="text-xs text-text-muted">
                <span className="font-bold uppercase tracking-wide text-text-faint">Motion </span>
                {f.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MoodboardSurface({
  surface,
}: {
  surface: Extract<DocSurface, { kind: "moodboard" }>;
}) {
  const items = surface.items;
  if (items.length === 0) {
    return (
      <div className="w-full rounded-[12px] bg-surface p-10 text-center">
        <p className="text-sm text-text-faint">This moodboard is empty.</p>
      </div>
    );
  }
  // Fit the freeform canvas to the stage width, preserving the layout.
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.w));
  const maxY = Math.max(...items.map((i) => i.y + i.h));
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[12px] bg-surface"
      style={{ aspectRatio: `${boxW} / ${boxH}` }}
    >
      {items.map((it) => {
        const style: React.CSSProperties = {
          left: `${((it.x - minX) / boxW) * 100}%`,
          top: `${((it.y - minY) / boxH) * 100}%`,
          width: `${(it.w / boxW) * 100}%`,
          height: `${(it.h / boxH) * 100}%`,
        };
        if (it.kind === "note") {
          const hue = it.hue || "amber";
          return (
            <div
              key={it.id}
              className="absolute overflow-hidden rounded-[10px] p-2.5 text-[13px] shadow-sm"
              style={{
                ...style,
                backgroundColor: `var(--h-${hue}-bg)`,
                color: `var(--h-${hue})`,
              }}
            >
              <span className="whitespace-pre-wrap break-words">{it.text}</span>
            </div>
          );
        }
        return (
          <div
            key={it.id}
            className="absolute overflow-hidden rounded-[10px] border border-border bg-surface-2 shadow-sm"
            style={style}
          >
            {it.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.signedUrl} alt={it.name ?? ""} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-[10px] text-text-faint">
                {it.name ?? "item"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
