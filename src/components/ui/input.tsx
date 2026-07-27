"use client"

"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { detectFormat, applyFormat, type FormatType } from "@/shared/utils/format"

export type { FormatType };

/** Mapeia FormatType → inputMode para teclado mobile */
function inferInputMode(formatType: FormatType, explicitMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode']): React.InputHTMLAttributes<HTMLInputElement>['inputMode'] {
  if (explicitMode) return explicitMode;
  switch (formatType) {
    case "cnpj":
    case "cpf":
    case "phone":
    case "cep":
    case "rg":
    case "ie":
    case "cns":
    case "placa":
      // Placa contém letras, não usar teclado numérico
      return undefined;
    case "currency":
      return "decimal";
    case "date":
      return "numeric";
    default:
      return undefined;
  }
}

type InputProps = React.ComponentProps<"input"> & {
  /** Override explícito do formato. Se não informado, detecta pelo id/name. */
  format?: FormatType;
};

function Input({
  className,
  type,
  id,
  name,
  onChange,
  value,
  defaultValue,
  format: formatProp,
  inputMode: inputModeProp,
  ...props
}: InputProps) {
  // ── Detecção automática de formato ──────────────────────────────────────────
  // ⚠️ Inputs type="date" não podem ter formatação automática: o browser
  // espera valor em YYYY-MM-DD, mas a formatação "date" converte para DD/MM/AAAA,
  // quebrando o date picker nativo.
  const formatType = useMemo(
    () => type === "date" ? "none" : (formatProp ?? detectFormat(id, name)),
    [formatProp, id, name, type],
  );

  const needsFormatting = formatType !== "none";

  // inputMode para teclado mobile
  const inputMode = useMemo(
    () => inferInputMode(formatType, inputModeProp),
    [formatType, inputModeProp],
  );

  // Troca type="number" para "text" quando a formatação está ativa
  // (evita setinhas nativas do browser que atrapalham a digitação)
  const resolvedType = needsFormatting && type === "number" ? "text" : type;

  // ── Estado interno (modo não-controlado) ────────────────────────────────────
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (defaultValue != null && defaultValue !== "") {
      return needsFormatting
        ? applyFormat(String(defaultValue), formatType)
        : String(defaultValue);
    }
    return "";
  });

  const isControlled = value !== undefined;

  // Valor a exibir no input (sempre formatado quando aplicável)
  const displayValue = isControlled
    ? value != null
      ? needsFormatting
        ? applyFormat(String(value), formatType)
        : String(value)
      : ""
    : internalValue;

  // ── Handler de onChange ─────────────────────────────────────────────────────
  // Usa uma ref estável para o handler para evitar recriação a cada render
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!needsFormatting) {
      onChange?.(event);
      return;
    }

    // Aplica formatação ao valor digitado
    const raw = event.currentTarget.value;
    const formatted = applyFormat(raw, formatType);

    // Atualiza estado interno (modo não-controlado)
    if (!isControlled) {
      setInternalValue(formatted);
    }

    // Propaga o evento com o valor formatado
    // (Server Actions leem do DOM no submit, que já estará formatado)
    onChange?.(event);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <InputPrimitive
      data-slot="input"
      id={id}
      name={name}
      type={resolvedType}
      inputMode={inputMode}
      {...(isControlled || needsFormatting
        ? { value: displayValue }
        : { defaultValue })}
      onChange={handleChange}
      className={cn(
        "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-input bg-card px-3.5 py-2 text-sm text-foreground transition-all duration-150 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 motion-reduce:transition-none dark:bg-card dark:border-border",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
