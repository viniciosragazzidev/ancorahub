import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Pessoa em uma linha (skill `interface-enxuta`): iniciais numa pílula Powder Blue + nome curto ("Vinicios R.").
 * Para corretor, responsável e autor em tabelas, hover cards e drawers. Nome completo vai no `title`.
 */
export function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase("pt-BR"))
    .join("");
}

/** "Vinicios Ragazzi" → "Vinicios R."; um nome só fica como está. */
export function shortPersonName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toLocaleUpperCase("pt-BR")}.`;
}

export function PersonInitials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="person-initials"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-ds-tags bg-ds-powder-blue font-ds-inter text-[9px] font-semibold tracking-wide text-ds-electric-blue",
        className,
      )}
    >
      {personInitials(name)}
    </span>
  );
}

export interface PersonChipProps extends Omit<React.ComponentProps<"span">, "children"> {
  name: string;
  /** Mostra o nome inteiro em vez de "Nome S.". */
  fullName?: boolean;
}

export function PersonChip({ name, fullName = false, className, ...props }: PersonChipProps) {
  return (
    <span
      data-slot="person-chip"
      title={name}
      className={cn("inline-flex min-w-0 items-center gap-ds-8 text-ds-body font-medium text-ds-charcoal", className)}
      {...props}
    >
      <PersonInitials name={name} />
      <span className="truncate">{fullName ? name : shortPersonName(name)}</span>
    </span>
  );
}
