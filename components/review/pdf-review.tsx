"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PinCanvas } from "@/components/review/pin-canvas";
import type { PortalComment } from "@/lib/review-links";
import type { Drawing } from "@/lib/review-drawing";

/** Only what this file uses, so pdf.js stays a dynamic import. */
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: {
      canvasContext: CanvasRenderingContext2D;
      viewport: unknown;
    }) => {
      promise: Promise<void>;
    };
  }>;
};

/** Rendered width at 100%: wide enough to read a caption, cheap enough to redo. */
const BASE_WIDTH = 1400;

/** Kept small on purpose: a 3x page is a several-megabyte data URL. */
const CACHE_LIMIT = 8;

const ZOOMS = [1, 1.5, 2, 3] as const;

/**
 * Reviewing a PDF, with pins.
 *
 * A PDF used to fall into the portal's "everything else" branch: a preview, a
 * flat list of comments and one text box. No pins, no markup, no replies, no
 * resolve. That was a fair stopping point when a PDF meant an invoice or a
 * spec sheet. It stopped being fair when a director's storyboard started
 * arriving as one, since a board is exactly the thing a client most wants to
 * point at.
 *
 * The reason it was skipped is that a pin is a position within a rendered
 * media box, and a browser's own PDF viewer cannot be measured or drawn over.
 * So the pages are rendered to a CANVAS here, with the same pdf.js the
 * importer already uses, and each page becomes an ordinary pinnable surface.
 * Everything the image path has then comes for free, because it is the same
 * PinCanvas underneath.
 *
 * A PDF is several surfaces, which is the one thing genuinely new: a pin
 * carries the page it was dropped on, and the rail shows only that page's
 * comments so a mark on page four does not appear over page one.
 *
 * Zoom re-renders the page rather than scaling the picture, so getting closer
 * to a board actually resolves its type instead of enlarging the blur.
 */
export function PdfReview({
  fileUrl,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  wide = false,
  onPost,
  onResolve,
}: {
  fileUrl: string;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  wide?: boolean;
  onPost: (
    text: string,
    pin: { x: number; y: number } | null,
    extra?: { drawing?: Drawing | null; page?: number },
  ) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Held across page changes so flicking through a board does not re-download
  // and re-parse the file every time. Keyed by page AND zoom, because zooming
  // re-renders rather than stretching (see below).
  const docRef = useRef<PdfDoc | null>(null);
  const cacheRef = useRef(new Map<string, string>());
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;
    const cache = cacheRef.current;
    (async () => {
      try {
        setLoading(true);
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await lib.getDocument({ url: fileUrl }).promise;
        if (!alive) return;
        docRef.current = doc as unknown as PdfDoc;
        setPageCount(doc.numPages);
        setPage(1);
        setReady((n) => n + 1);
      } catch {
        if (alive) {
          setError("This PDF could not be opened for review.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      cache.clear();
      docRef.current = null;
    };
  }, [fileUrl]);

  // One renderer, for the first page and every page after it.
  useEffect(() => {
    let alive = true;
    const doc = docRef.current;
    if (!doc) return;

    const key = `${page}@${zoom}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setPageUrl(cached);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const pdfPage = await doc.getPage(page);
        const base = pdfPage.getViewport({ scale: 1 });
        // Zoom RE-RENDERS the page rather than stretching the picture. That is
        // the whole point: a board's type and its product labels are the detail
        // a client is trying to read, and scaling up a 1400px raster just gives
        // them bigger blur. Rendering at the zoomed size gives them real pixels.
        const viewport = pdfPage.getViewport({
          scale: Math.min(4, (BASE_WIDTH * zoom) / base.width),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        // A PDF's own background is transparent, and a transparent page over
        // the dark stage renders as an unreadable black sheet.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!alive) return;
        const url = canvas.toDataURL("image/jpeg", 0.86);
        // Oldest out first. A Map keeps insertion order, so the first key is
        // the least recently rendered.
        while (cacheRef.current.size >= CACHE_LIMIT) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest === undefined) break;
          cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(key, url);
        setPageUrl(url);
        setLoading(false);
      } catch {
        if (alive) {
          setError("That page could not be rendered.");
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [page, zoom, ready]);

  /**
   * Only this page's comments reach the rail.
   *
   * A comment with no page is from before this existed, or was left without
   * pinning anything, so it shows on page one rather than disappearing.
   */
  const pageComments = useMemo(
    () => comments.filter((c) => (c.pinPage ?? 1) === page),
    [comments, page],
  );

  const elsewhere = comments.length - pageComments.length;

  if (error) {
    return (
      <div className="rounded-[14px] border border-border bg-surface-2 p-8 text-center">
        <p className="text-sm text-text-muted">{error}</p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
        >
          Open the file instead
        </a>
      </div>
    );
  }

  const zoomControl = (
    <div className="ml-auto flex items-center gap-1.5">
      {loading && pageUrl && (
        <span className="text-[11px] font-semibold text-text-faint">
          Sharpening...
        </span>
      )}
      <div className="flex items-center gap-0.5 rounded-[9px] border border-border p-0.5">
        {ZOOMS.map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`rounded-[6px] px-2 py-1 text-[11px] font-bold transition ${
              z === zoom
                ? "bg-accent text-accent-fg"
                : "text-text-muted hover:text-text"
            }`}
            title={z === 1 ? "Fit the page" : `Zoom to ${z}x`}
          >
            {z === 1 ? "Fit" : `${z}x`}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {pageCount > 1 && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Page
          </span>
        )}
        {pageCount > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Pages">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
              const marks = comments.filter(
                (c) => (c.pinPage ?? 1) === n,
              ).length;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`relative rounded-[8px] px-2.5 py-1 text-xs font-semibold transition ${
                    n === page
                      ? "bg-accent text-accent-fg"
                      : "border border-border text-text-muted hover:text-text"
                  }`}
                >
                  {n}
                  {/* A page carrying comments is worth finding without opening
                      every one of them. */}
                  {marks > 0 && (
                    <span
                      className={`ml-1 text-[10px] font-bold ${
                        n === page ? "text-accent-fg/80" : "text-accent"
                      }`}
                    >
                      {marks}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {elsewhere > 0 && (
          <span className="text-[11.5px] text-text-faint">
            {elsewhere} comment{elsewhere === 1 ? "" : "s"} on other pages
          </span>
        )}
        {zoomControl}
      </div>

      {loading && !pageUrl ? (
        <div className="grid min-h-[50vh] place-items-center rounded-[14px] border border-border bg-surface-2">
          <p className="text-sm text-text-faint">Opening the document...</p>
        </div>
      ) : pageUrl ? (
        <PinCanvas
          key={page}
          comments={pageComments}
          canResolve={canResolve}
          disabled={disabled}
          disabledHint={disabledHint}
          wide={wide}
          emptyHint={
            pageCount > 1
              ? "Click anywhere on the page to drop a pin and start."
              : "Click anywhere on the document to drop a pin and start."
          }
          onPost={(text, pin, extra) =>
            // The page travels with the pin, or every mark would replay on
            // page one.
            onPost(text, pin, { ...extra, page })
          }
          onResolve={onResolve}
          stage={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pageUrl}
              alt={`Page ${page}`}
              className="block w-auto rounded-[10px] object-contain shadow-2xl"
              // Both limits scale together, so the page grows by exactly the
              // factor on the button whichever way round it is. The stage
              // scrolls, and PinCanvas sizes its pin layer to this element, so
              // a pin dropped zoomed in lands where it was clicked.
              style={{
                maxHeight: `${66 * zoom}vh`,
                maxWidth: `${100 * zoom}%`,
              }}
              draggable={false}
            />
          }
        />
      ) : null}
    </div>
  );
}
