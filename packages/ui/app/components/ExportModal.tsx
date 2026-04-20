import { useState } from "react";

export type Codec = "H.264" | "H.265" | "ProRes 422";
export type Quality = "Visually Lossless" | "High" | "Medium" | "Low";

export interface ExportOptions {
  codec: Codec;
  crf: number;
  outputPath: string;
}

export function crfForQuality(q: Quality): number {
  switch (q) {
    case "Visually Lossless": return 17;
    case "High": return 20;
    case "Medium": return 23;
    case "Low": return 28;
  }
}

export function extForCodec(codec: Codec): "mp4" | "mov" {
  return codec === "ProRes 422" ? "mov" : "mp4";
}

interface Props {
  defaultBasename: string;
  onCancel: () => void;
  onExport: (opts: ExportOptions) => void;
}

export function ExportModal({ defaultBasename, onCancel, onExport }: Props) {
  const [codec, setCodec] = useState<Codec>("H.264");
  const [quality, setQuality] = useState<Quality>("Medium");
  const [outputPath, setOutputPath] = useState<string>(
    `${defaultBasename}_hance.${extForCodec("H.264")}`
  );

  function onCodecChange(next: Codec) {
    setCodec(next);
    setOutputPath(prev => prev.replace(/\.(mp4|mov)$/i, `.${extForCodec(next)}`));
  }

  function onChooseFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp4,.mov";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) setOutputPath(f.name);
    };
    input.click();
  }

  function submit() {
    onExport({ codec, crf: crfForQuality(quality), outputPath });
  }

  const isProRes = codec === "ProRes 422";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-zinc-800 border border-zinc-700 max-w-md w-full mx-4 shadow-2xl rounded-md p-modal"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-5">Export</h3>

        <div className="flex flex-col gap-5 text-xs">
          <div>
            <div className="text-zinc-400 mb-1.5">Codec</div>
            <select
              value={codec}
              onChange={e => onCodecChange(e.target.value as Codec)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5 rounded-sm"
            >
              <option>H.264</option>
              <option>H.265</option>
              <option>ProRes 422</option>
            </select>
          </div>

          <div>
            <div className="text-zinc-400 mb-1.5">Quality</div>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value as Quality)}
              disabled={isProRes}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5 rounded-sm disabled:opacity-50"
            >
              <option>Visually Lossless</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            {isProRes && (
              <div className="text-zinc-500 text-[11px] mt-1">ProRes uses its own profile; quality selection disabled.</div>
            )}
          </div>

          <div>
            <div className="text-zinc-400 mb-1.5">Output path</div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={outputPath}
                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5 rounded-sm"
              />
              <button
                onClick={onChooseFile}
                className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors rounded-sm p-btn"
              >
                Choose…
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors rounded-sm p-btn"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="text-xs text-white bg-accent hover:bg-accent-hover transition-colors rounded-sm p-btn-primary"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
