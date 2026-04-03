import { useState, useEffect } from "react";
import { EffectGroup } from "./EffectGroup";
import type { EffectGroup as EffectGroupType } from "@hancer/core";

interface Props {
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onBatchChange: (data: Record<string, string | number | boolean>) => void;
}

export function ControlsPanel({ values, onChange, onBatchChange }: Props) {
  const [schema, setSchema] = useState<EffectGroupType[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [currentPreset, setCurrentPreset] = useState("default");
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    fetch("/api/schema").then(r => r.json()).then(setSchema);
    fetch("/api/presets").then(r => r.json()).then(setPresets);
  }, []);

  function loadPreset(name: string) {
    setCurrentPreset(name);
    fetch(`/api/preset?name=${name}`)
      .then(r => r.json())
      .then(data => {
        onBatchChange(data as Record<string, string | number | boolean>);
      });
  }

  function savePreset() {
    if (!saveName.trim()) return;
    fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveName.trim(), data: values }),
    }).then(() => {
      setPresets(prev => [...new Set([...prev, saveName.trim()])]);
      setSaveName("");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={currentPreset}
          onChange={e => loadPreset(e.target.value)}
          style={{ flex: 1, background: "#1a1a1a", color: "#e0e0e0", border: "1px solid #333", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
        >
          {presets.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        <input
          type="text"
          placeholder="Preset name"
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          style={{ flex: 1, background: "#1a1a1a", color: "#e0e0e0", border: "1px solid #333", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
        />
        <button
          onClick={savePreset}
          style={{ background: "#333", color: "#e0e0e0", border: "none", borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
        >
          Save
        </button>
      </div>

      <div style={{ height: 1, background: "#1a1a1a", margin: "4px 0" }} />

      {schema.map(group => (
        <EffectGroup
          key={group.key}
          group={group}
          values={values}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
