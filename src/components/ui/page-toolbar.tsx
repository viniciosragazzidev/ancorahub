import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Faixa de controle da página (anatomia de página, skill `interface-enxuta`):
 * abas com contagem à esquerda; busca, filtros em chips e ações da lista à direita. Uma linha só no desktop,
 * quebra no celular. O título e o CTA ficam na barra do topo (`DashboardHeader`), nunca aqui.
 */
export interface PageToolbarProps {
  tabs?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  /** Linha extra embaixo (ex.: abas de fila, chips de filtro ativo). */
  below?: React.ReactNode;
  className?: string;
}

export function PageToolbar({ tabs, filters, actions, below, className }: PageToolbarProps) {
  return (
    <div data-slot="page-toolbar" className={cn("flex flex-col gap-ds-8 border-b border-border pb-ds-8", className)}>
      <div className="flex min-w-0 flex-col gap-ds-8 lg:flex-row lg:items-center lg:justify-between">
        {tabs ? <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">{tabs}</div> : null}
        {filters || actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-ds-8 lg:justify-end">
            {filters}
            {actions}
          </div>
        ) : null}
      </div>
      {below}
    </div>
  );
}
