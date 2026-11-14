import { redirect } from "next/navigation";

import { getBrokerFinanceDetail, isBrokerLiteFinanceEnabled } from "@/features/erp/broker-finance";
import { BrokerFinanceScreen, type BrokerFinanceScreenState } from "@/features/erp/components/broker-finance-screen";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/**
 * Meu financeiro do corretor (Lite), somente leitura. A chave BROKER_LITE_FINANCE desligada volta ao Início; sem o
 * módulo financeiro do ERP ou sem permissão, a tela explica que a liberação é da direção.
 */
export default async function MyFinancePage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const context = await getRequiredTenantContext();
  if (!(await isBrokerLiteFinanceEnabled())) redirect("/dashboard");
  const raw = (await searchParams).pagina;
  const page = typeof raw === "string" && /^\d{1,4}$/.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
  let state: BrokerFinanceScreenState;
  try {
    const data = await getBrokerFinanceDetail(context, { page });
    state = data ? { status: "ready", data } : { status: "denied" };
  } catch (error) {
    console.error("[meu-financeiro] falha ao carregar", error instanceof Error ? error.message : "erro desconhecido");
    state = { status: "error" };
  }
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-6 bg-(--surface) text-(--foreground)">
      <BrokerFinanceScreen state={state} />
    </main>
  );
}
