import { describe, test, expect } from "bun:test";
import { makeHistory, commitState, undoState, redoState } from "../app/hooks/useHistory";

type Snap = { params: Record<string, number>; activeLook: string | null };

const s = (params: Record<string, number>, activeLook: string | null = null): Snap => ({ params, activeLook });

describe("history reducers", () => {
  test("makeHistory starts with empty past/future", () => {
    const h = makeHistory(s({ a: 1 }));
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(h.present).toEqual(s({ a: 1 }));
  });

  test("commit pushes present to past and clears future", () => {
    let h = makeHistory(s({ a: 1 }));
    h = commitState(h, s({ a: 2 }), 25);
    expect(h.present).toEqual(s({ a: 2 }));
    expect(h.past).toEqual([s({ a: 1 })]);
    expect(h.future).toEqual([]);
  });

  test("commit skips no-op (deep-equal)", () => {
    const h = makeHistory(s({ a: 1 }));
    const same = commitState(h, s({ a: 1 }), 25);
    expect(same).toBe(h);
  });

  test("undo moves present to future", () => {
    let h = makeHistory(s({ a: 1 }));
    h = commitState(h, s({ a: 2 }), 25);
    const undone = undoState(h)!;
    expect(undone.present).toEqual(s({ a: 1 }));
    expect(undone.future).toEqual([s({ a: 2 })]);
    expect(undone.past).toEqual([]);
  });

  test("undo returns null at boundary", () => {
    const h = makeHistory(s({ a: 1 }));
    expect(undoState(h)).toBeNull();
  });

  test("redo restores future entry", () => {
    let h = makeHistory(s({ a: 1 }));
    h = commitState(h, s({ a: 2 }), 25);
    h = undoState(h)!;
    const redone = redoState(h)!;
    expect(redone.present).toEqual(s({ a: 2 }));
    expect(redone.future).toEqual([]);
  });

  test("redo returns null at boundary", () => {
    const h = makeHistory(s({ a: 1 }));
    expect(redoState(h)).toBeNull();
  });

  test("commit after undo clears future (no redo)", () => {
    let h = makeHistory(s({ a: 1 }));
    h = commitState(h, s({ a: 2 }), 25);
    h = undoState(h)!;
    h = commitState(h, s({ a: 5 }), 25);
    expect(h.future).toEqual([]);
    expect(h.present).toEqual(s({ a: 5 }));
  });

  test("cap trims oldest past entries", () => {
    let h = makeHistory(s({ a: 0 }));
    for (let i = 1; i <= 5; i++) h = commitState(h, s({ a: i }), 3);
    // past should have length 3; walking back 3 times lands at a:2
    expect(h.past.length).toBe(3);
    for (let i = 0; i < 3; i++) h = undoState(h)!;
    expect(h.present).toEqual(s({ a: 2 }));
    expect(undoState(h)).toBeNull();
  });

  test("tracks activeLook alongside params", () => {
    let h = makeHistory(s({ a: 1 }, null));
    h = commitState(h, s({ a: 1, b: 2 }, "Kodachrome"), 25);
    h = commitState(h, s({ a: 5, b: 2 }, "Kodachrome"), 25);
    h = undoState(h)!;
    expect(h.present).toEqual(s({ a: 1, b: 2 }, "Kodachrome"));
    h = undoState(h)!;
    expect(h.present).toEqual(s({ a: 1 }, null));
  });
});
