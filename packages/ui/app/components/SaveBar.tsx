interface Props {
  hasChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
}

export function SaveBar({ hasChanges, onSave, onSaveAsNew }: Props) {
  if (!hasChanges) return null;

  return (
    <div className="flex gap-2 p-3 border-b border-zinc-800">
      <button
        onClick={onSave}
        className="flex-1 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded hover:bg-accent-hover transition-colors"
      >
        Save
      </button>
      <button
        onClick={onSaveAsNew}
        className="flex-1 px-3 py-1.5 bg-zinc-700 text-zinc-200 text-xs font-medium rounded hover:bg-zinc-600 transition-colors"
      >
        Save As New
      </button>
    </div>
  );
}
