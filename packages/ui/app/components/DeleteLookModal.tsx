interface Props {
  lookName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteLookModal({ lookName, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-zinc-800 border border-zinc-700 max-w-sm w-full mx-4 shadow-2xl rounded-md p-modal"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">Delete Look</h3>
        <p className="text-xs text-zinc-400 mb-5">
          Delete "{lookName}"? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors rounded-sm p-btn"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-xs text-white bg-danger hover:bg-red-500 transition-colors rounded-sm p-btn"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
