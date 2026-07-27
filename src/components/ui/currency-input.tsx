"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CurrencyInputProps = {
  /** Valor em reais (ex: "1500" para R$ 1.500,00) */
  value: string;
  /** Recebe o valor limpo em reais (ex: "1500" para R$1.500,00) */
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  required?: boolean;
  "aria-label"?: string;
};

/**
 * Formata dígitos brutos de centavos (ex: "150000") em "1.500,00".
 * Retorna string vazia se não houver dígitos.
 */
function formatDigits(digits: string): string {
  if (!digits) return "";
  const num = Math.round(parseInt(digits, 10)) / 100;
  if (!isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Campo de input preparado para valores monetários em Real (BRL).
 *
 * - Prefixo fixo "R$" à esquerda, sempre visível
 * - O cursor permanece posicionado corretamente durante a digitação
 * - Valor gerenciado externamente em reais (ex: "1500" = R$ 1.500,00)
 *
 * Internamente converte reais → centavos para formatação visual
 * e centavos → reais ao propagar mudanças.
 *
 * @example
 * ```tsx
 * const [valor, setValor] = useState("");
 * <CurrencyInput value={valor} onChange={setValor} placeholder="0,00" />
 * ```
 */
export function CurrencyInput({
  value,
  onChange,
  className,
  placeholder = "0,00",
  disabled,
  id,
  name,
  required,
  ["aria-label"]: ariaLabel,
}: CurrencyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Converte reais → centavos: "1500" → "150000"
  const centavos = value
    ? String(Math.round(Number(value) * 100))
    : "";

  // Valor de exibição: "1.500,00" (sem prefixo R$)
  const displayValue = formatDigits(centavos);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Extrai apenas dígitos do que foi digitado
    const digits = event.target.value.replace(/\D/g, "");

    // Converte centavos → reais: "150000" → "1500"
    const reais = digits
      ? String(Math.round(parseInt(digits, 10)) / 100)
      : "";

    onChange(reais);
  }

  // Restaura o cursor para o final do texto após o valor ser atualizado
  // Essencial para evitar que o cursor pule para trás durante a digitação
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement !== input) return;

    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }, [displayValue]);

  return (
    <div className="relative">
      <span
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground",
          disabled && "opacity-50",
        )}
        aria-hidden="true"
      >
        R$
      </span>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-8 pr-2.5 py-1 text-sm",
          "transition-[background-color,border-color,box-shadow] outline-none",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "dark:bg-input/30 dark:disabled:bg-input/80",
          "motion-reduce:transition-none",
          className,
        )}
      />
    </div>
  );
}
