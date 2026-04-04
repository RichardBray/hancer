import { useState, useRef, useCallback } from "react";
import { LookCard } from "./LookCard";
import { LookContextMenu } from "./LookContextMenu";
import { NewLookModal } from "./NewLookModal";
import { DeleteLookModal } from "./DeleteLookModal";
import type { LookMeta } from "../hooks/useLooks";

interface Props {
  looks: LookMeta[];
  activeLook: string | null;
  onSelect: (name: string) => void;
  onHover: (name: string) => void;
  onHoverEnd: () => void;
  onCreateLook: (name: string, metadata: { description: string; keywords: string[]; characteristics: string[] }) => void;
  onDeleteLook: (name: string) => void;
  onRenameLook: (oldName: string, newName: string) => void;
  onImportLook: (file: File) => void;
}

export function LooksPanel({
  looks, activeLook, onSelect, onHover, onHoverEnd,
  onCreateLook, onDeleteLook, onRenameLook, onImportLook,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; name: string } | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingLook, setDeletingLook] = useState<string | null>(null);
  const [renamingLook, setRenamingLook] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, name: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, name });
  }, []);

  const handleImport = useCallback(() => {
    importRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportLook(file);
      e.target.value = "";
    }
  }, [onImportLook]);

  const startRename = useCallback((name: string) => {
    setRenamingLook(name);
    setRenameValue(name);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingLook && renameValue.trim() && renameValue.trim() !== renamingLook) {
      onRenameLook(renamingLook, renameValue.trim());
    }
    setRenamingLook(null);
  }, [renamingLook, renameValue, onRenameLook]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Looks</h2>
        <div className="flex gap-1">
          <button
            onClick={handleImport}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Import .hlook file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Create new look"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {looks.map(look => (
            <div key={look.name}>
              {renamingLook === look.name ? (
                <div className="rounded-lg border-2 border-accent overflow-hidden">
                  <div className="aspect-square bg-zinc-800">
                    <img src={look.thumbnailUrl} alt={look.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-1.5 py-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingLook(null); }}
                      className="w-full bg-zinc-900 border border-zinc-600 rounded px-1 py-0.5 text-[11px] text-zinc-200 focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <LookCard
                  name={look.name}
                  thumbnailUrl={look.thumbnailUrl}
                  isActive={activeLook === look.name}
                  onSelect={() => onSelect(look.name)}
                  onHover={() => onHover(look.name)}
                  onHoverEnd={onHoverEnd}
                  onContextMenu={e => handleContextMenu(e, look.name)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <input ref={importRef} type="file" accept=".hlook" className="hidden" onChange={handleImportFile} />

      {contextMenu && (
        <LookContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => startRename(contextMenu.name)}
          onDelete={() => setDeletingLook(contextMenu.name)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showNewModal && (
        <NewLookModal
          onSubmit={(name, metadata) => { onCreateLook(name, metadata); setShowNewModal(false); }}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {deletingLook && (
        <DeleteLookModal
          lookName={deletingLook}
          onConfirm={() => { onDeleteLook(deletingLook); setDeletingLook(null); }}
          onCancel={() => setDeletingLook(null)}
        />
      )}
    </div>
  );
}
