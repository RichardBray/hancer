interface Props {
  lookName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteLookModal({ lookName, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">Delete Look</h3>
        <p className="text-xs text-zinc-400 mb-5">
          Delete "{lookName}"? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs text-zinc-300 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs text-white bg-danger rounded-lg hover:bg-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
