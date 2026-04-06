import { useState } from "react";
import { validateLookName } from "../hooks/useLooks";

interface Props {
  onSubmit: (name: string, metadata: { description: string; keywords: string[]; characteristics: string[] }) => void;
  onCancel: () => void;
  initialName?: string;
  existingNames?: string[];
}

export function NewLookModal({ onSubmit, onCancel, initialName, existingNames = [] }: Props) {
  const [name, setName] = useState(initialName || "");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateLookName(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase())) {
      setError("A look with this name already exists");
      return;
    }
    onSubmit(name.trim(), {
      description,
      keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      characteristics: characteristics.split(",").map(c => c.trim()).filter(Boolean),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">New Look</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-accent focus:outline-none"
              autoFocus
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-200 resize-none focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="warm, cinematic, film"
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Characteristics (comma-separated)</label>
            <input
              type="text"
              value={characteristics}
              onChange={e => setCharacteristics(e.target.value)}
              placeholder="warm tones, low contrast, lifted blacks"
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-xs text-zinc-300 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
