import { useState, useCallback, useRef } from "react";

interface UseResizableOptions {
  defaultSize: number;
  minSize: number;
  maxSize: number;
  direction: "horizontal" | "vertical";
  reverse?: boolean; // true for right/bottom panels where drag direction is inverted
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useResizable({ defaultSize, minSize, maxSize, direction, reverse }: UseResizableOptions) {
  const [size, setSize] = useState(defaultSize);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    startSize.current = size;

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const rawDelta = direction === "horizontal"
        ? e.clientX - startPos.current
        : e.clientY - startPos.current;
      const delta = reverse ? -rawDelta : rawDelta;
      setSize(clamp(startSize.current + delta, minSize, maxSize));
    }

    function onMouseUp() {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [size, minSize, maxSize, direction]);

  return { size, onMouseDown };
}
