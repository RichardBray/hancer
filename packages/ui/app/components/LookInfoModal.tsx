import { EFFECT_SCHEMA } from "@hance/core";

interface LookInfo {
  name: string;
  description?: string;
  keywords?: string[];
  characteristics?: string[];
  params?: Record<string, string | number | boolean>;
}

interface Props {
  info: LookInfo;
  onClose: () => void;
}

const PRIMARY_KEY: Record<string, string> = {
  halation: "halation-amount",
  aberration: "aberration",
  bloom: "bloom-amount",
  grain: "grain-amount",
  vignette: "vignette-amount",
  splitTone: "split-tone-amount",
  cameraShake: "camera-shake-amount",
};

interface EffectSummary {
  label: string;
  detail: string | null;
}

function summarizeEffects(params: Record<string, string | number | boolean>): EffectSummary[] {
  const out: EffectSummary[] = [];
  for (const group of EFFECT_SCHEMA) {
    if (params[group.enableKey] === true) continue;
    const primary = PRIMARY_KEY[group.key];
    const value = primary != null ? params[primary] : undefined;
    let detail: string | null = null;
    if (typeof value === "number") {
      if (value === 0) continue;
      detail = value.toFixed(2);
    }
    out.push({ label: group.label, detail });
  }
  return out;
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(v => (
        <span
          key={v}
          className="px-2 py-0.5 bg-zinc-700 text-zinc-200 text-[11px] rounded-sm"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function EffectChips({ items }: { items: EffectSummary[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(e => (
        <span
          key={e.label}
          className="px-2 py-0.5 bg-zinc-700 text-zinc-200 text-[11px] rounded-sm"
        >
          {e.label}
          {e.detail && <span className="text-zinc-400 ml-1">{e.detail}</span>}
        </span>
      ))}
    </div>
  );
}

export function LookInfoModal({ info, onClose }: Props) {
  const hasDesc = !!info.description && info.description.trim().length > 0;
  const hasKeywords = info.keywords && info.keywords.length > 0;
  const hasChars = info.characteristics && info.characteristics.length > 0;
  const effects = info.params ? summarizeEffects(info.params) : [];
  const hasEffects = effects.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 max-w-md w-full mx-4 shadow-2xl rounded-md p-modal"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">{info.name}</h3>
        <div className="flex flex-col gap-5 text-xs">
          {hasDesc && (
            <div>
              <div className="text-zinc-400 mb-1">Description</div>
              <div className="text-zinc-200 leading-relaxed">{info.description}</div>
            </div>
          )}
          {hasEffects && (
            <div>
              <div className="text-zinc-400 mb-1.5">Effects</div>
              <EffectChips items={effects} />
            </div>
          )}
          {hasKeywords && (
            <div>
              <div className="text-zinc-400 mb-1.5">Keywords</div>
              <Chips items={info.keywords!} />
            </div>
          )}
          {hasChars && (
            <div>
              <div className="text-zinc-400 mb-1.5">Characteristics</div>
              <Chips items={info.characteristics!} />
            </div>
          )}
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors rounded-sm p-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
