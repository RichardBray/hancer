import { useState, useRef } from "react";
import pkg from "../../../../package.json";
import { LookCard } from "./LookCard";
import { LookContextMenu } from "./LookContextMenu";
import { NewLookModal } from "./NewLookModal";
import { DeleteLookModal } from "./DeleteLookModal";
import { LookInfoModal } from "./LookInfoModal";
import { ImportIcon, NoLookIcon, PlusIcon } from "./Icons";
import type { LookMeta } from "../hooks/useLooks";

interface Props {
  looks: LookMeta[];
  activeLook: string | null;
  onSelect: (name: string) => void;
  onNoLook: () => void;
  onHover: (name: string) => void;
  onHoverEnd: () => void;
  onCreateLook: (name: string, metadata: { description: string; keywords: string[]; characteristics: string[] }) => void;
  onDeleteLook: (name: string) => void;
  onRenameLook: (oldName: string, newName: string) => void;
  onImportLook: (file: File) => void;
  onGetLookInfo: (name: string) => Promise<{ name: string; description?: string; keywords?: string[]; characteristics?: string[] }>;
}

export function LooksPanel({
  looks, activeLook, onSelect, onNoLook, onHover, onHoverEnd,
  onCreateLook, onDeleteLook, onRenameLook, onImportLook, onGetLookInfo,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; name: string } | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingLook, setDeletingLook] = useState<string | null>(null);
  const [renamingLook, setRenamingLook] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [lookInfo, setLookInfo] = useState<{ name: string; description?: string; keywords?: string[]; characteristics?: string[] } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function handleContextMenu(e: React.MouseEvent, name: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, name });
  }

  function handleImport() {
    importRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onImportLook(file);
      e.target.value = "";
    }
  }

  function startRename(name: string) {
    setRenamingLook(name);
    setRenameValue(name);
  }

  function commitRename() {
    if (renamingLook && renameValue.trim() && renameValue.trim() !== renamingLook) {
      onRenameLook(renamingLook, renameValue.trim());
    }
    setRenamingLook(null);
  }

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
            <ImportIcon />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Create new look"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onNoLook}
            className={`rounded-lg overflow-hidden text-left transition-all ${
              activeLook === null
                ? "ring-2 ring-accent"
                : "ring-1 ring-zinc-700 hover:ring-zinc-500"
            }`}
          >
            <div className="aspect-square bg-zinc-800 flex items-center justify-center">
              <NoLookIcon className="w-6 h-6 text-zinc-500" />
            </div>
            <div className="px-1.5 py-1">
              <span className="text-[11px] text-zinc-400 truncate block">No Look</span>
            </div>
          </button>
          {looks.map(look => (
            <div key={look.name}>
              {renamingLook === look.name ? (
                <div className="rounded-lg border-2 border-accent overflow-hidden">
                  <div className="aspect-square bg-zinc-800">
                    {look.thumbnailUrl && (
                      <img src={look.thumbnailUrl} alt={look.name} className="w-full h-full object-cover" />
                    )}
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

      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800 text-[11px] text-zinc-500">
        <span>Hance</span>
        <span>v{pkg.version}</span>
      </div>

      <input ref={importRef} type="file" accept=".hlook" className="hidden" onChange={handleImportFile} />

      {contextMenu && (
        <LookContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => startRename(contextMenu.name)}
          onDelete={() => setDeletingLook(contextMenu.name)}
          onInfo={async () => {
            const info = await onGetLookInfo(contextMenu.name);
            setLookInfo(info);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showNewModal && (
        <NewLookModal
          onSubmit={(name, metadata) => { onCreateLook(name, metadata); setShowNewModal(false); }}
          onCancel={() => setShowNewModal(false)}
          existingNames={looks.map(l => l.name)}
        />
      )}

      {lookInfo && (
        <LookInfoModal info={lookInfo} onClose={() => setLookInfo(null)} />
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
