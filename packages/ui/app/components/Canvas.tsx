import { useRef, useEffect, useCallback } from "react";
import { createRenderer, type Renderer, type PreviewParams } from "../gpu/renderer";
import { fitPreviewSize } from "../mediaSizing";

interface Props {
  src: string;
  isVideo: boolean;
  params: PreviewParams;
  onRendererReady: (renderer: Renderer) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onVideoReady?: (video: HTMLVideoElement) => void;
}

export function Canvas({ src, isVideo, params, onRendererReady, onCanvasReady, onVideoReady }: Props) {
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
        await new Promise<void>(resolve => {
          video.onloadeddata = () => resolve();
          if (video.readyState >= 2) resolve();
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
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
          if (img.complete) resolve();
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

    init();

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
        className="max-w-full max-h-[calc(100vh-140px)] rounded-lg"
      />
    </div>
  );
}
