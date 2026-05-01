import { useState, useCallback, useRef, useEffect } from "react";
import { useUpload } from "./hooks/useUpload";
import { useInitialFile } from "./hooks/useInitialFile";
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
import { ExportModal } from "./components/ExportModal";
import { ViewModeToolbar, type ViewMode } from "./components/ViewModeToolbar";
import { CompareOverlay } from "./components/CompareOverlay";
import type { Renderer, PreviewParams } from "./gpu/renderer";
import type { EffectGroup } from "@hance/core";
import { consumeSSE } from "./lib/sse";

export function App() {
  const { file, objectUrl, proxyUrl, isVideo, upload, setProxyUrl, error: uploadError, clearError } = useUpload();
  const previewSrc = proxyUrl ?? objectUrl;
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [proxyState, setProxyState] = useState<"idle" | "uploading" | "transcoding" | "error">("idle");
  const [proxyProgress, setProxyProgress] = useState(0);
  const [proxyErrorMsg, setProxyErrorMsg] = useState<string | null>(null);

  useInitialFile(upload);

  const startTranscode = useCallback(async () => {
    if (!file) return;
    setProxyState("uploading");
    setProxyProgress(0);
    setProxyErrorMsg(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/proxy", { method: "POST", body: formData });
      setProxyState("transcoding");
      await consumeSSE(res, {
        onProgress: setProxyProgress,
        onDone: (data) => {
          setProxyUrl(data.proxyUrl as string);
          setPreviewError(null);
          setProxyState("idle");
        },
        onError: (msg) => {
          setProxyState("error");
          setProxyErrorMsg(msg);
        },
      });
    } catch (err) {
      setProxyState("error");
      setProxyErrorMsg((err as Error).message);
    }
  }, [file, setProxyUrl]);
  const [params, setParams] = useState<PreviewParams>({});
  const [schema, setSchema] = useState<EffectGroup[]>([]);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ state: "idle" | "uploading" | "rendering" | "done" | "error"; progress: number; downloadUrl: string | null; error: string | null }>({
    state: "idle", progress: 0, downloadUrl: null, error: null,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(0.5);
  const [canvasRect, setCanvasRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const hoverParamsRef = useRef<PreviewParams | null>(null);

  function chooseReferenceImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setReferenceImage(URL.createObjectURL(file));
    };
    input.click();
  }

  useEffect(() => {
    setPreviewError(null);
    setProxyState("idle");
    setProxyProgress(0);
    setProxyErrorMsg(null);
    setReferenceImage(null);
    setViewMode("normal");
    setSplitPosition(0.5);
  }, [objectUrl]);

  useEffect(() => {
    if (!canvas) { setCanvasRect(null); return; }
    function update() {
      const r = canvas!.getBoundingClientRect();
      setCanvasRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(canvas);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [canvas]);

  const {
    looks, activeLook, activeLookParams,
    refreshLooks, loadLook, clearLook, saveLook, createLook, deleteLook, renameLook, importLook, restoreActiveLook,
  } = useLooks();

  const hasChanges = activeLookParams !== null && Object.keys(activeLookParams).some(
    key => activeLookParams[key] !== params[key]
  );

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
    fetch("/api/schema").then(r => r.json()).then(async (groups: EffectGroup[]) => {
      setSchema(groups);
      const disableAll: Record<string, boolean> = {};
      for (const group of groups) {
        disableAll[group.enableKey] = true;
      }
      // Honor any initial look passed via ?look= (e.g. from /compare → Edit).
      try {
        const lookPath = new URLSearchParams(window.location.search).get("look");
        const lookName = lookPath?.split("/").pop()?.replace(/\.hlook$/, "") ?? null;
        if (lookName) {
          const lookParams = await loadLook(lookName);
          setParams(lookParams);
          history.replace({ params: lookParams, activeLook: lookName });
          return;
        }
      } catch {}
      setParams(disableAll);
      history.replace({ params: disableAll, activeLook: null });
    });
    refreshLooks();
  }, []);

  const leftPanel = useResizable({ defaultSize: 240, minSize: 200, maxSize: 400, direction: "horizontal" });
  const rightPanel = useResizable({ defaultSize: 350, minSize: 250, maxSize: 500, direction: "horizontal", reverse: true });
  const bottomPanel = useResizable({ defaultSize: 180, minSize: 100, maxSize: 250, direction: "vertical", reverse: true });

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

  const handleReset = useCallback(() => {
    if (!activeLookParams) return;
    setAnimating(true);
    setParams(activeLookParams);
    setTimeout(() => setAnimating(false), 350);
    historyRef.current.commit({ params: activeLookParams, activeLook: activeLookRef.current });
  }, [activeLookParams]);

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

  const handleExport = useCallback(async (opts: { codec: string; crf: number; outputPath: string }) => {
    if (!file) return;
    setShowExportModal(false);
    setExportProgress({ state: "uploading", progress: 0, downloadUrl: null, error: null });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("params", JSON.stringify(params));
    formData.append("codec", opts.codec);
    formData.append("crf", String(opts.crf));
    formData.append("outputName", opts.outputPath);
    try {
      const res = await fetch("/api/export", { method: "POST", body: formData });
      setExportProgress(p => ({ ...p, state: "rendering" }));
      await consumeSSE(res, {
        onProgress: (p) => setExportProgress(prev => ({ ...prev, progress: p })),
        onDone: (data) => {
          const url = data.downloadUrl as string;
          setExportProgress({ state: "done", progress: 1, downloadUrl: url, error: null });
          const a = document.createElement("a");
          a.href = url;
          a.download = opts.outputPath;
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        onError: (msg) => setExportProgress({ state: "error", progress: 0, downloadUrl: null, error: msg }),
      });
    } catch (err) {
      setExportProgress({ state: "error", progress: 0, downloadUrl: null, error: (err as Error).message });
    }
  }, [file, params]);

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
      <div className="h-screen flex flex-col bg-zinc-950 relative">
        <TopBar
          filename={null}
          file={null}
          params={params}
          canvas={null}
          renderer={null}
          isVideo={false}
          hasChanges={false}
          onSave={() => {}}
          onSaveAsNew={() => {}}
          onExportClick={() => {}}
        />
        <UploadZone onFile={upload} />
        {uploadError && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-8 flex items-center gap-3 bg-zinc-900 border border-danger/50 px-4 py-2 rounded-md text-xs text-danger">
            <span>{uploadError}</span>
            <button onClick={clearError} className="text-zinc-400 hover:text-zinc-200">×</button>
          </div>
        )}
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
        hasChanges={hasChanges}
        onSave={handleSave}
        onSaveAsNew={handleSaveAsNew}
        onExportClick={() => setShowExportModal(true)}
        exportProgress={exportProgress}
        onExportDone={() => setExportProgress({ state: "idle", progress: 0, downloadUrl: null, error: null })}
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
        <div className="flex-1 flex items-center justify-center p-4 min-w-0 relative">
          {file && (
            <>
              <ViewModeToolbar
                mode={viewMode}
                onChange={setViewMode}
                splitDisabled={!file}
                referenceDisabled={false}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                onUndo={() => applySnapshot(historyRef.current.undo())}
                onRedo={() => applySnapshot(historyRef.current.redo())}
              />
            </>
          )}
          {previewError && isVideo ? (
            <div className="flex flex-col items-center gap-4 max-w-md text-center p-6 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="text-sm text-zinc-200">
                This codec isn't supported by the browser preview.
              </div>
              <div className="text-xs text-zinc-500">
                Transcode to H.264 for preview. Export will still use the original file.
              </div>
              {proxyState === "idle" && (
                <button
                  onClick={startTranscode}
                  className="px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover transition-colors"
                >
                  Transcode to H.264
                </button>
              )}
              {(proxyState === "uploading" || proxyState === "transcoding") && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <span className="text-xs text-zinc-400">
                    {proxyState === "uploading" ? "Uploading..." : `${Math.round(proxyProgress * 100)}%`}
                  </span>
                  <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-[width] duration-200"
                      style={{ width: `${proxyProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {proxyState === "error" && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-danger">{proxyErrorMsg}</span>
                  <button
                    onClick={startTranscode}
                    className="px-3 py-1 bg-zinc-700 text-zinc-200 text-xs rounded-md hover:bg-zinc-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Canvas
              src={previewSrc!}
              isVideo={isVideo}
              params={params}
              onRendererReady={handleRendererReady}
              onCanvasReady={handleCanvasReady}
              onVideoReady={handleVideoReady}
              onError={setPreviewError}
            />
          )}
        </div>

        <ResizeDivider direction="horizontal" onMouseDown={rightPanel.onMouseDown} />

        {/* Right panel — Adjustments */}
        <div className="flex-shrink-0 bg-zinc-900 overflow-hidden" style={{ width: rightPanel.size }}>
          <AdjustmentsPanel
            schema={schema}
            values={params}
            onChange={handleParamChange}
            onCommit={commitHistory}
            onReset={handleReset}
            canReset={hasChanges}
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

      {showExportModal && file && (
        <ExportModal
          defaultBasename={file.name.replace(/\.[^.]+$/, "")}
          onCancel={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      {viewMode === "split" && previewSrc && canvasRect && (
        <CompareOverlay
          mode="split"
          position={splitPosition}
          onPositionChange={setSplitPosition}
          overlaySrc={previewSrc}
          isVideo={isVideo}
          videoRef={videoElement}
          canvasRect={canvasRect}
        />
      )}
      {viewMode === "reference" && !referenceImage && canvasRect && (
        <div
          className="absolute bg-zinc-900/90 border border-zinc-700 px-4 py-3 z-30 flex flex-col items-center gap-2 rounded-md"
          style={{
            left: canvasRect.left + canvasRect.width / 2 - 110,
            top: canvasRect.top + canvasRect.height / 2 - 30,
          }}
        >
          <div className="text-xs text-zinc-300">Upload a reference image</div>
          <button
            onClick={chooseReferenceImage}
            className="text-xs text-white bg-accent hover:bg-accent-hover rounded-sm p-btn"
          >Choose image…</button>
        </div>
      )}
      {viewMode === "reference" && referenceImage && canvasRect && (
        <>
          <CompareOverlay
            mode="reference"
            position={splitPosition}
            onPositionChange={setSplitPosition}
            overlaySrc={referenceImage}
            isVideo={false}
            canvasRect={canvasRect}
          />
          <button
            onClick={() => setReferenceImage(null)}
            className="absolute text-[11px] text-zinc-300 bg-zinc-800/90 border border-zinc-700 hover:bg-zinc-700 z-30 rounded-sm px-2.5 py-1"
            style={{
              right: `calc(100vw - ${canvasRect.left + canvasRect.width}px + 8px)`,
              top: canvasRect.top + 8,
            }}
          >Replace reference</button>
        </>
      )}
    </div>
  );
}
