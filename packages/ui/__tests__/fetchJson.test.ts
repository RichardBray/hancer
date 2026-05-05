import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { fetchJson, fetchOk, HttpError } from "../app/lib/fetchJson";

const originalFetch = globalThis.fetch;

function mockFetch(impl: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = mock(impl) as typeof fetch;
}

describe("fetchJson", () => {
  beforeEach(() => { globalThis.fetch = originalFetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  test("returns parsed JSON on 200", async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true, n: 42 }), { status: 200 }));
    const data = await fetchJson<{ ok: boolean; n: number }>("/api/x");
    expect(data).toEqual({ ok: true, n: 42 });
  });

  test("throws HttpError with parsed `error` field on non-2xx JSON body", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404, statusText: "Not Found" }));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      message: expect.stringContaining("not found"),
    });
  });

  test("throws HttpError including text body on non-2xx HTML response", async () => {
    mockFetch(async () => new Response("<html>500</html>", { status: 500, statusText: "Server Error" }));
    await expect(fetchJson("/api/x")).rejects.toBeInstanceOf(HttpError);
  });

  test("throws Network error on fetch rejection", async () => {
    mockFetch(async () => { throw new TypeError("Failed to fetch"); });
    await expect(fetchJson("/api/x")).rejects.toThrow(/Network error/);
  });

  test("throws Invalid JSON on 200 with non-JSON body", async () => {
    mockFetch(async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(fetchJson("/api/x")).rejects.toThrow(/Invalid JSON/);
  });

  test("truncates very long error bodies", async () => {
    const big = "x".repeat(500);
    mockFetch(async () => new Response(big, { status: 500 }));
    await expect(fetchJson("/api/x")).rejects.toThrow(/x{200}…/);
  });
});

describe("fetchOk", () => {
  beforeEach(() => { globalThis.fetch = originalFetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  test("returns response on 2xx", async () => {
    mockFetch(async () => new Response("ok", { status: 200 }));
    const res = await fetchOk("/api/x");
    expect(res.status).toBe(200);
  });

  test("throws HttpError on non-2xx", async () => {
    mockFetch(async () => new Response("nope", { status: 400 }));
    await expect(fetchOk("/api/x")).rejects.toBeInstanceOf(HttpError);
  });
});
