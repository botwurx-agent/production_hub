/**
 * One shot, as it appears in a shot list export.
 *
 * Extracted from the export page so it can be rendered and checked on its own,
 * and because the reference layout it follows (image, spec line, description,
 * a labelled meta block, chips) is a card other production documents will want.
 * The same reasoning that pulled ProductionCover out of this page.
 */

const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

export type ShotTileData = {
  code: string | null;
  day: string | null;
  shot_size: string | null;
  shot_type: string | null;
  movement: string | null;
  description: string | null;
  vo: string | null;
  notes: string | null;
  tags: unknown;
};

export function ShotTile({
  shot,
  n,
  imageUrl,
  dayLabel,
}: {
  shot: ShotTileData;
  /** Position in the running order across the whole list. */
  n: number;
  imageUrl: string | null;
  /** "Day 2", or null on a single-day shoot, where a day pill says nothing. */
  dayLabel?: string | null;
}) {
  // ONE IDENTIFIER LEADS. The code is the producer's own name for the shot and
  // always wins the top-left chip; the running number takes that spot only when
  // there is no code. Drawing both as equals put two unrelated numbering
  // systems on one picture with nothing saying which was which (in the real
  // Hint list, code "8" sat on tile "10").
  const code = shot.code?.trim() || "";
  const num = String(n).padStart(2, "0");
  // The spec line, which the export used to throw away entirely: shot size and
  // angle are typed into the shot list table and appeared nowhere in the PDF.
  const spec = [shot.shot_size?.trim(), shot.shot_type?.trim()].filter(Boolean);
  // MOVEMENT IS NOT ALWAYS A TAG, so it is not always a chip. The field is a
  // free-text combobox and producers use it both ways: "Push In" is a tag, but
  // the real Hint list also holds "End of the push in. Low angle, looking
  // straight on", which as an uppercase chip renders as a shouting paragraph
  // that wraps across two lines. A value reads as a tag when it is short and
  // carries no sentence punctuation; anything else is prose and gets a
  // labelled line, in the case it was written in.
  const move = shot.movement?.trim() || "";
  const moveIsTag = move.length > 0 && move.length <= 18 && !/[.,;:]/.test(move);
  const chips = [
    moveIsTag ? move : "",
    ...(Array.isArray(shot.tags) ? (shot.tags as string[]) : []),
  ].filter((t): t is string => Boolean(t && t.trim()));
  const motion = moveIsTag ? "" : move;
  const vo = shot.vo?.trim();
  const notes = shot.notes?.trim();

  return (
    <div
      data-shot={code || num}
      className="flex break-inside-avoid flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm"
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60"
        style={printExact}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-text-faint">No image</span>
        )}
        <span
          data-role="ident"
          style={printExact}
          className="absolute left-2.5 top-2.5 rounded-[8px] bg-white px-2.5 py-1 text-[12px] font-extrabold text-black shadow-sm"
        >
          {code || num}
        </span>
        {/* The day earns a pill only when there is more than one day. On a
            single-day shoot it says nothing and is one more mark to read past. */}
        {dayLabel && (
          <span
            data-role="day"
            style={printExact}
            className="absolute right-2.5 top-2.5 rounded-pill bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            {dayLabel}
          </span>
        )}
        {code && (
          <span
            data-role="order"
            style={printExact}
            className="absolute bottom-2.5 right-2.5 rounded-[7px] bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
          >
            {num}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5 print:gap-1.5 print:p-2.5">
        {spec.length > 0 && (
          <div data-role="spec" className="flex items-center gap-2">
            <span
              style={printExact}
              className="h-2 w-2 shrink-0 rounded-full bg-accent"
            />
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-text-muted print:text-[8.5px]">
              {spec.join(" · ")}
            </span>
          </div>
        )}
        {shot.description?.trim() && (
          <p className="text-[14px] leading-relaxed text-text print:text-[11px] print:leading-snug">
            {shot.description}
          </p>
        )}
        <div className="mt-auto space-y-2 border-t border-border pt-2.5 print:space-y-1 print:pt-1.5">
          {/* VO IS ALWAYS STATED, N/A included. It used to be hidden when
              empty, so a reader could not tell a shot with no line from one
              nobody had written a line for yet. */}
          <p data-role="vo" className="text-[12px] leading-snug text-text-muted print:text-[9.5px]">
            <span className="mr-1.5 text-[10px] font-bold uppercase tracking-widest text-text-faint print:text-[8px]">
              VO
            </span>
            {vo ? (
              <span className="whitespace-pre-wrap">{vo}</span>
            ) : (
              <span className="text-text-faint">N/A</span>
            )}
          </p>
          {motion && (
            <p data-role="motion" className="text-[12px] leading-snug text-text-muted print:text-[9.5px]">
              <span className="mr-1.5 text-[10px] font-bold uppercase tracking-widest text-text-faint print:text-[8px]">
                Motion
              </span>
              <span className="whitespace-pre-wrap">{motion}</span>
            </p>
          )}
          {notes && (
            <p className="text-[12px] leading-snug text-text-muted print:text-[9.5px]">
              <span className="mr-1.5 text-[10px] font-bold uppercase tracking-widest text-text-faint print:text-[8px]">
                Notes
              </span>
              <span className="whitespace-pre-wrap">{notes}</span>
            </p>
          )}
          {chips.length > 0 && (
            <div data-role="chips" className="flex flex-wrap gap-1.5 pt-0.5">
              {chips.map((t, i) => (
                <span
                  key={i}
                  style={printExact}
                  className="rounded-[7px] bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-text-muted print:px-1.5 print:py-0.5 print:text-[8px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
