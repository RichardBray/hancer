interface Props {
  direction: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeDivider({ direction, onMouseDown }: Props) {
  const isHorizontal = direction === "horizontal";
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        flex-shrink-0 bg-transparent hover:bg-zinc-600 transition-colors
        ${isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"}
      `}
    />
  );
}
