import { useState } from "react";
import type { Renderer } from "../gpu/renderer";
import { consumeSSE } from "../lib/sse";
import { SaveBar } from "./SaveBar";

interface Props {
  filename: string | null;
  file: File | null;
  params: Record<string, string | number | boolean>;
  canvas: HTMLCanvasElement | null;
  renderer: Renderer | null;
  isVideo: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
  onExportClick: () => void;
}

type ExportState = "idle" | "uploading" | "rendering" | "done" | "error";

export function TopBar({
  filename, file, params, canvas, renderer, isVideo,
  hasChanges, onSave, onSaveAsNew, onExportClick,
}: Props) {
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

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
      <span className="text-xs text-zinc-300 truncate max-w-xs">
        {filename || ""}
      </span>

      <span />

      <div className="flex items-center gap-2">
        {file && (
          <SaveBar hasChanges={hasChanges} onSave={onSave} onSaveAsNew={onSaveAsNew} />
        )}

        {state === "idle" && file && (
          <button
            onClick={isVideo ? onExportClick : downloadImage}
            className="px-4 py-1 bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            {isVideo ? "Export" : "Download"}
          </button>
        )}

        {(state === "uploading" || state === "rendering") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {state === "uploading" ? "Uploading..." : `${Math.round(progress * 100)}%`}
            </span>
            <div className="w-24 h-1.5 bg-zinc-700 overflow-hidden" style={{ borderRadius: "var(--radius-sm)" }}>
              <div
                className="h-full bg-accent transition-[width] duration-200"
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
            className="px-4 py-1 bg-success text-white text-xs font-medium"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            Download
          </a>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-danger">{error}</span>
            <button
              onClick={() => setState("idle")}
              className="px-3 py-1 bg-zinc-700 text-zinc-200 text-xs hover:bg-zinc-600 transition-colors"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export type { ExportState };
