import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Rodapé que conta e resolve (skill `interface-enxuta`): "Mostrando 1–20 de 1.240 leads" e, quando houver,
 * o problema agregado com a ação ao lado ("4 sem resposta há 2 dias · Ver").
 */
const numberFormat = new Intl.NumberFormat("pt-BR");

export function formatShowingRange({
  page,
  pageSize,
  total,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural do item: "leads", "pessoas". */
  noun: string;
}): string {
  if (total <= 0) return `0 ${noun}`;
  const start = (Math.max(1, page) - 1) * pageSize + 1;
  const end = Math.min(total, start + pageSize - 1);
  if (start > total) return `${numberFormat.format(total)} ${noun}`;
  return `Mostrando ${numberFormat.format(start)}–${numberFormat.format(end)} de ${numberFormat.format(total)} ${noun}`;
}

export interface PageFooterSummaryProps {
  children: React.ReactNode;
  /** Ação que resolve o problema contado ("Ver", "Distribuir agora"). */
  action?: React.ReactNode;
  className?: string;
}

export function PageFooterSummary({ children, action, className }: PageFooterSummaryProps) {
  return (
    <p
      data-slot="page-footer-summary"
      className={cn("flex min-w-0 flex-wrap items-center gap-x-ds-8 text-xs tabular-nums text-muted-foreground", className)}
    >
      <span className="min-w-0 truncate">{children}</span>
      {action ? (
        <>
          <span aria-hidden>·</span>
          {action}
        </>
      ) : null}
    </p>
  );
}
