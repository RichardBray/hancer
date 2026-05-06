import { useState, memo } from "react";
import type { EffectGroup as EffectGroupType, OptionDef } from "@hance/core";
import { RangeSlider } from "./RangeSlider";
import { Toggle } from "./Toggle";
import { SelectControl } from "./SelectControl";

interface Props {
  group: EffectGroupType;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onCommit: () => void;
  animating: boolean;
}

function shallowEqualValues(a: Record<string, string | number | boolean>, b: Record<string, string | number | boolean>): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export const EffectGroup = memo(function EffectGroup({ group, values, onChange, onCommit, animating }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const enabled = values[group.enableKey] !== true;

  return (
    <div>
      <div
        className="flex items-center justify-between py-2 cursor-pointer select-none"
        style={{ paddingTop: "1.2rem" }}
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
          onChange={e => { onChange(group.enableKey, !e.target.checked); onCommit(); }}
        />
      </div>
      {!collapsed && (
        <div className={`flex flex-col pl-2 ${!enabled ? "opacity-40 pointer-events-none" : ""}`}>
          {group.options.map(opt => (
            <OptionControl
              key={opt.key}
              opt={opt}
              value={values[opt.key] ?? opt.default}
              onChange={v => onChange(opt.key, v)}
              onCommit={onCommit}
              disabled={!enabled}
              animating={animating}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.group === next.group &&
  prev.onChange === next.onChange &&
  prev.onCommit === next.onCommit &&
  prev.animating === next.animating &&
  shallowEqualValues(prev.values, next.values)
);

function OptionControl({ opt, value, onChange, onCommit, disabled, animating }: {
  opt: OptionDef;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  onCommit: () => void;
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
        onCommit={onCommit}
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
        onChange={v => { onChange(v); onCommit(); }}
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
        onChange={v => { onChange(v); onCommit(); }}
        disabled={disabled}
      />
    );
  }

  return null;
}
