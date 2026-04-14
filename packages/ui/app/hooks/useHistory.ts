import { useRef, useState, useCallback } from "react";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryApi<T> {
  state: T;
  commit: (next: T) => void;
  replace: (next: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
}

function snapshotEquals<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Pure reducers — exported for unit testing.
export function makeHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [] };
}

export function commitState<T>(h: HistoryState<T>, next: T, cap: number): HistoryState<T> {
  if (snapshotEquals(next, h.present)) return h;
  const past = [...h.past, h.present];
  while (past.length > cap) past.shift();
  return { past, present: next, future: [] };
}

export function undoState<T>(h: HistoryState<T>): HistoryState<T> | null {
  if (h.past.length === 0) return null;
  const past = h.past.slice(0, -1);
  const prev = h.past[h.past.length - 1]!;
  return { past, present: prev, future: [...h.future, h.present] };
}

export function redoState<T>(h: HistoryState<T>): HistoryState<T> | null {
  if (h.future.length === 0) return null;
  const future = h.future.slice(0, -1);
  const next = h.future[h.future.length - 1]!;
  return { past: [...h.past, h.present], present: next, future };
}

export function useHistory<T>(initial: T, cap = 25): HistoryApi<T> {
  const [history, setHistory] = useState<HistoryState<T>>(() => makeHistory(initial));
  const historyRef = useRef(history);
  historyRef.current = history;

  const commit = useCallback((next: T) => {
    setHistory(h => commitState(h, next, cap));
  }, [cap]);

  const replace = useCallback((next: T) => {
    setHistory(h => ({ ...h, present: next }));
  }, []);

  const undo = useCallback((): T | null => {
    const next = undoState(historyRef.current);
    if (!next) return null;
    setHistory(next);
    return next.present;
  }, []);

  const redo = useCallback((): T | null => {
    const next = redoState(historyRef.current);
    if (!next) return null;
    setHistory(next);
    return next.present;
  }, []);

  return {
    state: history.present,
    commit,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
