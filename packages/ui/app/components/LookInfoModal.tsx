interface LookInfo {
  name: string;
  description?: string;
  keywords?: string[];
  characteristics?: string[];
}

interface Props {
  info: LookInfo;
  onClose: () => void;
}

export function LookInfoModal({ info, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">{info.name}</h3>
        <div className="flex flex-col gap-2 text-xs">
          {info.description && (
            <div>
              <span className="text-zinc-400">Description: </span>
              <span className="text-zinc-200">{info.description}</span>
            </div>
          )}
          {info.keywords && info.keywords.length > 0 && (
            <div>
              <span className="text-zinc-400">Keywords: </span>
              <span className="text-zinc-200">{info.keywords.join(", ")}</span>
            </div>
          )}
          {info.characteristics && info.characteristics.length > 0 && (
            <div>
              <span className="text-zinc-400">Characteristics: </span>
              <span className="text-zinc-200">{info.characteristics.join(", ")}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-300 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
