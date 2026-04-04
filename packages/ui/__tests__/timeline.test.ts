import { describe, test, expect } from "bun:test";

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

describe("formatTimecode", () => {
  test("formats seconds only", () => {
    expect(formatTimecode(5)).toBe("0:05");
  });

  test("formats minutes and seconds", () => {
    expect(formatTimecode(65)).toBe("1:05");
  });

  test("formats hours", () => {
    expect(formatTimecode(3661)).toBe("1:01:01");
  });

  test("formats zero", () => {
    expect(formatTimecode(0)).toBe("0:00");
  });
});
