import { EFFECT_SCHEMA, loadPreset, builtinPresetsDir, userPresetsDir, probe } from "@hance/core";
import type { PresetData } from "@hance/core";
import { runGpuExport } from "@hance/cli/src/pipeline";
import { join, extname, basename } from "node:path";
import { existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, renameSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { transcodeToH264Stream } from "./lib/transcode";

function safeExt(name: string): string {
  const ext = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function preparePresetWrite(name: unknown, data: unknown): { ok: true; path: string } | { ok: false; res: Response } {
  if (!name || !data) return { ok: false, res: new Response("name and data required", { status: 400 }) };
  const dir = userPresetsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return { ok: true, path: join(dir, `${name}.hlook`) };
}

function listLooks(): string[] {
  const names: string[] = [];
  for (const dir of [builtinPresetsDir(), userPresetsDir()]) {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".hlook") || f.endsWith(".json")) {
          names.push(f.replace(/\.(hlook|json)$/, ""));
        }
      }
    }
  }
  return [...new Set(names)];
}

let initialFilePath: string | null = null;

export function setInitialFile(path: string | null): void {
  initialFilePath = path;
}

export function createServer(port: number) {
  return Bun.serve({
    port,
    maxRequestBodySize: 1024 * 1024 * 1024 * 16,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/schema") {
        return Response.json(EFFECT_SCHEMA);
      }

      if (url.pathname === "/api/initial-file" && req.method === "GET") {
        if (!initialFilePath || !existsSync(initialFilePath)) {
          return new Response("no initial file", { status: 404 });
        }
        const file = Bun.file(initialFilePath);
        const name = initialFilePath.split("/").pop() || "file";
        return new Response(file, {
          headers: {
            "X-Filename": encodeURIComponent(name),
            "Content-Type": file.type || "application/octet-stream",
          },
        });
      }

      if (url.pathname === "/api/looks" && req.method === "GET") {
        return Response.json(listLooks());
      }

      if (url.pathname === "/api/look/info" && req.method === "GET") {
        const name = url.searchParams.get("name") || "default";
        try {
          const raw = loadPreset(name);
          const params = raw.params ?? raw;
          return Response.json({
            name: raw.name ?? name,
            description: raw.description ?? "",
            keywords: raw.keywords ?? [],
            characteristics: raw.characteristics ?? [],
            params,
          });
        } catch {
          return new Response("Look not found", { status: 404 });
        }
      }

      if (url.pathname === "/api/look" && req.method === "GET") {
        const name = url.searchParams.get("name") || "default";
        try {
          const raw = loadPreset(name);
          // .hlook files have params nested; .json files have them at top level
          const params = raw.params ?? raw;
          return Response.json(params);
        } catch {
          return new Response("Look not found", { status: 404 });
        }
      }

      if (url.pathname === "/api/looks" && req.method === "POST") {
        const body = await req.json();
        const { name, data, description, keywords, characteristics } = body;
        const prep = preparePresetWrite(name, data);
        if (!prep.ok) return prep.res;
        const lookData = { name, description: description || "", keywords: keywords || [], characteristics: characteristics || [], params: data };
        writeFileSync(prep.path, JSON.stringify(lookData, null, 2));
        return Response.json({ ok: true });
      }

      if (url.pathname === "/api/look" && req.method === "PUT") {
        const body = await req.json();
        const { name, data } = body;
        const prep = preparePresetWrite(name, data);
        if (!prep.ok) return prep.res;
        const filePath = prep.path;
        let existing: Record<string, unknown> = {};
        try {
          existing = JSON.parse(await Bun.file(filePath).text());
        } catch {
          for (const ext of [".hlook", ".json"]) {
            const builtinPath = join(builtinPresetsDir(), `${name}${ext}`);
            if (existsSync(builtinPath)) {
              try { existing = JSON.parse(await Bun.file(builtinPath).text()); } catch {}
              break;
            }
          }
        }
        const updated = { ...existing, params: data };
        writeFileSync(filePath, JSON.stringify(updated, null, 2));
        return Response.json({ ok: true });
      }

      if (url.pathname === "/api/look" && req.method === "DELETE") {
        const name = url.searchParams.get("name");
        if (!name) return new Response("name required", { status: 400 });
        for (const dir of [userPresetsDir(), builtinPresetsDir()]) {
          for (const ext of [".hlook", ".json"]) {
            const filePath = join(dir, `${name}${ext}`);
            if (existsSync(filePath)) unlinkSync(filePath);
          }
        }
        return Response.json({ ok: true });
      }

      if (url.pathname === "/api/look/rename" && req.method === "POST") {
        const body = await req.json();
        const { oldName, newName } = body;
        if (!oldName || !newName) return new Response("oldName and newName required", { status: 400 });
        for (const dir of [userPresetsDir(), builtinPresetsDir()]) {
          for (const ext of [".hlook", ".json"]) {
            const oldPath = join(dir, `${oldName}${ext}`);
            if (existsSync(oldPath)) {
              const newPath = join(dir, `${newName}.hlook`);
              renameSync(oldPath, newPath);
              return Response.json({ ok: true });
            }
          }
        }
        return new Response("Look not found", { status: 404 });
      }

      if (url.pathname === "/api/look/import" && req.method === "POST") {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file || !file.name.endsWith(".hlook")) {
          return new Response("Valid .hlook file required", { status: 400 });
        }
        const text = await file.text();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text);
        } catch {
          return new Response("Invalid JSON in .hlook file", { status: 400 });
        }
        const dir = userPresetsDir();
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const name = (parsed.name as string) || file.name.replace(".hlook", "");
        writeFileSync(join(dir, `${name}.hlook`), JSON.stringify(parsed, null, 2));
        return Response.json({ ok: true, name });
      }

      if (url.pathname === "/api/export" && req.method === "POST") {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const paramsJson = formData.get("params") as string | null;
        if (!file || !paramsJson) {
          return new Response("file and params required", { status: 400 });
        }

        const params: PresetData = JSON.parse(paramsJson);
        const codecLabel = String(formData.get("codec") ?? "H.264");
        const crf = Number(formData.get("crf") ?? 23);
        const outputName = String(formData.get("outputName") ?? "");
        const codec: "h264" | "h265" | "prores" =
          codecLabel === "ProRes 422" ? "prores" :
          codecLabel === "H.265" ? "h265" : "h264";
        const pixelFormat = codec === "prores" ? "yuv422p10le" : "yuv420p";
        const tempDir = join(tmpdir(), "hance-export");
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        const inputPath = join(tempDir, file.name);
        await Bun.write(inputPath, file);

        const probeResult = await probe(inputPath);

        if (probeResult.isImage) {
          return new Response("Image export is handled client-side", { status: 400 });
        }

        const defaultExt = codec === "prores" ? "mov" : "mp4";
        const candidate = outputName ? basename(outputName) : "";
        const safeName = /^[A-Za-z0-9._-]+\.(mp4|mov)$/.test(candidate)
          ? candidate
          : `export_${Date.now()}.${defaultExt}`;
        const outputPath = join(tempDir, safeName);

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              await runGpuExport(
                inputPath,
                outputPath,
                params as Record<string, unknown>,
                probeResult,
                (ratio) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: ratio })}\n\n`));
                },
                { codec, crf, encodePreset: "medium", pixelFormat: pixelFormat as "yuv420p" | "yuv422p10le" },
              );
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, downloadUrl: `/api/download?path=${encodeURIComponent(outputPath)}` })}\n\n`));
            } catch (err) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`));
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      if (url.pathname === "/api/proxy" && req.method === "POST") {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return new Response("file required", { status: 400 });

        const proxyDir = join(tmpdir(), "hance-proxy");
        mkdirSync(proxyDir, { recursive: true });
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const inputPath = join(proxyDir, `input_${id}${safeExt(file.name)}`);
        await Bun.write(inputPath, file);

        const outputPath = join(proxyDir, `proxy_${id}.mp4`);
        const source = transcodeToH264Stream(inputPath, outputPath);
        const stream = new ReadableStream({
          async start(controller) {
            const reader = source.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } finally {
              try { unlinkSync(inputPath); } catch {}
              try { controller.close(); } catch {}
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      if (url.pathname === "/api/proxy-file" && req.method === "GET") {
        const filePath = url.searchParams.get("path");
        const allowedDir = join(tmpdir(), "hance-proxy");
        if (!filePath || !filePath.startsWith(allowedDir + "/") || !existsSync(filePath)) {
          return new Response("File not found", { status: 404 });
        }
        return new Response(Bun.file(filePath), {
          headers: {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
          },
        });
      }

      if (url.pathname === "/api/download" && req.method === "GET") {
        const filePath = url.searchParams.get("path");
        const allowedDir = join(tmpdir(), "hance-export");
        if (!filePath || !filePath.startsWith(allowedDir + "/") || !existsSync(filePath)) {
          return new Response("File not found", { status: 404 });
        }
        return new Response(Bun.file(filePath), {
          headers: { "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"` },
        });
      }

      // Static file serving (SPA)
      const localDist = join(import.meta.dir, "dist");
      const staticDir = existsSync(localDist) ? localDist : join(homedir(), ".hance", "ui");
      const filePath = join(staticDir, url.pathname === "/" ? "index.html" : url.pathname);
      if (existsSync(filePath)) {
        return new Response(Bun.file(filePath));
      }
      const indexPath = join(staticDir, "index.html");
      if (existsSync(indexPath)) {
        return new Response(Bun.file(indexPath));
      }
      return new Response("Not found", { status: 404 });
    },
  });
}

const STARTUP_ASCII_ART = [
  "",
  "\x1b[36m  \u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d",
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2557  ",
  "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u255d  ",
  "  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "  \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\x1b[0m",
].join("\n");

export async function startUI(port: number, openBrowser = true, initialFile?: string): Promise<void> {
  initialFilePath = initialFile ?? null;
  const proxyDir = join(tmpdir(), "hance-proxy");
  const cleanup = () => { try { rmSync(proxyDir, { recursive: true, force: true }); } catch {} };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  const server = createServer(port);
  console.log(STARTUP_ASCII_ART);
  console.log(`\n  \x1b[2mRunning at\x1b[0m \x1b[1mhttp://localhost:${server.port}\x1b[0m\n`);
  if (openBrowser) {
    const open = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([open, `http://localhost:${server.port}`], { stdout: "ignore", stderr: "ignore" });
  }
}
