import { EffectGroup } from "./EffectGroup";
import type { EffectGroup as EffectGroupType } from "@hance/core";

interface Props {
  schema: EffectGroupType[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onCommit: () => void;
  animating: boolean;
}

export function AdjustmentsPanel({ schema, values, onChange, onCommit, animating }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Adjustments</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {schema.map(group => (
          <EffectGroup
            key={group.key}
            group={group}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            animating={animating}
          />
        ))}
      </div>
    </div>
  );
}
