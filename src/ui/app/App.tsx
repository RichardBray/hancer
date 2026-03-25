import { useState, useCallback, useRef } from "react";
import { useUpload } from "./hooks/useUpload";
import { UploadPanel } from "./components/UploadPanel";
import { VideoPlayer } from "./components/VideoPlayer";
import type { Renderer, PreviewParams } from "./gpu/renderer";

export function App() {
  const { file, objectUrl, isVideo, upload } = useUpload();
  const [params, setParams] = useState<PreviewParams>({});
  const rendererRef = useRef<Renderer | null>(null);

  const handleRendererReady = useCallback((renderer: Renderer) => {
    rendererRef.current = renderer;
  }, []);

  if (!objectUrl) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", fontSize: 14, fontWeight: 600 }}>
          openhancer
        </div>
        <UploadPanel onFile={upload} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", fontSize: 14, fontWeight: 600 }}>
        openhancer
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", padding: 16 }}>
          <VideoPlayer
            src={objectUrl}
            isVideo={isVideo}
            params={params}
            onRendererReady={handleRendererReady}
          />
        </div>
        <div style={{ width: 320, borderLeft: "1px solid #1a1a1a", overflowY: "auto", padding: 16 }}>
          {/* Controls panel will be added in Task 7 */}
          <div style={{ opacity: 0.5 }}>Controls loading...</div>
        </div>
      </div>
    </div>
  );
}
