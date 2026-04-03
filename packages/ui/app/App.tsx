import { useState, useCallback } from "react";
import { useUpload } from "./hooks/useUpload";
import { UploadPanel } from "./components/UploadPanel";
import { VideoPlayer } from "./components/VideoPlayer";
import { ControlsPanel } from "./components/ControlsPanel";
import { RenderBar } from "./components/RenderBar";
import type { Renderer, PreviewParams } from "./gpu/renderer";

export function App() {
  const { file, objectUrl, isVideo, upload } = useUpload();
  const [params, setParams] = useState<PreviewParams>({});
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleRendererReady = useCallback((r: Renderer) => {
    setRenderer(r);
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvas(canvas);
  }, []);

  const handleParamChange = useCallback((key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBatchChange = useCallback((data: Record<string, string | number | boolean>) => {
    setParams(prev => ({ ...prev, ...data }));
  }, []);

  if (!objectUrl) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", fontSize: 14, fontWeight: 600 }}>
          hancer
        </div>
        <UploadPanel onFile={upload} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", fontSize: 14, fontWeight: 600 }}>
        hancer
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", padding: 16 }}>
          <VideoPlayer
            src={objectUrl}
            isVideo={isVideo}
            params={params}
            onRendererReady={handleRendererReady}
            onCanvasReady={handleCanvasReady}
          />
        </div>
        <div style={{ width: 320, borderLeft: "1px solid #1a1a1a", overflowY: "auto", padding: 16 }}>
          <ControlsPanel values={params} onChange={handleParamChange} onBatchChange={handleBatchChange} />
          {file && <RenderBar file={file} params={params} canvas={canvas} renderer={renderer} isVideo={isVideo} />}
        </div>
      </div>
    </div>
  );
}
