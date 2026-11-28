"use client";

/**
 * Últimas execuções da IA (/ia/execucoes): resumo de 24 h, filtro "Só falhas", tabela Lite paginada na URL e a gaveta
 * com "O que aconteceu", "O que fazer" e a mensagem técnica recolhida. Só leitura: nada aqui muda dado.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { aiRunPurposeLabel, aiRunStatusView, explainAiRun, formatAiRunLatency, isAiRunFailure } from "@/features/ai-qualification/ai-runs-copy";
import type { AiRunRow } from "@/features/ai-qualification/ai-runs-service";

import hub from "../../_components/ia-hub.module.css";
import { LiteHint } from "@/components/lite/page/lite-hint";

function when(value: string | null) {
  return formatLiteDate(value, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, "Sem data");
}

export function RunsWorkspace({ rows, onlyFailures, page: current, totalPages, totalItems, pageSize, summaryText }: {
  rows: AiRunRow[];
  onlyFailures: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  summaryText: string;
  failed24h: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? rows.find((row) => row.id === openId) ?? null : null;

  const go = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const columns: LiteColumn<AiRunRow>[] = [
    { id: "when", label: "Quando", nowrap: true, numeric: true, render: (row) => when(row.createdAt) },
    {
      id: "lead", label: "Lead", primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{row.leadName ?? "Sem lead"}</span>
          <span className={page.cellSub}>{aiRunPurposeLabel(row.purpose)}</span>
        </span>
      ),
    },
    { id: "model", label: "Modelo", secondary: true, render: (row) => <span className={page.muted}>{row.model}</span> },
    { id: "latency", label: "Tempo", nowrap: true, numeric: true, render: (row) => formatAiRunLatency(row.latencyMs) },
    {
      id: "status", label: "Situação", nowrap: true, phonePriority: "high",
      render: (row) => { const view = aiRunStatusView(row.status); return <span className={page.badge} data-tone={view.tone}>{view.label}</span>; },
    },
  ];

  const explanation = open ? explainAiRun(open) : null;

  return (
    <>
      <section className={page.group} aria-labelledby="ia-runs-title">
        <header className={page.cardHead}>
          <h2 id="ia-runs-title" className={page.cardTitle}>Últimas execuções<LiteHint text="Cada vez que a IA foi chamada, com o tempo e a situação. Use Só falhas para ver o que deu errado." /></h2>
          <p className={page.cardDescription}>{summaryText}</p>
        </header>
        <LiteFilterChips
          label="Filtrar execuções"
          active={onlyFailures ? ["failures"] : []}
          onToggle={() => go({ falhas: onlyFailures ? null : "1", pagina: null })}
          chips={[{ id: "failures", label: "Só falhas" }]}
        />
        <LiteResponsiveData
          caption="Últimas execuções da IA"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowOpen={(row) => setOpenId(row.id)}
          rowTone={(row) => (isAiRunFailure(row.status) ? "warning" : undefined)}
          empty={<p className={page.emptyText}>{onlyFailures ? "Nenhuma falha registrada." : "A IA ainda não foi chamada."}</p>}
        />
        <LitePagination
          page={current}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pending={pending}
          itemNoun="execuções"
          label="Páginas das execuções"
          onPageChange={(next) => go({ pagina: next > 1 ? String(next) : null })}
        />
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) setOpenId(null); }}
        title={open ? open.leadName ?? "Execução sem lead" : "Execução"}
        description={open ? `${aiRunStatusView(open.status).label} · ${when(open.createdAt)}` : undefined}
      >
        {open && explanation ? (
          <div className={hub.drawerBody}>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>O que aconteceu</h3>
              <p className={hub.drawerText}>{explanation.title}.</p>
            </div>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>O que fazer</h3>
              <p className={hub.drawerText}>{explanation.whatToDo}</p>
              {explanation.href && open.status !== "success" ? (
                <div className={hub.drawerActions}>
                  <Link href={explanation.href} className={page.button}>{explanation.hrefLabel ?? "Abrir"}</Link>
                  {open.leadId ? <Link href={`/leads/${open.leadId}`} className={page.button}>Abrir ficha do lead</Link> : null}
                </div>
              ) : open.leadId ? (
                <div className={hub.drawerActions}>
                  <Link href={`/leads/${open.leadId}`} className={page.button}>Abrir ficha do lead</Link>
                </div>
              ) : null}
            </div>
            <dl className={hub.facts}>
              <dt>Uso</dt><dd>{aiRunPurposeLabel(open.purpose)}</dd>
              <dt>Modelo</dt><dd>{open.model}</dd>
              <dt>Tempo</dt><dd>{formatAiRunLatency(open.latencyMs)}</dd>
              <dt>Tokens</dt><dd>{open.totalTokens.toLocaleString("pt-BR")}</dd>
            </dl>
            {open.errorMessage ? (
              <details className={hub.details}>
                <summary>Mensagem técnica</summary>
                <code className={hub.code}>{open.errorMessage}</code>
              </details>
            ) : null}
          </div>
        ) : null}
      </LiteSidePanel>
    </>
  );
}
