import type { EffectGroup as EffectGroupType, OptionDef } from "@hancer/core";

interface Props {
  group: EffectGroupType;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
}

function OptionControl({ opt, value, onChange }: { opt: OptionDef; value: string | number | boolean; onChange: (v: string | number | boolean) => void }) {
  if (opt.type === "range") {
    const numVal = typeof value === "number" ? value : opt.default;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>{opt.label}</span>
          <span style={{ opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>{numVal}</span>
        </div>
        <input
          type="range"
          min={opt.min}
          max={opt.max}
          step={opt.step}
          value={numVal}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  if (opt.type === "select") {
    const strVal = typeof value === "string" ? value : opt.default;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ opacity: 0.7 }}>{opt.label}</span>
        <select
          value={strVal}
          onChange={e => onChange(e.target.value)}
          style={{ background: "#1a1a1a", color: "#e0e0e0", border: "1px solid #333", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
        >
          {opt.choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    );
  }

  if (opt.type === "boolean") {
    const boolVal = typeof value === "boolean" ? value : opt.default;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ opacity: 0.7 }}>{opt.label}</span>
        <input type="checkbox" checked={boolVal} onChange={e => onChange(e.target.checked)} />
      </div>
    );
  }

  return null;
}

export function EffectGroup({ group, values, onChange }: Props) {
  const enabled = values[group.enableKey] !== true;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{group.label}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            onChange(group.enableKey, !e.target.checked);
          }}
        />
      </div>
      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
          {group.options.map(opt => (
            <OptionControl
              key={opt.key}
              opt={opt}
              value={values[opt.key] ?? opt.default}
              onChange={v => onChange(opt.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
