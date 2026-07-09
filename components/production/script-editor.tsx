"use client";

import { useEffect, useRef } from "react";
import { saveScript } from "@/app/(app)/projects/[id]/pipeline-actions";

// Lightweight rich-text editor for the project script. Uses a contentEditable
// surface + document.execCommand for formatting (bold/italic/underline/size/
// font/lists) and stores the resulting HTML in ai_scripts.content. Pragmatic
// and dependency-free; the script is studio-internal content.

const btn =
  "rounded-[7px] px-2 py-1 text-[13px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text";

export function ScriptEditor({
  projectId,
  initial,
}: {
  projectId: string;
  initial: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the editor once on mount (uncontrolled, to avoid caret jumps).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="rte min-h-[200px] px-3 py-2.5 text-sm leading-relaxed text-text outline-none"
      />
    </div>
  );
}
