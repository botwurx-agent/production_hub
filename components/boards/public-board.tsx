"use client";

import { useState } from "react";
import { BoardCanvas } from "@/components/boards/board-canvas";
import type { BoardItemView, BoardConnection } from "@/app/(app)/boards/actions";

// Read-only public render of a shared board (the /b/[token] page). Reuses the
// full BoardCanvas in readOnly mode so it looks exactly like the editor, minus
// all editing.
export function PublicBoard({
  boardId,
  boardName,
  studioName,
  background,
  items: initialItems,
  connections,
}: {
  boardId: string;
  boardName: string;
  studioName: string;
  background: string;
  items: BoardItemView[];
  connections: BoardConnection[];
}) {
  // BoardCanvas needs a setItems; in read-only nothing mutates it, but local
  // state keeps the type happy and lets media state (if any) settle.
  const [items, setItems] = useState<BoardItemView[]>(initialItems);

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            {studioName}
          </p>
          <h1 className="truncate font-display text-base font-extrabold tracking-tight text-text">
            {boardName}
          </h1>
        </div>
        <span className="shrink-0 rounded-pill border border-border px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          Shared board · view only
        </span>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <BoardCanvas
          boardId={boardId}
          items={items}
          setItems={setItems}
          connections={connections}
          background={background}
          onDropFiles={() => {}}
          onDropTool={() => {}}
          onReload={() => {}}
          selected={null}
          onSelect={() => {}}
          selectedLineId={null}
          onSelectLine={() => {}}
          hint={null}
          onDismissHint={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}
