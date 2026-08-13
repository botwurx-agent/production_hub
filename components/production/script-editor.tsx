"use client";

import { useEffect, useRef, useState } from "react";
import { saveScript } from "@/app/(app)/projects/[id]/pipeline-actions";

// Lightweight rich-text editor for the project script. Uses a contentEditable
// surface + document.execCommand for formatting (bold/italic/underline/size/
// font/lists) and stores the resulting HTML in ai_scripts.content. Pragmatic
// and dependency-free; the script is studio-internal content.
//
// HEIGHT IS CAPPED, and this is the point of the component rather than a
// detail. The surface used to have a floor and no ceiling, so a real script
// pushed the sequence, the shots and everything else below the fold: the page
// became a scroll to reach the work.
//
// Capped rather than moved into a window, because the script is READ WHILE the
// sequence is built. You take a beat and make it a shot, so putting it behind
// a modal would fight the job it is there for.
//
// Generous rather than small, and draggable. A nested scroller inside a page
// that also scrolls is only annoying when the box is too short to read in, so
// the default shows a good stretch of script and the operator can set their
// own height, which sticks.

const btn =
  "rounded-[7px] px-2 py-1 text-[13px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text";

/** Roughly twenty lines: enough to read several beats without hunting. */
const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 160;
const HEIGHT_KEY = "pipeline.script.height";

export function ScriptEditor({
  projectId,
  initial,
}: {
  projectId: string;
  initial: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // Seed the editor once on mount (uncontrolled, to avoid caret jumps).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the height this browser was left at. A per-person view preference
  // about one box, so localStorage rather than a column on the row.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HEIGHT_KEY);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= MIN_HEIGHT) setHeight(n);
    } catch {}
  }, []);

  // The drag handle is the browser's own (CSS resize), so the height change
  // arrives as a resize rather than as an event we raised.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const obs = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          window.localStorage.setItem(HEIGHT_KEY, String(el.offsetHeight));
        } catch {}
      }, 400);
    });
    obs.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      obs.disconnect();
    };
  }, []);

  function exec(cmd: string, value?: string) {
    ref.current?.focus();
    // execCommand is deprecated but universally supported for basic formatting.
    document.execCommand(cmd, false, value);
  }
  function save() {
    if (ref.current) void saveScript(projectId, ref.current.innerHTML);
  }

  // Keep the selection when a toolbar control is pressed.
  const hold = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
        <button className={btn} style={{ fontWeight: 800 }} title="Bold" onMouseDown={hold(() => exec("bold"))}>B</button>
        <button className={`${btn} italic`} title="Italic" onMouseDown={hold(() => exec("italic"))}>I</button>
        <button className={`${btn} underline`} title="Underline" onMouseDown={hold(() => exec("underline"))}>U</button>

        <span className="mx-1 h-4 w-px bg-border" />

        <button className={btn} title="Title" onMouseDown={hold(() => exec("formatBlock", "H1"))}>Title</button>
        <button className={btn} title="Heading" onMouseDown={hold(() => exec("formatBlock", "H2"))}>Heading</button>
        <button className={btn} title="Normal text" onMouseDown={hold(() => exec("formatBlock", "P"))}>Body</button>

        <span className="mx-1 h-4 w-px bg-border" />

        <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">Size</span>
        <button className={btn} style={{ fontSize: 11 }} title="Small" onMouseDown={hold(() => exec("fontSize", "2"))}>A</button>
        <button className={btn} style={{ fontSize: 14 }} title="Normal" onMouseDown={hold(() => exec("fontSize", "3"))}>A</button>
        <button className={btn} style={{ fontSize: 18 }} title="Large" onMouseDown={hold(() => exec("fontSize", "5"))}>A</button>

        <span className="mx-1 h-4 w-px bg-border" />

        <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">Font</span>
        <button className={btn} style={{ fontFamily: "system-ui, sans-serif" }} title="Sans" onMouseDown={hold(() => exec("fontName", "system-ui, sans-serif"))}>Sans</button>
        <button className={btn} style={{ fontFamily: "Georgia, serif" }} title="Serif" onMouseDown={hold(() => exec("fontName", "Georgia, serif"))}>Serif</button>
        <button className={btn} style={{ fontFamily: "ui-monospace, monospace" }} title="Mono" onMouseDown={hold(() => exec("fontName", "ui-monospace, SFMono-Regular, monospace"))}>Mono</button>

        <span className="mx-1 h-4 w-px bg-border" />

        <button className={btn} title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))}>• List</button>
        <button className={btn} title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))}>1. List</button>
        <button className={btn} title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))}>Clear</button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={save}
        data-placeholder="Paste or write the script. Break each beat into a shot on the left."
        style={{
          height: height ?? DEFAULT_HEIGHT,
          minHeight: MIN_HEIGHT,
          // The browser's own handle, which costs nothing and behaves the way
          // a resize handle is expected to. `overflow` is what enables it.
          resize: "vertical",
          overflowY: "auto",
        }}
        className="rte px-3 py-2.5 text-sm leading-relaxed text-text outline-none"
      />
      <p className="border-t border-border px-3 py-1 text-[10.5px] text-text-faint">
        Drag the bottom edge to make this taller. The height sticks.
      </p>
    </div>
  );
}
