"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  findPanels,
  panelsFromImages,
  readingOrder,
  sliceGrid,
  withPictures,
  type Rect,
} from "@/lib/panels";
import {
  MAX_PAGES,
  cropToBlob,
  pageForReading,
  readPdf,
  toGray,
  type PdfPage,
} from "@/lib/pdf-client";
import { captionFor, splitCaption, stripFurniture, type TextRun } from "@/lib/captions";
import { detectFrameAspect } from "@/lib/frame-aspect";
import { uploadAssetFile } from "@/components/projects/upload-file";
import {
  fileSourceDocument,
  importShotList,
  importStoryboard,
  readProductionDoc,
  type ImportShotRow,
} from "@/app/(app)/projects/[id]/import-actions";
import {
  matchShotsToPanels,
  type ShotDocDraft,
  type ShotDocRow,
} from "@/lib/shot-doc";

type PagePlan = {
  page: PdfPage;
  /**
   * The page's text, minus the running header, footer and page number.
   *
   * Held on the plan rather than read off `page.runs` at each call site,
   * because furniture can only be spotted by looking at every page at once and
   * the three places that build captions each see one page.
   */
  runs: TextRun[];
  rects: Rect[];
  /** The detector found gutters it believed in. */
  auto: boolean;
  captions: string[];
};

type Stage = "pick" | "reading" | "confirm" | "saving";

/**
 * One import flow, several doors.
 *
 * A director's package is frequently ONE PDF holding both a board and a shot
 * list, so making the producer declare which it is before importing means they
 * are sometimes wrong about their own document. Instead the file is read and
 * the app says what it found.
 *
 * Nothing is written until the grid below has been looked at. Panel detection
 * does not have to be perfect, it has to be right often enough that checking is
 * faster than doing it by hand, and a bad guess has to cost one click.
 */
export function ImportDocModal({
  projectId,
  studioId,
  open,
  onClose,
  onDone,
}: {
  projectId: string;
  studioId: string;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("pick");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [plans, setPlans] = useState<PagePlan[]>([]);
  const [draft, setDraft] = useState<ShotDocDraft | null>(null);
  const [takeShots, setTakeShots] = useState(true);
  const [takeBoards, setTakeBoards] = useState(true);
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set());
  const [skipPanels, setSkipPanels] = useState<Set<string>>(new Set());

  function reset() {
    setStage("pick");
    setNote("");
    setFile(null);
    setPlans([]);
    setDraft(null);
    setSkipRows(new Set());
    setSkipPanels(new Set());
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFile(picked: File | null | undefined) {
    if (!picked) return;
    setFile(picked);
    setStage("reading");
    setNote("Opening the document...");

    try {
      const pages = await readPdf(picked, (done, total) =>
        setNote(`Rendering page ${done} of ${total}...`)
      );
      if (!pages.length) {
        toast("That PDF had no pages.", "error");
        setStage("pick");
        return;
      }

      // Panels first: local, instant, and it tells us whether there is a board
      // here at all before we spend a model call.
      //
      // Placed pictures are asked first because they are read from the document
      // rather than inferred from it, so they are exact and hold up on a
      // designed deck (tiles butted together over a dark background, where
      // there is no gutter to find). Gutter detection then covers the other
      // family: a drawn or printed board that arrives as one scan per page.
      const byImage = panelsFromImages(pages);
      const bodyRuns = stripFurniture(pages);
      const found: PagePlan[] = pages.map((p, i) => {
        const rects = byImage[i].length
          ? byImage[i]
          : (() => {
              const grid = findPanels(toGray(p.canvas));
              if (!grid.confident) return [];
              // Content bands on a page whose text sits beside the artwork
              // include the text columns, so anything holding no picture is
              // dropped rather than offered as a frame.
              return withPictures(readingOrder(grid.rects), p.images);
            })();
        return {
          page: p,
          runs: bodyRuns[i],
          rects,
          auto: rects.length > 0,
          // Read off the page rather than asked for. The words printed under a
          // panel are its caption, and their position says so exactly, where
          // matching a model's list of captions to our panels by index only
          // works when it happened to count them the same way.
          captions: rects.map(
            (r, ri) =>
              captionFor(
                r,
                bodyRuns[i],
                rects.filter((_, other) => other !== ri)
              ) ?? ""
          ),
        };
      });

      setNote("Reading it...");
      const text = pages
        .map((p) => (p.text ? `--- page ${p.page} ---\n${p.text}` : ""))
        .filter(Boolean)
        .join("\n\n");

      // A text layer is exact and costs nothing to send. Only a scan needs the
      // pages rendered and shipped as images.
      const res = text.length > 40
        ? await readProductionDoc({ text })
        : await readProductionDoc({
            pages: await Promise.all(
              pages.slice(0, 8).map(async (p) => ({
                base64: await pageForReading(p.canvas),
                mediaType: "image/jpeg",
                fileName: `page-${p.page}.jpg`,
              }))
            ),
          });

      if ("error" in res) {
        toast(res.error, "error");
        // Still useful: the panels were found locally, so a board can be
        // imported even with no AI key or an unreadable text layer.
        setDraft(null);
        setPlans(found);
        setStage("confirm");
        return;
      }

      // The model's captions are the FALLBACK now, used only where the page
      // printed nothing under a panel: on a board whose captions live in the
      // artwork rather than in the text layer, it is the only thing that can
      // read them.
      const withCaptions = found.map((plan) => {
        const said = res.draft.pages.find((p) => p.page === plan.page.page);
        let rects = plan.rects;
        let captions = plan.captions;
        // The model saw a regular grid where the detector was unsure: use it.
        if (!plan.auto && said?.cols && said?.rows) {
          rects = withPictures(
            sliceGrid(plan.page.width, plan.page.height, said.cols, said.rows),
            plan.page.images
          );
          captions = rects.map(
            (r, ri) =>
              captionFor(
                r,
                plan.runs,
                rects.filter((_, other) => other !== ri)
              ) ?? ""
          );
        }
        return {
          ...plan,
          rects,
          captions: rects.map(
            (_, ri) => captions[ri] || said?.captions?.[ri] || ""
          ),
        };
      });

      setDraft(res.draft);
      setPlans(withCaptions);
      setTakeShots(res.draft.shots.length > 0);
      setTakeBoards(withCaptions.some((p) => p.rects.length > 0));
      setStage("confirm");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "That file could not be opened.",
        "error"
      );
      setStage("pick");
    }
  }

  function reslice(index: number, cols: number, rows: number) {
    setPlans((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const rects = sliceGrid(p.page.width, p.page.height, cols, rows);
        return {
          ...p,
          auto: false,
          rects,
          // Captions follow the new cut, since they belong to whatever panel is
          // above them and the panels have just moved.
          captions: rects.map(
            (r, ri) =>
              captionFor(
                r,
                p.runs,
                rects.filter((_, other) => other !== ri)
              ) ?? ""
          ),
        };
      })
    );
  }

  const shots: ShotDocRow[] = draft?.shots ?? [];
  const chosenShots = shots.filter((_, i) => !skipRows.has(i));
  const panelCount = plans.reduce(
    (n, p, pi) => n + p.rects.filter((_, ri) => !skipPanels.has(`${pi}:${ri}`)).length,
    0
  );

  /**
   * Every panel on the page, flat, with what is needed to match it to a shot
   * row: the page it came from, its reading order there, and the number its
   * caption printed.
   */
  const panels = useMemo(
    () =>
      plans.flatMap((plan, pi) =>
        plan.rects.map((rect, ri) => ({
          pi,
          ri,
          rect,
          page: plan.page.page,
          index: ri,
          code: splitCaption(plan.captions[ri]?.trim() || null).code,
        }))
      ),
    [plans]
  );

  /**
   * Which panel goes with which shot row.
   *
   * Computed over ALL rows and ALL panels rather than the kept ones, so ticking
   * a row on and off does not shuffle every other row's picture underneath the
   * producer while they are reading the list. A pairing whose panel is later
   * unticked simply drops its image at save time.
   */
  const pairing = useMemo(
    () => matchShotsToPanels(shots, panels),
    [shots, panels]
  );
  const matchedCount = pairing.filter((p) => p !== null).length;

  async function save() {
    if (!file) return;
    setStage("saving");
    try {
      // A panel is cropped and uploaded once, whichever half of the import
      // wants it. Before this, the shot rows arrived with no picture even
      // though the matching frame had just been cut off the same page, which
      // is the thing the operator noticed: the two halves of one import were
      // not speaking to each other.
      const wantsPanel = (i: number) => {
        const p = panels[i];
        if (skipPanels.has(`${p.pi}:${p.ri}`)) return false;
        if (takeBoards) return true;
        // No storyboard wanted, so a panel earns its upload only by being on a
        // shot row that is actually being imported.
        return (
          takeShots &&
          pairing.some((m, si) => m === i && !skipRows.has(si))
        );
      };
      const wanted = panels.map((_, i) => wantsPanel(i));
      const total = wanted.filter(Boolean).length;
      const uploads = new Map<
        number,
        { storagePath: string; mimeType: string | null; name: string }
      >();

      if (total > 0) {
        setNote("Uploading panels...");
        let done = 0;
        for (let i = 0; i < panels.length; i++) {
          if (!wanted[i]) continue;
          const p = panels[i];
          const blob = await cropToBlob(plans[p.pi].page.canvas, p.rect);
          const name = `${file.name.replace(/\.pdf$/i, "")}-p${p.page}-${p.ri + 1}.jpg`;
          const asFile = new File([blob], name, { type: "image/jpeg" });
          const up = await uploadAssetFile({ studioId, projectId, file: asFile });
          uploads.set(i, {
            storagePath: up.storagePath,
            mimeType: up.mimeType || "image/jpeg",
            name,
          });
          done++;
          setNote(`Uploading panel ${done} of ${total}...`);
        }
      }

      let boards = 0;
      if (takeBoards && panelCount > 0) {
        const frames: {
          storagePath: string;
          mimeType: string | null;
          scene: string | null;
          caption: string | null;
          sound: string | null;
          notes: string | null;
        }[] = [];
        const chosenRects: Rect[] = [];
        panels.forEach((p, i) => {
          const up = uploads.get(i);
          if (!up) return;
          chosenRects.push(p.rect);
          // A board's caption is several fields, not one: a shot number, a
          // scene, what is said over it and what the camera does.
          const { scene, description, sound, notes } = splitCaption(
            plans[p.pi].captions[p.ri]?.trim() || null
          );
          frames.push({
            storagePath: up.storagePath,
            mimeType: up.mimeType,
            scene,
            caption: description,
            sound,
            notes,
          });
        });
        const res = await importStoryboard(
          projectId,
          draft?.title || file.name.replace(/\.pdf$/i, ""),
          frames,
          // Measured from the panels the producer actually kept, not from every
          // one detected: a panel they unticked has no say in the shape of the
          // board. The grid is then sized to the artwork instead of cropping it
          // into a landscape box.
          detectFrameAspect(chosenRects)
        );
        if ("error" in res) {
          toast(res.error, "error");
          setStage("confirm");
          return;
        }
        boards = frames.length;
      }

      let rows = 0;
      if (takeShots && chosenShots.length) {
        setNote("Building the shot list...");
        const withImages: ImportShotRow[] = shots
          .map((row, si) => {
            const m = pairing[si];
            return {
              ...row,
              // Only when the panel survived the confirm step too: a picture
              // the producer unticked must not come back in through the side
              // door of the shot list.
              image: m === null ? null : uploads.get(m) ?? null,
            };
          })
          .filter((_, si) => !skipRows.has(si));
        const res = await importShotList(
          projectId,
          draft?.title || file.name.replace(/\.pdf$/i, ""),
          withImages
        );
        if ("error" in res) {
          toast(res.error, "error");
          setStage("confirm");
          return;
        }
        rows = chosenShots.length;
      }

      // The source always gets filed, so the original is never consumed by the
      // import.
      setNote("Filing the original...");
      try {
        const up = await uploadAssetFile({ studioId, projectId, file });
        await fileSourceDocument(projectId, {
          storagePath: up.storagePath,
          mimeType: up.mimeType || "application/pdf",
          name: file.name,
        });
      } catch {
        // Filing is a courtesy; losing it must not lose the import.
      }

      const parts = [
        boards ? `${boards} frame${boards === 1 ? "" : "s"}` : "",
        rows ? `${rows} shot${rows === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      toast(parts.length ? `Imported ${parts.join(" and ")}.` : "Filed the document.", "success");
      close();
      onDone?.();
      router.refresh();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "The import did not finish.",
        "error"
      );
      setStage("confirm");
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      id="import-doc"
      title="Import from a document"
    >
      {stage === "pick" && (
        <div>
          <p className="mb-3 text-[13px] text-text-muted">
            A director&apos;s storyboard, a shot list, or one PDF holding both.
            Nothing is created until you have looked at what was found.
          </p>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-border bg-surface-2 p-8 text-center transition hover:border-accent"
          >
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-full border border-border-strong text-lg text-text-faint">
              +
            </span>
            <span className="font-display text-sm font-bold text-text-muted">
              Drop a PDF, or click to choose
            </span>
            <span className="mt-1 text-[11.5px] text-text-faint">
              Up to {MAX_PAGES} pages
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {(stage === "reading" || stage === "saving") && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
          <p className="text-[13px] text-text-muted">{note}</p>
        </div>
      )}

      {stage === "confirm" && (
        <div className="space-y-5">
          <div className="rounded-[12px] border border-border bg-surface-2 p-3 text-[13px]">
            <p className="font-semibold text-text">
              Read {file?.name}
            </p>
            <ul className="mt-1.5 grid gap-1 text-text-muted">
              {plans.some((p) => p.rects.length > 0) && (
                <li>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={takeBoards}
                      onChange={(e) => setTakeBoards(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>
                      <strong className="font-semibold text-text">
                        {panelCount} storyboard frame{panelCount === 1 ? "" : "s"}
                      </strong>{" "}
                      across {plans.filter((p) => p.rects.length).length} page
                      {plans.filter((p) => p.rects.length).length === 1 ? "" : "s"}
                      {/* Naming what they become answers the question the grid
                          below raises: it is one new storyboard, not a pile of
                          crops. */}
                      , as one storyboard
                    </span>
                  </label>
                </li>
              )}
              {shots.length > 0 && (
                <li>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={takeShots}
                      onChange={(e) => setTakeShots(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>
                      <strong className="font-semibold text-text">
                        {chosenShots.length} shot row
                        {chosenShots.length === 1 ? "" : "s"}
                      </strong>{" "}
                      with size, movement and description
                      {/* Said out loud, because a producer who cannot see it
                          has to import first to find out whether the frames
                          came across. */}
                      {matchedCount > 0
                        ? `, ${matchedCount} matched to a frame`
                        : plans.some((p) => p.rects.length)
                          ? ", none could be matched to a frame"
                          : ""}
                    </span>
                  </label>
                </li>
              )}
              {!plans.some((p) => p.rects.length) && !shots.length && (
                <li className="text-amber">
                  No panels or shot rows found. The original will still be filed
                  in Documents.
                </li>
              )}
            </ul>
          </div>

          {takeBoards &&
            plans.map((plan, pi) =>
              plan.rects.length === 0 ? null : (
                <div key={plan.page.page}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                      Page {plan.page.page}
                    </span>
                    <span className="text-[11.5px] text-text-faint">
                      {/* Say where these came from in words a producer can
                          act on. "detected" told them nothing about whether
                          to trust it. */}
                      {plan.auto
                        ? `${plan.rects.length} frame${plan.rects.length === 1 ? "" : "s"} read from the file`
                        : `${plan.rects.length} cut by grid`}
                    </span>
                    {/* The escape hatch. Detection never has to be perfect, it
                        has to be one click to correct. */}
                    <span className="ml-auto flex items-center gap-1 text-[11.5px] text-text-faint">
                      Not right?
                      {[
                        [2, 2],
                        [3, 2],
                        [3, 3],
                        [1, 1],
                      ].map(([c, r]) => (
                        <button
                          key={`${c}x${r}`}
                          onClick={() => reslice(pi, c, r)}
                          className="rounded-[7px] border border-border px-1.5 py-0.5 font-semibold transition hover:border-accent hover:text-accent"
                        >
                          {c}&times;{r}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {plan.rects.map((rect, ri) => {
                      const key = `${pi}:${ri}`;
                      const off = skipPanels.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setSkipPanels((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          title={off ? "Include this panel" : "Leave this one out"}
                          className={`overflow-hidden rounded-[10px] border text-left transition ${
                            off
                              ? "border-border opacity-35"
                              : "border-border-strong hover:border-accent"
                          }`}
                        >
                          <PanelThumb page={plan.page} rect={rect} />
                          <span className="block px-2 py-1.5">
                            <PanelLabel
                              caption={plan.captions[ri] ?? ""}
                              index={ri}
                              off={off}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

          {takeShots && shots.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Shot rows
              </p>
              <div className="max-h-72 overflow-y-auto rounded-[12px] border border-border">
                <table className="w-full border-collapse text-[12.5px]">
                  <tbody>
                    {shots.map((r, i) => {
                      const off = skipRows.has(i);
                      const m = pairing[i];
                      const panel = m === null ? null : panels[m];
                      return (
                        <tr key={i} className={off ? "opacity-40" : ""}>
                          <td className="border-b border-border px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={!off}
                              onChange={() =>
                                setSkipRows((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                          </td>
                          {/* The frame this row will carry. A blank cell is
                              the honest answer where nothing matched, rather
                              than the row quietly arriving without one. */}
                          <td className="border-b border-border px-2 py-1.5">
                            {panel ? (
                              <span className="block w-14">
                                <PanelThumb
                                  page={plans[panel.pi].page}
                                  rect={panel.rect}
                                />
                              </span>
                            ) : (
                              <span className="block w-14 text-center text-[10.5px] text-text-faint">
                                no frame
                              </span>
                            )}
                          </td>
                          <td className="border-b border-border px-2 py-1.5 font-mono text-[11.5px] text-text-muted">
                            {r.code || "-"}
                          </td>
                          <td className="border-b border-border px-2 py-1.5">
                            {r.description || ""}
                          </td>
                          <td className="border-b border-border px-2 py-1.5 text-text-muted">
                            {r.size || ""}
                          </td>
                          <td className="border-b border-border px-2 py-1.5 text-text-muted">
                            {r.movement || ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button onClick={() => void save()}>
              Import
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <span className="ml-auto text-[11.5px] text-text-faint">
              The original PDF is filed in Documents either way.
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** A crop drawn straight from the rendered page: no upload to preview it. */
/**
 * What this panel will become once imported.
 *
 * The confirm step used to show a crop and the word "Panel 3", which answers
 * nothing: the producer could see a picture but not what would be saved with
 * it. Showing the frame's own number and the first line of its description
 * makes the grid checkable at a glance, which is the only reason it exists.
 */
function PanelLabel({
  caption,
  index,
  off,
}: {
  caption: string;
  index: number;
  off: boolean;
}) {
  const { scene, description, sound } = useMemo(
    () => splitCaption(caption.trim() || null),
    [caption]
  );
  const line = description || sound;

  return (
    <>
      <span className="flex items-center gap-1.5">
        <span
          className={`text-[11.5px] font-bold ${off ? "text-text-faint" : "text-text"}`}
        >
          {scene || `Frame ${index + 1}`}
        </span>
        {off && (
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">
            skipped
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-text-muted line-clamp-2">
        {line || "No text found beside this frame"}
      </span>
    </>
  );
}

function PanelThumb({ page, rect }: { page: PdfPage; rect: Rect }) {
  // useMemo, not state-during-render: this is a pure function of its props, and
  // setting state in a render body is how you get React's loop guard.
  const src = useMemo(() => {
    const out = document.createElement("canvas");
    const scale = Math.min(1, 320 / rect.w);
    out.width = Math.max(1, Math.round(rect.w * scale));
    out.height = Math.max(1, Math.round(rect.h * scale));
    const ctx = out.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(page.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.7);
  }, [page, rect]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="block aspect-[4/3] w-full bg-surface-2 object-contain"
    />
  );
}
