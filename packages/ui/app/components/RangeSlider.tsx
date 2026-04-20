import { useState, useRef } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
  animating?: boolean;
}

export function RangeSlider({ label, value, min, max, step, onChange, onCommit, disabled, animating }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditing(true);
    setEditValue(String(value));
    // Focus after React renders the input
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commitEdit() {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      onCommit?.();
    }
    setEditing(false);
  }

  // Calculate fill percentage for the blue active portion
  const fillPercent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col text-xs py-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 truncate">{label}</span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
            className="w-14 text-right bg-zinc-800 border border-zinc-600 rounded-sm px-1 py-0.5 text-zinc-200 text-xs tabular-nums"
          />
        ) : (
          <span
            onClick={startEdit}
            className="text-right text-zinc-500 tabular-nums cursor-text hover:text-zinc-300"
          >
            {value}
          </span>
        )}
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute inset-x-0 h-px bg-slider-track" />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onPointerUp={() => onCommit?.()}
          onKeyUp={e => {
            const k = e.key;
            if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown" || k === "PageUp" || k === "PageDown" || k === "Home" || k === "End") onCommit?.();
          }}
          className={`absolute inset-0 w-full opacity-0 cursor-pointer ${animating ? "animating" : ""}`}
        />
        <div
          className={`absolute w-2.5 h-2.5 rounded-full pointer-events-none bg-slider-thumb ${animating ? "transition-all duration-300 ease-out" : ""}`}
          style={{ left: `calc(${fillPercent}% - 5px)` }}
        />
      </div>
    </div>
  );
}
