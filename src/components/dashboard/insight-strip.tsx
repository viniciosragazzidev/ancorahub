import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * InsightStrip — a faixa de leitura em frase (plano de movimento de 18/11/2026, etapa 1; inspirada no
 * bloco "Sugestões" da referência). É o Callout neutro do design system: Paper Mist, borda fina,
 * radius de card, sem sombra. Só o rótulo e os números citados levam o azul (`InsightValue`).
 *
 * O rótulo diz de onde vem a frase. Use "Sugestões • Âncora IA" só quando o texto vem da IA;
 * frase calculada pelo sistema leva um rótulo próprio ("Destaques", "Em resumo"…).
 */
export const AI_INSIGHT_LABEL = "Sugestões • Âncora IA";

export function InsightStrip({
  label,
  children,
  action,
  className,
  live = false,
}: {
  label: string;
  /** Uma frase (`<p>`) ou uma lista curta (`<ul>`). */
  children: ReactNode;
  /** Ação secundária opcional à direita (nunca o CTA primário da tela). */
  action?: ReactNode;
  className?: string;
  /** Anuncia mudanças para leitor de tela (`role="status"`), quando o texto atualiza com a tela aberta. */
  live?: boolean;
}) {
  return (
    <section
      data-slot="insight-strip"
      role={live ? "status" : undefined}
      aria-label={label}
      className={cn(
        "flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border bg-ds-paper-mist px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ds-electric-blue">{label}</p>
        <div className="mt-1 text-sm leading-6 text-foreground [&_li+li]:mt-1">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

/** Número ou termo citado dentro da frase: azul, peso médio, dígitos alinhados. */
export function InsightValue({ children }: { children: ReactNode }) {
  return <strong className="font-medium tabular-nums text-ds-electric-blue">{children}</strong>;
}
