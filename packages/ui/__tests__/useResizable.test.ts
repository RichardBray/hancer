import { describe, test, expect } from "bun:test";
import { clamp } from "../app/hooks/useResizable";

describe("useResizable clamp logic", () => {
  test("clamps below minimum", () => {
    expect(clamp(100, 200, 400)).toBe(200);
  });

  test("clamps above maximum", () => {
    expect(clamp(500, 200, 400)).toBe(400);
  });

  test("keeps value within range", () => {
    expect(clamp(300, 200, 400)).toBe(300);
  });

  test("handles min equal to max", () => {
    expect(clamp(300, 250, 250)).toBe(250);
  });
});
