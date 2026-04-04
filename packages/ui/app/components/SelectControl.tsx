interface Props {
  label: string;
  value: string;
  choices: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectControl({ label, value, choices, onChange, disabled }: Props) {
  return (
    <div className={`flex items-center justify-between text-xs ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 text-zinc-200 border border-zinc-600 rounded px-2 py-0.5 text-xs cursor-pointer"
      >
        {choices.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
