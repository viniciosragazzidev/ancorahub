import { ZodError } from "zod";
import { StatCard } from "@/components/dashboard/metric-card";
import { ErpError, formatCents } from "@/features/erp/contracts";
import { getPayout, getPayoutCandidates, getPayouts } from "@/features/erp/payouts";
import { PAYOUT_STATUS_OPTIONS, PayoutsList } from "@/features/erp/components/payout-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpPrimaryAction, ErpSearch, ErpStats, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

type Search = { status?: string; competence?: string; q?: string; page?: string; repasse?: string; preparar?: string };

/** The drawer's payout: a missing or out-of-scope id shows a note in the drawer instead of breaking the list. */
async function openPayout(id: string | undefined) {
  if (!id) return { detail: null, missing: false };
  try {
    return { detail: await getPayout(id), missing: false };
  } catch (error) {
    if (error instanceof ErpError || error instanceof ZodError) return { detail: null, missing: true };
    throw error;
  }
}

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const competence = raw.competence || undefined;
  const data = await getPayouts({ status: raw.status, competence, q: raw.q, page: raw.page });
  // Candidates compute a balance per entry: load them only while the preparation drawer is open.
  const [candidates, opened] = await Promise.all([
    data.canPrepare && raw.preparar ? getPayoutCandidates({ competence }) : Promise.resolve(null),
    openPayout(raw.repasse),
  ]);
  const { summary } = data;
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Repasses">
      <p>O repasse agrupa comissões aprovadas de um corretor, com o saldo de cada uma depois de liquidações e compensações confirmadas.</p>
      <p>São quatro passos: preparar, aprovar (outra pessoa), registrar o pagamento com comprovante e conferir (outra pessoa). O recibo sai na conferência.</p>
      <p>Quem recebe o repasse nunca o aprova, paga ou confere, e quem aprova não registra o pagamento. Registrar o pagamento não faz transferência bancária.</p>
    </ErpHelp>
    {data.canPrepare ? <ErpPrimaryAction label="Preparar repasse" param="preparar" /> : null}
  </ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/repasses" breadcrumb="Financeiro" title={data.agency ? "Repasses" : "Meus repasses"} actions={actions}>
    <ErpStats>
      {data.agency ? <>
        <StatCard label="Aguardando aprovação" value={summary.prepared.toLocaleString("pt-BR")} sublabel="preparados por alguém" />
        <StatCard label="A pagar" value={summary.approved.toLocaleString("pt-BR")} sublabel="aprovados sem pagamento" />
        <StatCard label="A conferir" value={summary.paying.toLocaleString("pt-BR")} sublabel="pagamento registrado" />
        <StatCard label="Liquidado" value={formatCents(summary.settledCents)} sublabel={`${summary.settled.toLocaleString("pt-BR")} repasse(s) conferido(s)`} />
      </> : <>
        <StatCard label="Recebido" value={formatCents(summary.settledCents)} sublabel="repasses conferidos" />
        <StatCard label="Repasses" value={summary.settled.toLocaleString("pt-BR")} sublabel="com recibo emitido" />
      </>}
    </ErpStats>
    <ErpToolbar>
      {data.agency ? <ErpSearch label="Buscar repasse" placeholder="Buscar beneficiário ou recibo" value={data.filters.q} /> : null}
      {data.agency ? <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={PAYOUT_STATUS_OPTIONS} /> : null}
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <PayoutsList data={data} candidates={candidates} detail={opened.detail} detailMissing={opened.missing} />
  </ErpPage>;
}
