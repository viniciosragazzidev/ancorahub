import type { ReactNode } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { formatCents, type FinancialKind } from "../contracts";
import type { getFinancialEntries, getFinanceSelectors } from "../finance";
import { ErpPage } from "../ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpPrimaryAction, ErpSearch, ErpStats, ErpToolbar, ErpUrlFilter } from "../ui/erp-kit";
import { ENTRY_STATUS_OPTIONS } from "./ledger-filters";
import { FinanceLedger } from "./finance-workspace";
import hero from "./finance-hero.module.css";

type Entries = Awaited<ReturnType<typeof getFinancialEntries>>;
type Branches = Awaited<ReturnType<typeof getFinanceSelectors>>["branches"];
type Tile = { label: string; value: string; hint: string };

/** Which numbers the screen leads with. Agency screens show money in and out; the broker sees his own commissions. */
export type LedgerFocus = "all" | "receivables" | "expenses";

function tiles(data: Entries, focus: LedgerFocus): Tile[] {
  const { summary } = data;
  const toReview = { label: "A conferir", value: summary.toReview.toLocaleString("pt-BR"), hint: "aguardando outra pessoa" };
  if (!data.agency) return [
    { label: "Comissões aprovadas", value: formatCents(summary.approvedCents), hint: "valor conferido" },
    { label: "Já recebido", value: formatCents(summary.settledCents), hint: "pagamentos confirmados" },
    { label: "A receber", value: formatCents(summary.payableCents), hint: "aprovado e ainda em aberto" },
  ];
  if (focus === "receivables") return [toReview,
    { label: "A receber", value: formatCents(summary.receivableCents), hint: "aprovado e ainda em aberto" },
    { label: "Recebido", value: formatCents(summary.settledCents), hint: "liquidações confirmadas" },
    { label: "Aprovado", value: formatCents(summary.approvedCents), hint: "valor conferido no filtro" }];
  if (focus === "expenses") return [toReview,
    { label: "A pagar", value: formatCents(summary.payableCents), hint: "aprovado e ainda em aberto" },
    { label: "Pago", value: formatCents(summary.settledCents), hint: "liquidações confirmadas" },
    { label: "Aprovado", value: formatCents(summary.approvedCents), hint: "valor conferido no filtro" }];
  return [toReview,
    { label: "A receber", value: formatCents(summary.receivableCents), hint: "recebíveis em aberto" },
    { label: "A pagar", value: formatCents(summary.payableCents), hint: "comissões, despesas e adiantamentos" },
    { label: "Liquidado", value: formatCents(summary.settledCents), hint: "movimentos confirmados" }];
}

/**
 * "Meu financeiro" do corretor, no desenho do card de nível da Minha jornada: o que ainda vai receber em destaque,
 * a barra do que já caiu do total aprovado e a faixa aprovado, recebido e quantidade de lançamentos.
 */
function BrokerFinanceHero({ data }: { data: Entries }) {
  const { approvedCents, settledCents, payableCents } = data.summary;
  const share = approvedCents > 0 ? Math.min(100, Math.round((settledCents / approvedCents) * 100)) : 0;
  return <section className={hero.hero} aria-label="Resumo das suas comissões">
    <div className={hero.top}>
      <p className={hero.amount}>{formatCents(payableCents)}<small>a receber</small></p>
      {approvedCents > 0 ? <div className={hero.progress}>
        <div className={hero.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label="Parte do aprovado que já foi recebida">
          <span className={hero.barFill} style={{ width: `${share}%` }} />
        </div>
        <span className={hero.progressText}><strong>{share}%</strong> do aprovado já caiu na sua conta</span>
      </div> : <span className={hero.progressText}>Assim que uma comissão for aprovada, ela aparece aqui.</span>}
    </div>
    <dl className={hero.stats}>
      <div className={hero.stat} data-tone="approved">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5zm-1.2 13.2 5.7-5.7-1.4-1.4-4.3 4.3-2.1-2.1-1.4 1.4z" fill="currentColor" /></svg>
        <dt>Aprovado</dt>
        <dd>{formatCents(approvedCents)}</dd>
      </div>
      <div className={hero.stat} data-tone="received">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4.2-4.2 1.4-1.4 2.8 2.8 5.8-5.8 1.4 1.4z" fill="currentColor" /></svg>
        <dt>Recebido</dt>
        <dd>{formatCents(settledCents)}</dd>
      </div>
      <div className={hero.stat} data-tone="count">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3C7 3 3 4.6 3 6.5v11C3 19.4 7 21 12 21s9-1.6 9-3.5v-11C21 4.6 17 3 12 3zm0 2c4.1 0 7 1.2 7 1.5S16.1 8 12 8 5 6.8 5 6.5 7.9 5 12 5zm0 14c-4.1 0-7-1.2-7-1.5v-2.3C6.6 16.4 9.1 17 12 17s5.4-.6 7-1.8v2.3c0 .3-2.9 1.5-7 1.5zm0-4c-4.1 0-7-1.2-7-1.5v-2.3C6.6 12.4 9.1 13 12 13s5.4-.6 7-1.8v2.3c0 .3-2.9 1.5-7 1.5z" fill="currentColor" /></svg>
        <dt>Lançamentos</dt>
        <dd>{data.total.toLocaleString("pt-BR")}</dd>
      </div>
    </dl>
  </section>;
}

/**
 * One ledger screen (Lançamentos, Recebíveis, Despesas): header with "Como funciona" and the single CTA, the numbers
 * of the filter, the filter bar (search, type, state, month) and the table. Same order as /clientes and /equipe.
 */
export function FinanceLedgerPage({ pathname, title, data, branches, focus, defaultKind, kindFilter, help, listTitle, emptyTitle, emptyText }: {
  pathname: string; title: string; data: Entries; branches: Branches | null; focus: LedgerFocus; defaultKind: FinancialKind;
  /** Type filter; omitted when the screen is a single type. */
  kindFilter?: { value: string; defaultValue: string; options: { value: string; label: string }[] };
  help: ReactNode; listTitle: string; emptyTitle?: string; emptyText: string;
}) {
  const actions = <ErpHeaderActions>
    <ErpHelp title={`Como funciona: ${title}`}>{help}</ErpHelp>
    {data.canPrepare && branches ? <ErpPrimaryAction label="Novo lançamento" /> : null}
  </ErpHeaderActions>;
  return <ErpPage pathname={pathname} breadcrumb="Financeiro" title={title} actions={actions}>
    {data.agency
      ? <ErpStats>{tiles(data, focus).map((tile) => <StatCard key={tile.label} label={tile.label} value={tile.value} sublabel={tile.hint} />)}</ErpStats>
      : <BrokerFinanceHero data={data} />}
    <ErpToolbar>
      <ErpSearch label="Buscar lançamento" placeholder={data.agency ? "Buscar descrição, referência ou pessoa" : "Buscar cliente ou referência"} value={data.filters.q} />
      {kindFilter ? <ErpUrlFilter label="Tipo" param="kind" value={kindFilter.value} defaultValue={kindFilter.defaultValue} options={kindFilter.options} /> : null}
      {/* O corretor só vê o que já foi aprovado: o filtro de estado não muda nada para ele. */}
      {data.agency ? <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={ENTRY_STATUS_OPTIONS} /> : null}
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <FinanceLedger data={data} branches={branches} title={listTitle} defaultKind={defaultKind} emptyTitle={emptyTitle} emptyText={emptyText} />
  </ErpPage>;
}
