export type ViewMode = "normal" | "split" | "reference";

interface Props {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  referenceDisabled?: boolean;
  splitDisabled?: boolean;
}

function IconNormal() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /></svg>;
}
function IconSplit() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.25" /></svg>;
}
function IconReference() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.25" /><path d="M10.5 7.5l1.5 1.5 1.5-1.5" stroke="currentColor" strokeWidth="1.25" fill="none" /></svg>;
}

export function ViewModeToolbar({ mode, onChange, referenceDisabled, splitDisabled }: Props) {
  const base = "p-1.5 transition-colors";
  const active = "text-zinc-100 bg-zinc-700";
  const idle = "text-zinc-400 hover:text-zinc-200";
  const disabled = "text-zinc-600 cursor-not-allowed";
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 z-20"
      style={{ borderRadius: "var(--radius-sm)", padding: "4px 6px" }}
    >
      <button
        onClick={() => onChange("normal")}
        className={`${base} ${mode === "normal" ? active : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Normal view"
      ><IconNormal /></button>
      <button
        onClick={() => !splitDisabled && onChange("split")}
        disabled={splitDisabled}
        className={`${base} ${mode === "split" ? active : splitDisabled ? disabled : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Split compare"
      ><IconSplit /></button>
      <button
        onClick={() => !referenceDisabled && onChange("reference")}
        disabled={referenceDisabled}
        className={`${base} ${mode === "reference" ? active : referenceDisabled ? disabled : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Reference compare"
      ><IconReference /></button>
    </div>
  );
}
