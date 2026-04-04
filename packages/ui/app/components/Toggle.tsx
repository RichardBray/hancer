interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: Props) {
  return (
    <div className={`flex items-center justify-between text-xs ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="text-zinc-400">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
    </div>
  );
}
