interface Props {
  hasChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
}

export function SaveBar({ hasChanges, onSave, onSaveAsNew }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={hasChanges ? onSave : undefined}
        disabled={!hasChanges}
        title={hasChanges ? "Save changes to active look" : "No changes to save"}
        className={
          hasChanges
            ? "px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-sm hover:bg-accent-hover transition-colors"
            : "px-4 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-sm cursor-default"
        }
      >
        {hasChanges ? "Save" : "Saved ✓"}
      </button>
      <button
        onClick={onSaveAsNew}
        className="px-4 py-1.5 bg-zinc-700 text-zinc-200 text-xs font-medium rounded-sm hover:bg-zinc-600 transition-colors"
      >
        Save As New
      </button>
    </div>
  );
}
