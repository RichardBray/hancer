import { useState, useCallback, useRef, useEffect } from "react";
import { useUpload } from "./hooks/useUpload";
import { useLooks } from "./hooks/useLooks";
import { useResizable } from "./hooks/useResizable";
import { useHistory } from "./hooks/useHistory";
import { TopBar } from "./components/TopBar";
import { LooksPanel } from "./components/LooksPanel";
import { AdjustmentsPanel } from "./components/AdjustmentsPanel";
import { Canvas } from "./components/Canvas";
import { UploadZone } from "./components/UploadZone";
import { Timeline } from "./components/Timeline";
import { ResizeDivider } from "./components/ResizeDivider";
import { NewLookModal } from "./components/NewLookModal";
import type { Renderer, PreviewParams } from "./gpu/renderer";
import type { EffectGroup } from "@hance/core";

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
    refreshLooks, loadLook, clearLook, saveLook, createLook, deleteLook, renameLook, importLook, restoreActiveLook,
  } = useLooks();

  // History tracks {params, activeLook}. Only these are undoable — file
  // uploads, look CRUD, hover previews, scrub, and resizing are not.
  const history = useHistory<{ params: PreviewParams; activeLook: string | null }>(
    { params: {}, activeLook: null },
  );

  const activeLookRef = useRef<string | null>(activeLook);
  const historyRef = useRef(history);
  useEffect(() => { activeLookRef.current = activeLook; }, [activeLook]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Reading from setParams' updater guarantees we see pending state from
  // the same event — a toggle's onChange + onCommit run before React
  // re-renders, so paramsRef would otherwise be stale by one change.
  const commitHistory = useCallback(() => {
    setParams(p => {
      historyRef.current.commit({ params: p, activeLook: activeLookRef.current });
      return p;
    });
  }, []);

  // Fetch schema and looks on mount — external server data
  useEffect(() => {
    fetch("/api/schema").then(r => r.json()).then((groups: EffectGroup[]) => {
      setSchema(groups);
      // Start with no effects applied (No Look)
      const disableAll: Record<string, boolean> = {};
      for (const group of groups) {
        disableAll[group.enableKey] = true;
      }
      setParams(disableAll);
      // Replace (not commit) the initial present so we don't leave the
      // pre-schema empty `{}` snapshot reachable via undo.
      history.replace({ params: disableAll, activeLook: null });
    });
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

  const handleNoLook = useCallback(() => {
    clearLook();
    setAnimating(true);
    const disableAll: Record<string, boolean> = {};
    for (const group of schema) {
      disableAll[group.enableKey] = true;
    }
    setParams(disableAll);
    setTimeout(() => setAnimating(false), 350);
    historyRef.current.commit({ params: disableAll, activeLook: null });
  }, [clearLook, schema]);

  const handleLookSelect = useCallback(async (name: string) => {
    const lookParams = await loadLook(name);
    setAnimating(true);
    setParams(lookParams);
    setTimeout(() => setAnimating(false), 350);
    historyRef.current.commit({ params: lookParams, activeLook: name });
  }, [loadLook]);

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

  const applySnapshot = useCallback(async (snap: { params: PreviewParams; activeLook: string | null } | null) => {
    if (!snap) return;
    setAnimating(true);
    setParams(snap.params);
    await restoreActiveLook(snap.activeLook);
    setTimeout(() => setAnimating(false), 350);
  }, [restoreActiveLook]);

  // Cmd/Ctrl+Z — undo. Shift adds redo. Skip when a text field is focused
  // so native text-input undo keeps working inside modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          // Exception: the range input's keyboard arrows fire commits already
          // and benefit from app-level undo. Let undo/redo work from range.
          const inputType = (target as HTMLInputElement).type;
          if (tag === "INPUT" && inputType === "range") {
            // fall through to app undo
          } else {
            return;
          }
        }
      }
      e.preventDefault();
      if (e.shiftKey) {
        applySnapshot(historyRef.current.redo());
      } else {
        applySnapshot(historyRef.current.undo());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applySnapshot]);

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
            onNoLook={handleNoLook}
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
            onCommit={commitHistory}
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
