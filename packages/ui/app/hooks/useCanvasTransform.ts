import { useState, useCallback, useRef, type MouseEvent } from "react";

export const ZOOM_LEVELS = [25, 50, 75, 100, 150, 200] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number] | "fit";

interface CanvasTransform {
  zoom: ZoomLevel;
  pan: { x: number; y: number };
  isPanning: boolean;
  panMode: boolean;
  setZoom: (z: ZoomLevel) => void;
  setPanMode: (on: boolean) => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: () => void;
  resetPan: () => void;
}

export function useCanvasTransform(): CanvasTransform {
  const [zoom, setZoomState] = useState<ZoomLevel>("fit");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const setZoom = useCallback((z: ZoomLevel) => {
    setZoomState(z);
    setPan({ x: 0, y: 0 });
  }, []);

  const resetPan = useCallback(() => setPan({ x: 0, y: 0 }), []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!panMode) return;
    e.preventDefault();
    setIsPanning(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [panMode, pan]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStart.current) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragStart.current = null;
    setIsPanning(false);
  }, []);

  return { zoom, pan, isPanning, panMode, setZoom, setPanMode, onMouseDown, onMouseMove, onMouseUp, resetPan };
}
