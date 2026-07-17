"use client";

import { useCallback, useRef, useState } from "react";

// Generic snapshot-based undo/redo. Used by editors whose state is server-render
// props (shot list, storyboard): the snapshot T is captured before a mutation
// and re-applied by the caller (which persists it via a restore action + a
// router.refresh()). Props are replaced on refresh, never mutated in place, so
// storing the reference is safe (no deep clone needed).
const CAP = 60;

export function useHistory<T>() {
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const capture = useCallback(
    (snap: T) => {
      undoStack.current.push(snap);
      if (undoStack.current.length > CAP) undoStack.current.shift();
      redoStack.current = [];
      sync();
    },
    [sync]
  );

  const undo = useCallback(
    (current: T): T | null => {
      if (undoStack.current.length === 0) return null;
      const prev = undoStack.current.pop() as T;
      redoStack.current.push(current);
      sync();
      return prev;
    },
    [sync]
  );

  const redo = useCallback(
    (current: T): T | null => {
      if (redoStack.current.length === 0) return null;
      const next = redoStack.current.pop() as T;
      undoStack.current.push(current);
      sync();
      return next;
    },
    [sync]
  );

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    sync();
  }, [sync]);

  return { capture, undo, redo, reset, canUndo, canRedo };
}
