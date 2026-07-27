"use client";

import { useCallback, useRef, useState } from "react";

const presets = [
  { label: "Verde", value: "#16A34A" },
  { label: "Azul", value: "#2563EB" },
  { label: "Roxo", value: "#9333EA" },
  { label: "Rosa", value: "#DB2777" },
  { label: "Laranja", value: "#EA580C" },
  { label: "Vermelho", value: "#DC2626" },
] as const;

type Props = {
  defaultValue: string | null;
  name: string;
  disabled?: boolean;
};

export function ColorPicker({ defaultValue, name, disabled = false }: Props) {
  const [color, setColor] = useState(defaultValue ?? "#16A34A");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
  }, []);

  return (
    <div className="grid gap-3">
      <input ref={inputRef} name={name} type="hidden" value={color} />
      <div className="flex items-center gap-3">
        <button
          disabled={disabled}
          type="button"
          onClick={() => inputRef.current?.click()}
          className="size-10 shrink-0 rounded-lg border border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: color }}
        />
        <input
          ref={inputRef}
          type="color"
          value={color}
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
        />
        <span className="font-mono text-sm text-muted-foreground">{color}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            disabled={disabled}
            key={preset.value}
            type="button"
            onClick={() => {
              setColor(preset.value);
              if (inputRef.current) inputRef.current.value = preset.value;
            }}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
            aria-pressed={color === preset.value}
          >
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: preset.value }}
            />
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
