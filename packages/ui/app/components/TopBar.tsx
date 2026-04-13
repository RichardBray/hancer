import { useState } from "react";
import type { Renderer } from "../gpu/renderer";

interface Props {
  filename: string | null;
  file: File | null;
  params: Record<string, string | number | boolean>;
  canvas: HTMLCanvasElement | null;
  renderer: Renderer | null;
  isVideo: boolean;
}

type ExportState = "idle" | "uploading" | "rendering" | "done" | "error";

export function TopBar({ filename, file, params, canvas, renderer, isVideo }: Props) {
  const [state, setState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadImage() {
    if (!renderer || !canvas) return;
    const rgba = await renderer.readPixels();
    if (rgba.length === 0) return;
    const w = canvas.width;
    const h = canvas.height;
    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext("2d")!;
    const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer), w, h);
    ctx.putImageData(imageData, 0, 0);
    const blob = await offscreen.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file!.name.replace(/\.[^.]+$/, "_hanced.png");
    a.click();
    URL.revokeObjectURL(url);
  }

  async function startExport() {
    if (!file) return;
    setState("uploading");
    setProgress(0);
    setDownloadUrl(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("params", JSON.stringify(params));

    try {
      const res = await fetch("/api/export", { method: "POST", body: formData });
      if (!res.ok || !res.body) {
        setState("error");
        setError("Export request failed");
        return;
      }

      setState("rendering");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/);
          if (!match) continue;
          const data = JSON.parse(match[1]);
          if (data.progress !== undefined) setProgress(data.progress);
          if (data.done) {
            setState("done");
            setDownloadUrl(data.downloadUrl);
          }
          if (data.error) {
            setState("error");
            setError(data.error);
          }
        }
      }
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
      <span className="text-sm font-semibold text-zinc-200">hance</span>

      <span className="text-xs text-zinc-500 truncate max-w-xs">
        {filename || ""}
      </span>

      <div className="flex items-center gap-2">
        {state === "idle" && file && (
          <button
            onClick={isVideo ? startExport : downloadImage}
            className="px-4 py-1 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover transition-colors"
          >
            {isVideo ? "Export" : "Download"}
          </button>
        )}

        {(state === "uploading" || state === "rendering") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {state === "uploading" ? "Uploading..." : `${Math.round(progress * 100)}%`}
            </span>
            <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {state === "done" && downloadUrl && (
          <a
            href={downloadUrl}
            download
            onClick={() => setState("idle")}
            className="px-4 py-1 bg-success text-white text-xs font-medium rounded-md"
          >
            Download
          </a>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-danger">{error}</span>
            <button
              onClick={() => setState("idle")}
              className="px-3 py-1 bg-zinc-700 text-zinc-200 text-xs rounded-md hover:bg-zinc-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
