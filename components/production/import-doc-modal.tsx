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
import { captionFor, splitCaption } from "@/lib/captions";
import { uploadAssetFile } from "@/components/projects/upload-file";
import {
  fileSourceDocument,
  importShotList,
  importStoryboard,
  readProductionDoc,
} from "@/app/(app)/projects/[id]/import-actions";
import type { ShotDocDraft, ShotDocRow } from "@/lib/shot-doc";

type PagePlan = {
  page: PdfPage;
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
      const found: PagePlan[] = pages.map((p, i) => {
        const rects = byImage[i].length
          ? byImage[i]
          : (() => {
              const grid = findPanels(toGray(p.canvas));
              return grid.confident ? readingOrder(grid.rects) : [];
            })();
        return {
          page: p,
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
                p.runs,
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
          rects = sliceGrid(plan.page.width, plan.page.height, said.cols, said.rows);
          captions = rects.map(
            (r, ri) =>
              captionFor(
                r,
                plan.page.runs,
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
                p.page.runs,
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

  async function save() {
    if (!file) return;
    setStage("saving");
    try {
      let boards = 0;
      if (takeBoards && panelCount > 0) {
        setNote("Uploading panels...");
        const frames: {
          storagePath: string;
          mimeType: string | null;
          scene: string | null;
          caption: string | null;
          sound: string | null;
        }[] = [];
        let done = 0;
        for (let pi = 0; pi < plans.length; pi++) {
          const plan = plans[pi];
          for (let ri = 0; ri < plan.rects.length; ri++) {
            if (skipPanels.has(`${pi}:${ri}`)) continue;
            const blob = await cropToBlob(plan.page.canvas, plan.rects[ri]);
            const asFile = new File(
              [blob],
              `${file.name.replace(/\.pdf$/i, "")}-p${plan.page.page}-${ri + 1}.jpg`,
              { type: "image/jpeg" }
            );
            const up = await uploadAssetFile({ studioId, projectId, file: asFile });
            // A board's caption is several fields, not one: a shot number, a
            // scene, what is said over it and what the camera does.
            const { scene, description, sound } = splitCaption(
              plan.captions[ri]?.trim() || null
            );
            frames.push({
              storagePath: up.storagePath,
              mimeType: up.mimeType || "image/jpeg",
              scene,
              caption: description,
              sound,
            });
            done++;
            setNote(`Uploading panel ${done} of ${panelCount}...`);
          }
        }
        const res = await importStoryboard(
          projectId,
          draft?.title || file.name.replace(/\.pdf$/i, ""),
          frames
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
        const res = await importShotList(
          projectId,
          draft?.title || file.name.replace(/\.pdf$/i, ""),
          chosenShots
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
                        {panelCount} storyboard panel{panelCount === 1 ? "" : "s"}
                      </strong>{" "}
                      across {plans.filter((p) => p.rects.length).length} page
                      {plans.filter((p) => p.rects.length).length === 1 ? "" : "s"}
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
                      {plan.auto ? "detected" : "set by grid"} &middot;{" "}
                      {plan.rects.length} panels
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
                          <span className="block px-2 py-1 text-[11px] text-text-muted">
                            {plan.captions[ri]?.trim() || `Panel ${ri + 1}`}
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
