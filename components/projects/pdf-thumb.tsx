"use client";

import { useEffect, useRef, useState } from "react";
import { savePdfPoster } from "@/app/(app)/projects/[id]/poster-actions";

/**
 * Page one of a PDF, drawn as a picture.
 *
 * Every grid in the app showed a PDF as a grey document icon, so a folder of
 * storyboards, treatments, permits and delivery specs looked like one repeated
 * tile and the only way to tell them apart was to open each in turn. A
 * storyboard is a picture; it should look like one in the folder.
 *
 * There is no server-side rasterizer here and adding one means a native
 * dependency loaded on every cold start, for a thumbnail. So the page is drawn
 * in the browser with the pdf.js that is already loaded for the importer and
 * the review canvas, and then POSTED BACK and stored. That is the part that
 * matters: it happens once per version, ever. The next viewer, and every viewer
 * after them, is served a 40KB jpeg by the same path an image thumbnail takes,
 * and never downloads the document at all.
 *
 * Three rules keep the one-off cost small:
 * - nothing renders until the tile is actually on screen
 * - one document is rendered at a time across the whole page, so ten PDFs in a
 *   grid do not become ten simultaneous downloads
 * - a file that fails is not tried again in this session
 */

/**
 * One at a time, page-wide.
 *
 * A grid mounts every tile at once, and each render pulls a whole document, so
 * without this a folder of ten boards would open ten large downloads in
 * parallel and all of them would be slow. Serialised, the first tile is sharp
 * almost immediately and the rest follow.
 */
let chain: Promise<unknown> = Promise.resolve();
function queued<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  // Keep the chain alive after a failure, or one bad file stops every tile
  // behind it.
  chain = run.catch(() => undefined);
  return run;
}

/** A file that could not be rendered is not worth attempting on every scroll. */
const failed = new Set<string>();

type PdfDoc = {
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: {
      canvasContext: CanvasRenderingContext2D;
      viewport: unknown;
    }) => { promise: Promise<void> };
  }>;
};

/** Wide enough for a retina card, small enough to be free to fetch. */
const POSTER_WIDTH = 640;

export function PdfThumb({
  fileUrl,
  posterUrl,
  projectId,
  versionId,
  className = "h-full w-full object-cover",
  boxClassName = "flex h-full w-full items-center justify-center overflow-hidden",
  fallback,
}: {
  /** Signed URL of the PDF itself. Null means there is nothing to render. */
  fileUrl: string | null;
  /** The stored poster, when one exists. Then nothing here does any work. */
  posterUrl: string | null;
  projectId: string;
  versionId: string;
  className?: string;
  /**
   * The observed box. It must generate a real rect (never `display: contents`),
   * because an element with no box never reports as on screen and the render
   * would wait forever.
   */
  boxClassName?: string;
  /** Drawn while there is no picture yet, and if rendering fails. */
  fallback: React.ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(posterUrl);
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setSrc(posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    if (posterUrl || !fileUrl || failed.has(fileUrl)) return;
    const box = boxRef.current;
    if (!box) return;

    let alive = true;
    let objectUrl: string | null = null;

    async function render() {
      if (!fileUrl || failed.has(fileUrl)) return;
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = (await lib.getDocument({ url: fileUrl })
          .promise) as unknown as PdfDoc;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, POSTER_WIDTH / base.width),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        // A PDF page is transparent where it is white, and a transparent
        // thumbnail over a tinted tile reads as a smear.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", 0.82)
        );
        if (!blob) throw new Error("no blob");

        // Shown from memory straight away. Storing it is for everyone after
        // this, so it must never be what the viewer waits on.
        if (alive) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }

        const form = new FormData();
        form.set("poster", new File([blob], "page-1.jpg", { type: "image/jpeg" }));
        await savePdfPoster(projectId, versionId, form);
      } catch {
        if (fileUrl) failed.add(fileUrl);
      }
    }

    // Nothing happens for a tile nobody has scrolled to.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void queued(render);
      },
      { rootMargin: "300px" }
    );
    io.observe(box);

    return () => {
      alive = false;
      io.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, posterUrl, projectId, versionId]);

  return (
    <span ref={boxRef} className={boxClassName}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className={className} />
      ) : (
        fallback
      )}
    </span>
  );
}
