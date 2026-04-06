import { useState, useCallback, useRef, useEffect } from "react";
import { useUpload } from "./hooks/useUpload";
import { useLooks } from "./hooks/useLooks";
import { useResizable } from "./hooks/useResizable";
import { TopBar } from "./components/TopBar";
import { LooksPanel } from "./components/LooksPanel";
import { AdjustmentsPanel } from "./components/AdjustmentsPanel";
import { Canvas } from "./components/Canvas";
import { UploadZone } from "./components/UploadZone";
import { Timeline } from "./components/Timeline";
import { ResizeDivider } from "./components/ResizeDivider";
import { NewLookModal } from "./components/NewLookModal";
import type { Renderer, PreviewParams } from "./gpu/renderer";
import type { EffectGroup } from "@hancer/core";

export function App() {
  const { file, objectUrl, isVideo, upload } = useUpload();
  const [params, setParams] = useState<PreviewParams>({});
  const [schema, setSchema] = useState<EffectGroup[]>([]);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);
  const hoverParamsRef = useRef<PreviewParams | null>(null);

  const {
    looks, activeLook, activeLookParams,
    refreshLooks, loadLook, saveLook, createLook, deleteLook, renameLook, importLook,
  } = useLooks();

  // Fetch schema and looks on mount — external server data
  useEffect(() => {
    fetch("/api/schema").then(r => r.json()).then(setSchema);
    refreshLooks();
  }, []);

  const leftPanel = useResizable({ defaultSize: 240, minSize: 200, maxSize: 400, direction: "horizontal" });
  const rightPanel = useResizable({ defaultSize: 300, minSize: 250, maxSize: 450, direction: "horizontal", reverse: true });
  const bottomPanel = useResizable({ defaultSize: 60, minSize: 50, maxSize: 200, direction: "vertical", reverse: true });

  const handleRendererReady = useCallback((r: Renderer) => {
    setRenderer(r);
  }, []);

  const handleCanvasReady = useCallback((c: HTMLCanvasElement) => {
    setCanvas(c);
  }, []);

  const handleVideoReady = useCallback((v: HTMLVideoElement) => {
    setVideoElement(v);
  }, []);

  const handleParamChange = useCallback((key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBatchChange = useCallback((data: Record<string, string | number | boolean>) => {
    setParams(prev => ({ ...prev, ...data }));
  }, []);

  const handleLookSelect = useCallback(async (name: string) => {
    const lookParams = await loadLook(name);
    setAnimating(true);
    handleBatchChange(lookParams);
    setTimeout(() => setAnimating(false), 350);
  }, [loadLook, handleBatchChange]);

  const handleLookHover = useCallback((name: string) => {
    if (!renderer) return;
    if (!hoverParamsRef.current) {
      hoverParamsRef.current = { ...params };
    }
    fetch(`/api/look?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then((lookParams: PreviewParams) => {
        renderer.setParams(lookParams);
        if (!isVideo) renderer.renderFrame();
      });
  }, [renderer, params, isVideo]);

  const handleLookHoverEnd = useCallback(() => {
    if (renderer && hoverParamsRef.current) {
      renderer.setParams(params);
      if (!isVideo) renderer.renderFrame();
      hoverParamsRef.current = null;
    }
  }, [renderer, params, isVideo]);

  const handleSave = useCallback(() => {
    if (activeLook) {
      saveLook(activeLook, params);
    }
  }, [activeLook, params, saveLook]);

  const handleSaveAsNew = useCallback(() => {
    setShowSaveAsNew(true);
  }, []);

  const handleCreateLook = useCallback((name: string, metadata: { description: string; keywords: string[]; characteristics: string[] }) => {
    createLook(name, params, metadata);
  }, [createLook, params]);

  if (!objectUrl) {
    return (
      <div className="h-screen flex flex-col bg-zinc-950">
        <TopBar filename={null} file={null} params={params} canvas={null} renderer={null} isVideo={false} />
        <UploadZone onFile={upload} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <TopBar
        filename={file?.name || null}
        file={file}
        params={params}
        canvas={canvas}
        renderer={renderer}
        isVideo={isVideo}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Looks browser */}
        <div className="flex-shrink-0 bg-zinc-900 overflow-hidden" style={{ width: leftPanel.size }}>
          <LooksPanel
            looks={looks}
            activeLook={activeLook}
            onSelect={handleLookSelect}
            onHover={handleLookHover}
            onHoverEnd={handleLookHoverEnd}
            onCreateLook={handleCreateLook}
            onDeleteLook={deleteLook}
            onRenameLook={renameLook}
            onImportLook={importLook}
            onGetLookInfo={async (name) => {
              const res = await fetch(`/api/look/info?name=${encodeURIComponent(name)}`);
              return await res.json();
            }}
          />
        </div>

        <ResizeDivider direction="horizontal" onMouseDown={leftPanel.onMouseDown} />

        {/* Center — Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 min-w-0">
          <Canvas
            src={objectUrl}
            isVideo={isVideo}
            params={params}
            onRendererReady={handleRendererReady}
            onCanvasReady={handleCanvasReady}
            onVideoReady={handleVideoReady}
          />
        </div>

        <ResizeDivider direction="horizontal" onMouseDown={rightPanel.onMouseDown} />

        {/* Right panel — Adjustments */}
        <div className="flex-shrink-0 bg-zinc-900 overflow-hidden" style={{ width: rightPanel.size }}>
          <AdjustmentsPanel
            schema={schema}
            values={params}
            onChange={handleParamChange}
            activeLookParams={activeLookParams}
            onSave={handleSave}
            onSaveAsNew={handleSaveAsNew}
            animating={animating}
          />
        </div>
      </div>

      {/* Bottom — Timeline (video only) */}
      {isVideo && (
        <>
          <ResizeDivider direction="vertical" onMouseDown={bottomPanel.onMouseDown} />
          <div className="flex-shrink-0" style={{ height: bottomPanel.size }}>
            <Timeline videoRef={videoElement} />
          </div>
        </>
      )}

      {showSaveAsNew && (
        <NewLookModal
          onSubmit={(name, metadata) => {
            handleCreateLook(name, metadata);
            setShowSaveAsNew(false);
          }}
          onCancel={() => setShowSaveAsNew(false)}
        />
      )}
    </div>
  );
}
