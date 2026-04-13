import { useRef } from "react";

interface Props {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onInfo: () => void;
  onClose: () => void;
}

export function LookContextMenu({ x, y, onRename, onDelete, onInfo, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-40" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={menuRef}
        className="fixed bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 z-50 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => { onInfo(); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Info
        </button>
        <button
          onClick={() => { onRename(); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
