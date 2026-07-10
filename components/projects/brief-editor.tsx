"use client";

import { useEffect, useRef, useState } from "react";
import { saveBrief } from "@/app/(app)/projects/[id]/actions";

// Light rich-text editor for the brief: a small formatting bar (bold/italic/
// underline, lists, link) over a contentEditable surface storing HTML in
// briefs.content. Pasted URLs are auto-linked and open in a new tab on click.

const btn =
  "rounded-[7px] px-2 py-1 text-[13px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text";

const URL_SPLIT = /(https?:\/\/[^\s<]+)/g;
const URL_TEST = /^https?:\/\/[^\s<]+$/;

// Wrap bare URL text (not already inside a link) in anchors, in place.
function linkify(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (t.parentElement?.closest("a")) continue;
    if (t.nodeValue && URL_SPLIT.test(t.nodeValue)) targets.push(t);
    URL_SPLIT.lastIndex = 0;
  }
  for (const t of targets) {
    const parts = (t.nodeValue || "").split(URL_SPLIT);
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (!p) continue;
      if (URL_TEST.test(p)) {
        const a = document.createElement("a");
        a.href = p;
        a.textContent = p;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(p));
      }
    }
    t.replaceWith(frag);
  }
}

export function BriefEditor({
  projectId,
  initialContent,
}: {
  projectId: string;
  initialContent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  // Seed once on mount (uncontrolled, to avoid caret jumps). Existing briefs may
  // be plain text; assigning to innerHTML renders them fine either way.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialContent || "";
      linkify(ref.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, value?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
  }
  const hold = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  function addLink() {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    exec("createLink", href);
  }

  function save() {
    const el = ref.current;
    if (!el) return;
    linkify(el);
    void saveBrief(projectId, el.innerHTML);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Paste as plain text (no foreign formatting), then auto-link any URLs.
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    if (ref.current) linkify(ref.current);
  }

  // Follow links on click (contentEditable would otherwise just place the caret).
  function onClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (a && a.getAttribute("href")) {
      e.preventDefault();
      window.open(a.getAttribute("href")!, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
        <button className={btn} style={{ fontWeight: 800 }} title="Bold" onMouseDown={hold(() => exec("bold"))}>B</button>
        <button className={`${btn} italic`} title="Italic" onMouseDown={hold(() => exec("italic"))}>I</button>
        <button className={`${btn} underline`} title="Underline" onMouseDown={hold(() => exec("underline"))}>U</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button className={btn} title="Heading" onMouseDown={hold(() => exec("formatBlock", "H2"))}>Heading</button>
        <button className={btn} title="Normal text" onMouseDown={hold(() => exec("formatBlock", "P"))}>Body</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button className={btn} title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))}>• List</button>
        <button className={btn} title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))}>1. List</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button className={btn} title="Add link" onMouseDown={hold(addLink)}>🔗 Link</button>
        <button className={btn} title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))}>Clear</button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={save}
        onPaste={onPaste}
        onClick={onClick}
        data-placeholder="Paste or write the creative direction: the ask, references, deliverables, must-haves. Links become clickable."
        className="rte min-h-[180px] px-3 py-2.5 text-sm leading-relaxed text-text outline-none"
      />

      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        <span className="text-xs text-text-faint">
          {saved ? "Saved" : "Saves when you click away"}
        </span>
      </div>
    </div>
  );
}
