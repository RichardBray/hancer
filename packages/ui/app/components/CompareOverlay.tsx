import { useCallback, useEffect, useRef } from "react";

interface Props {
  mode: "split" | "reference";
  position: number;
  onPositionChange: (p: number) => void;
  overlaySrc: string;
  isVideo: boolean;
  videoRef?: HTMLVideoElement | null;
  canvasRect: { left: number; top: number; width: number; height: number } | null;
}

export function CompareOverlay({ mode, position, onPositionChange, overlaySrc, isVideo, videoRef, canvasRect }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isVideo || !videoRef || !localVideoRef.current) return;
    const local = localVideoRef.current;
    function sync() {
      if (Math.abs(local.currentTime - videoRef!.currentTime) > 0.05) {
        local.currentTime = videoRef!.currentTime;
      }
      if (videoRef!.paused && !local.paused) local.pause();
      if (!videoRef!.paused && local.paused) local.play().catch(() => {});
    }
    const id = setInterval(sync, 50);
    return () => clearInterval(id);
  }, [isVideo, videoRef]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    function move(ev: MouseEvent) {
      if (!canvasRect || canvasRect.width === 0) return;
      const x = ev.clientX - canvasRect.left;
      onPositionChange(Math.max(0, Math.min(1, x / canvasRect.width)));
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [canvasRect, onPositionChange]);

  if (!canvasRect) return null;

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    left: canvasRect.left,
    top: canvasRect.top,
    width: canvasRect.width,
    height: canvasRect.height,
    clipPath: `inset(0 0 0 ${position * 100}%)`,
    pointerEvents: "none",
    objectFit: mode === "reference" ? "contain" : "fill",
    background: mode === "reference" ? "#000" : "transparent",
    zIndex: 15,
  };

  const dividerStyle: React.CSSProperties = {
    position: "absolute",
    left: canvasRect.left + canvasRect.width * position,
    top: canvasRect.top,
    height: canvasRect.height,
    transform: "translateX(-1px)",
    zIndex: 20,
  };

  return (
    <>
      {mode === "split" && isVideo ? (
        <video ref={localVideoRef} src={overlaySrc} style={overlayStyle} muted playsInline />
      ) : (
        <img src={overlaySrc} style={overlayStyle} alt="" />
      )}
      <div style={dividerStyle} className="pointer-events-auto">
        <div className="w-0.5 h-full bg-white/70" />
        <div
          onMouseDown={onMouseDown}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 rounded-full cursor-ew-resize flex items-center justify-center text-[10px] text-zinc-800 font-bold"
        >‹›</div>
      </div>
    </>
  );
}
