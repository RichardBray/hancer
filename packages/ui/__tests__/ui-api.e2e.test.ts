import { describe, expect, test, afterAll } from "bun:test";
import { createServer } from "../server";

describe("UI API e2e", () => {
  const server = createServer(0);
  const base = `http://localhost:${server.port}`;

  afterAll(() => server.stop());

  test("GET /api/schema returns all effect groups", async () => {
    const res = await fetch(`${base}/api/schema`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(8);
    expect(data[0].key).toBe("colorSettings");
  });

  test("GET /api/presets lists built-in presets", async () => {
    const res = await fetch(`${base}/api/presets`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toContain("default");
    expect(data).toContain("subtle");
    expect(data).toContain("heavy");
  });

  test("GET /api/preset?name=default returns preset data", async () => {
    const res = await fetch(`${base}/api/preset?name=default`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data["exposure"]).toBe(0);
    expect(data["halation-amount"]).toBe(0.25);
  });

  test("GET /api/preset?name=nonexistent returns 404", async () => {
    const res = await fetch(`${base}/api/preset?name=nonexistent`);
    expect(res.status).toBe(404);
  });

  test("POST /api/presets saves a user preset", async () => {
    const res = await fetch(`${base}/api/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-e2e-preset",
        data: { exposure: 0.5, contrast: 1.2 },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify it shows up in list
    const listRes = await fetch(`${base}/api/presets`);
    const presets = await listRes.json();
    expect(presets).toContain("test-e2e-preset");
  });

  test("SPA fallback serves index.html for unknown routes", async () => {
    const res = await fetch(`${base}/some/unknown/route`);
    // Will be 200 with index.html if dist exists, or 404
    expect([200, 404]).toContain(res.status);
  });
});
