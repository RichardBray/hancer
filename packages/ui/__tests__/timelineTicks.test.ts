import { test, expect } from "bun:test";
import { computeTicks } from "../app/components/timelineTicks";

test("short clip (3s) — sub-second major interval", () => {
  const t = computeTicks(3);
  expect(t.majors.length).toBeGreaterThanOrEqual(4);
  expect(t.majors.length).toBeLessThanOrEqual(10);
  expect(t.majorInterval).toBeGreaterThan(0);
});

test("30s clip — ~6-10 majors", () => {
  const t = computeTicks(30);
  expect(t.majors.length).toBeGreaterThanOrEqual(6);
  expect(t.majors.length).toBeLessThanOrEqual(10);
});

test("5-minute clip — ~6-10 majors", () => {
  const t = computeTicks(300);
  expect(t.majors.length).toBeGreaterThanOrEqual(6);
  expect(t.majors.length).toBeLessThanOrEqual(10);
});

test("snaps to human intervals (1,2,5,10,15,30,60,...)", () => {
  const t = computeTicks(30);
  expect([1, 2, 5, 10, 15, 30, 60]).toContain(t.majorInterval);
});

test("4 minors between majors", () => {
  const t = computeTicks(30);
  expect(t.minorsPerMajor).toBe(4);
});

test("zero/invalid duration returns empty", () => {
  expect(computeTicks(0).majors).toEqual([]);
  expect(computeTicks(-1).majors).toEqual([]);
});

test("major times are within duration", () => {
  const t = computeTicks(30);
  for (const m of t.majors) {
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(30);
  }
});
