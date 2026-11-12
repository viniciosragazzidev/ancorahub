import { DashboardHeader } from "@/components/dashboard-header";
import { getPayouts } from "@/features/erp/payouts";
import { PayoutsTable } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ReceiptsPage() {
  const data = await getPayouts({ status: "settled" });
  return <><DashboardHeader breadcrumb="Financeiro" title={data.agency ? "Recibos" : "Meus recibos"} /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Recibos de repasses conferidos. Cada recibo é uma versão fixa dos itens pagos e das compensações; um estorno posterior não altera o recibo, gera um novo evento.</p>
    <PayoutsTable data={data} receipts />
  </main></>;
}
