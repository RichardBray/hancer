import { useRef, useEffect } from "react";
import { createRenderer, type Renderer, type PreviewParams } from "../gpu/renderer";
import { fitPreviewSize } from "../mediaSizing";

interface Props {
  src: string;
  isVideo: boolean;
  params: PreviewParams;
  onRendererReady: (renderer: Renderer) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onVideoReady?: (video: HTMLVideoElement) => void;
  onError?: (err: Error) => void;
}

export function Canvas({ src, isVideo, params, onRendererReady, onCanvasReady, onVideoReady, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const rafRef = useRef<number>(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // WebGPU init — must be useEffect since it's an async external system
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    async function init() {
      const canvas = canvasRef.current!;

      if (isVideo) {
        const video = videoRef.current!;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video load timed out after 15s — file may be corrupt or use an unsupported codec"));
          }, 15000);
          video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
          video.onerror = () => {
            clearTimeout(timeout);
            const code = video.error?.code;
            const msg = video.error?.message || "unknown error";
            reject(new Error(`Video load failed (code ${code ?? "?"}): ${msg}`));
          };
          if (video.readyState >= 2) { clearTimeout(timeout); resolve(); }
        });
        // Seek to start to ensure first frame is decoded and visible
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video seek timed out after 5s"));
          }, 5000);
          video.onseeked = () => { clearTimeout(timeout); resolve(); };
          video.currentTime = 0;
        });
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        const previewSize = fitPreviewSize(sourceWidth, sourceHeight);
        if (cancelled) return;

        const renderer = await createRenderer(canvas, {
          sourceWidth,
          sourceHeight,
          previewWidth: previewSize.width,
          previewHeight: previewSize.height,
        });
        renderer.setSource(video);
        renderer.setParams(paramsRef.current);
        rendererRef.current = renderer;
        onRendererReady(renderer);
        if (onCanvasReady) onCanvasReady(canvas);
        if (onVideoReady) onVideoReady(video);

        function renderLoop() {
          if (cancelled) return;
          renderer.renderFrame();
          rafRef.current = requestAnimationFrame(renderLoop);
        }

        renderLoop();
      } else {
        const img = imgRef.current!;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Image load timed out after 15s"));
          }, 15000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Image failed to load — file may be corrupt or use an unsupported format"));
          };
          if (img.complete && img.naturalWidth > 0) { clearTimeout(timeout); resolve(); }
        });
        const sourceWidth = img.naturalWidth;
        const sourceHeight = img.naturalHeight;
        const previewSize = fitPreviewSize(sourceWidth, sourceHeight);
        if (cancelled) return;

        const renderer = await createRenderer(canvas, {
          sourceWidth,
          sourceHeight,
          previewWidth: previewSize.width,
          previewHeight: previewSize.height,
        });
        renderer.setSource(img);
        renderer.setParams(paramsRef.current);
        renderer.renderFrame();
        rendererRef.current = renderer;
        onRendererReady(renderer);
        if (onCanvasReady) onCanvasReady(canvas);
      }
    }

    init().catch((err: Error) => { if (!cancelled) onError?.(err); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [src, isVideo]);

  // Sync params to renderer — must be useEffect since renderer is an external system
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setParams(params);
      if (!isVideo) rendererRef.current.renderFrame();
    }
  }, [params, isVideo]);

  return (
    <div className="relative flex-1 flex items-center justify-center flex-col">
      {isVideo && (
        <video
          ref={videoRef}
          src={src}
          className="hidden"
          playsInline
        />
      )}
      {!isVideo && (
        <img
          ref={imgRef}
          src={src}
          className="hidden"
        />
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-[calc(100vh-140px)]"
      />
    </div>
  );
}
