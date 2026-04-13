import { EFFECT_SCHEMA, loadPreset, builtinPresetsDir, userPresetsDir, probe } from "@hancer/core";
import type { PresetData } from "@hancer/core";
import { runGpuExport } from "@hancer/cli/src/pipeline";
import { join } from "node:path";
import { existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";

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

function invalidateThumbnailCache(name: string) {
  const cachePath = join(tmpdir(), "hancer-thumbnails", `${name}.jpg`);
  if (existsSync(cachePath)) unlinkSync(cachePath);
}

export function createServer(port: number) {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/schema") {
        return Response.json(EFFECT_SCHEMA);
      }

      if (url.pathname === "/api/looks" && req.method === "GET") {
        return Response.json(listLooks());
      }

      if (url.pathname === "/api/look/info" && req.method === "GET") {
        const name = url.searchParams.get("name") || "default";
        try {
          const raw = loadPreset(name);
          return Response.json({
            name: raw.name ?? name,
            description: raw.description ?? "",
            keywords: raw.keywords ?? [],
            characteristics: raw.characteristics ?? [],
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
        if (!name || !data) return new Response("name and data required", { status: 400 });
        const dir = userPresetsDir();
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const lookData = { name, description: description || "", keywords: keywords || [], characteristics: characteristics || [], params: data };
        writeFileSync(join(dir, `${name}.hlook`), JSON.stringify(lookData, null, 2));
        invalidateThumbnailCache(name);
        return Response.json({ ok: true });
      }

      if (url.pathname === "/api/look" && req.method === "PUT") {
        const body = await req.json();
        const { name, data } = body;
        if (!name || !data) return new Response("name and data required", { status: 400 });
        const dir = userPresetsDir();
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const filePath = join(dir, `${name}.hlook`);
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
        invalidateThumbnailCache(name);
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
              invalidateThumbnailCache(oldName);
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

      if (url.pathname === "/api/look-thumbnail" && req.method === "GET") {
        const name = url.searchParams.get("name");
        if (!name) return new Response("name required", { status: 400 });

        // Check cache
        const cacheDir = join(tmpdir(), "hancer-thumbnails");
        if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
        const cachePath = join(cacheDir, `${name}.jpg`);
        if (existsSync(cachePath)) {
          return new Response(Bun.file(cachePath), {
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
          });
        }

        // Load look params
        let lookParams: Record<string, unknown>;
        try {
          const raw = loadPreset(name);
          lookParams = (raw.params ?? raw) as Record<string, unknown>;
        } catch {
          return new Response("Look not found", { status: 404 });
        }

        // Apply look to reference image via FFmpeg
        const referenceImage = join(import.meta.dir, "assets", "reference.jpg");
        if (!existsSync(referenceImage)) {
          return new Response("Reference image not found", { status: 500 });
        }

        const exposure = Number(lookParams["exposure"] ?? 0);
        const contrast = Number(lookParams["contrast"] ?? 1);
        const saturation = Number(lookParams["subtractive-sat"] ?? 1);
        const fade = Number(lookParams["fade"] ?? 0);

        const filters = [
          `eq=brightness=${exposure}:contrast=${contrast}:saturation=${saturation}`,
          fade > 0 ? `curves=master='0/0 0/${Math.round(fade * 64)} 1/1'` : null,
          `crop='min(iw,ih)':'min(iw,ih)',scale=256:256`,
        ].filter(Boolean).join(",");

        const proc = Bun.spawn([
          "ffmpeg", "-y", "-i", referenceImage,
          "-vf", filters,
          "-frames:v", "1", "-q:v", "4",
          cachePath,
        ], { stdout: "ignore", stderr: "ignore" });

        const exitCode = await proc.exited;
        if (exitCode !== 0 || !existsSync(cachePath)) {
          return new Response("Thumbnail generation failed", { status: 500 });
        }

        return new Response(Bun.file(cachePath), {
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
        });
      }

      if (url.pathname === "/api/export" && req.method === "POST") {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const paramsJson = formData.get("params") as string | null;
        if (!file || !paramsJson) {
          return new Response("file and params required", { status: 400 });
        }

        const params: PresetData = JSON.parse(paramsJson);
        const tempDir = join(tmpdir(), "hancer-export");
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        const inputPath = join(tempDir, file.name);
        await Bun.write(inputPath, file);

        const probeResult = await probe(inputPath);

        if (probeResult.isImage) {
          return new Response("Image export is handled client-side", { status: 400 });
        }

        const outputPath = join(tempDir, `export_${Date.now()}.mp4`);

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

      if (url.pathname === "/api/download" && req.method === "GET") {
        const filePath = url.searchParams.get("path");
        const allowedDir = join(tmpdir(), "hancer-export");
        if (!filePath || !filePath.startsWith(allowedDir + "/") || !existsSync(filePath)) {
          return new Response("File not found", { status: 404 });
        }
        return new Response(Bun.file(filePath), {
          headers: { "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"` },
        });
      }

      // Static file serving (SPA)
      const staticDir = join(import.meta.dir, "dist");
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
  "\x1b[36m  \u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d",
  "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u255d  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
  "  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551",
  "  \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\x1b[0m",
].join("\n");

export async function startUI(port: number, openBrowser = true): Promise<void> {
  const server = createServer(port);
  console.log(STARTUP_ASCII_ART);
  console.log(`\n  \x1b[2mRunning at\x1b[0m \x1b[1mhttp://localhost:${server.port}\x1b[0m\n`);
  if (openBrowser) {
    const open = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([open, `http://localhost:${server.port}`], { stdout: "ignore", stderr: "ignore" });
  }
}
