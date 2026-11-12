import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { getPayoutCandidates, getPayouts } from "@/features/erp/payouts";
import { PayoutCandidates, PayoutsTable } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string; competence?: string }> }) {
  const raw = await searchParams; const data = await getPayouts({ status: raw.status, competence: raw.competence || undefined });
  const candidates = data.canPrepare ? await getPayoutCandidates({ competence: raw.competence || undefined }) : null;
  return <><DashboardHeader breadcrumb="Financeiro" title={data.agency ? "Repasses" : "Meus repasses"} /><main className={page.stack}>
    <div className={page.toolbar}><p className="text-sm text-muted-foreground">Repasse agrupa comissões aprovadas de um corretor. Fluxo: preparar, aprovar (outra pessoa), registrar o pagamento com comprovante e conferir (outra pessoa). O recibo sai na conferência.</p>{candidates ? <PayoutCandidates data={candidates} /> : null}</div>
    {data.agency ? <form action="/financeiro/repasses" className={page.toolbar} aria-label="Filtrar repasses"><AppSelect name="status" aria-label="Estado" defaultValue={data.filters.status} options={[{ value: "all", label: "Todos os estados" }, { value: "prepared", label: "Aguardando aprovação" }, { value: "approved", label: "Aprovados" }, { value: "paying", label: "Pagamento a conferir" }, { value: "settled", label: "Liquidados" }, { value: "cancelled", label: "Cancelados" }]} /><Input type="month" name="competence" aria-label="Competência" defaultValue={data.filters.competence ?? ""} /><Button type="submit" variant="outline">Filtrar</Button></form> : null}
    <PayoutsTable data={data} />
  </main></>;
}
