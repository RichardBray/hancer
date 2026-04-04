import { describe, test, expect } from "bun:test";

// Test the validation logic used by useLooks
function validateLookName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Name is required";
  if (trimmed.length > 50) return "Name must be 50 characters or less";
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) return "Name can only contain letters, numbers, spaces, hyphens, and underscores";
  return null;
}

describe("look name validation", () => {
  test("rejects empty name", () => {
    expect(validateLookName("")).toBe("Name is required");
    expect(validateLookName("   ")).toBe("Name is required");
  });

  test("accepts valid names", () => {
    expect(validateLookName("Cinematic Warm")).toBeNull();
    expect(validateLookName("my-look_01")).toBeNull();
  });

  test("rejects names with special chars", () => {
    expect(validateLookName("look/bad")).not.toBeNull();
  });

  test("rejects names over 50 chars", () => {
    expect(validateLookName("a".repeat(51))).not.toBeNull();
  });
});
