import { useState } from "react";
import type { EffectGroup as EffectGroupType, OptionDef } from "@hancer/core";
import { RangeSlider } from "./RangeSlider";
import { Toggle } from "./Toggle";
import { SelectControl } from "./SelectControl";

interface Props {
  group: EffectGroupType;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  animating: boolean;
}

export function EffectGroup({ group, values, onChange, animating }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const enabled = values[group.enableKey] !== true;

  return (
    <div className="border-b border-zinc-800 pb-2 mb-2">
      <div
        className="flex items-center justify-between py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] text-zinc-500 transition-transform ${collapsed ? "" : "rotate-90"}`}>
            ▶
          </span>
          <span className="text-xs font-semibold text-zinc-200">{group.label}</span>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange(group.enableKey, !e.target.checked)}
        />
      </div>
      {!collapsed && (
        <div className={`flex flex-col gap-2 pl-4 pt-1 ${!enabled ? "opacity-40 pointer-events-none" : ""}`}>
          {group.options.map(opt => (
            <OptionControl
              key={opt.key}
              opt={opt}
              value={values[opt.key] ?? opt.default}
              onChange={v => onChange(opt.key, v)}
              disabled={!enabled}
              animating={animating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OptionControl({ opt, value, onChange, disabled, animating }: {
  opt: OptionDef;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  disabled: boolean;
  animating: boolean;
}) {
  if (opt.type === "range") {
    return (
      <RangeSlider
        label={opt.label}
        value={typeof value === "number" ? value : opt.default}
        min={opt.min}
        max={opt.max}
        step={opt.step}
        onChange={onChange}
        disabled={disabled}
        animating={animating}
      />
    );
  }

  if (opt.type === "boolean") {
    return (
      <Toggle
        label={opt.label}
        checked={typeof value === "boolean" ? value : opt.default}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (opt.type === "select") {
    return (
      <SelectControl
        label={opt.label}
        value={typeof value === "string" ? value : opt.default}
        choices={opt.choices}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  return null;
}
