import { describe, expect, test } from "bun:test";
import { fitPreviewSize } from "../app/mediaSizing";

describe("fitPreviewSize", () => {
  test("caps large landscape media at 1080p", () => {
    expect(fitPreviewSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  test("caps large portrait media within the 1080p preview bounds", () => {
    expect(fitPreviewSize(2160, 3840)).toEqual({ width: 608, height: 1080 });
  });

  test("keeps smaller media at native size", () => {
    expect(fitPreviewSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  });
});
