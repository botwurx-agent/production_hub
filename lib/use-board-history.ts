"use client";

import { useCallback, useRef, useState } from "react";
import type { BoardItemView, BoardConnection } from "@/app/(app)/boards/actions";

export type BoardSnapshot = {
  items: BoardItemView[];
  connections: BoardConnection[];
};

const CAP = 60; // most recent N steps kept

function clone(s: BoardSnapshot): BoardSnapshot {
  return {
    items: s.items.map((i) => ({ ...i })),
    connections: s.connections.map((c) => ({ ...c })),
  };
}

// Undo/redo history for the board canvas. Snapshot-based: capture() records the
// state *before* an edit; undo()/redo() hand back the state to apply (the caller
// sets local state + persists via restoreBoardState). Refs hold the stacks so
// captures never trigger a re-render; two booleans drive the toolbar buttons.
export function useBoardHistory() {
  const undoStack = useRef<BoardSnapshot[]>([]);
  const redoStack = useRef<BoardSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  // Record the pre-edit state. Call right before a mutation runs.
  const capture = useCallback(
    (snap: BoardSnapshot) => {
      undoStack.current.push(clone(snap));
      if (undoStack.current.length > CAP) undoStack.current.shift();
      redoStack.current = [];
      sync();
    },
    [sync]
  );

  const undo = useCallback(
    (current: BoardSnapshot): BoardSnapshot | null => {
      const prev = undoStack.current.pop();
      if (!prev) return null;
      redoStack.current.push(clone(current));
      sync();
      return prev;
    },
    [sync]
  );

  const redo = useCallback(
    (current: BoardSnapshot): BoardSnapshot | null => {
      const next = redoStack.current.pop();
      if (!next) return null;
      undoStack.current.push(clone(current));
      sync();
      return next;
    },
    [sync]
  );

  // Clear history (on board switch, where cross-board undo makes no sense).
  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    sync();
  }, [sync]);

  return { capture, undo, redo, reset, canUndo, canRedo };
}
