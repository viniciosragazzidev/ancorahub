import { getClosings } from "@/features/erp/closing";
import { ClosingsWorkspace } from "@/features/erp/components/finance-controls";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpNote } from "@/features/erp/ui/erp-kit";

export default async function ClosingsPage() {
  const data = await getClosings();
  return <ErpPage pathname="/financeiro/fechamentos" breadcrumb="Financeiro" title="Fechamentos">
    <ErpNote>
      Prepare a memória dos fatos, solicite conferência independente e feche o período. Uma alteração depois da prévia exige nova conferência.
      A reabertura mantém o retrato anterior no histórico.
    </ErpNote>
    <ClosingsWorkspace data={data} />
  </ErpPage>;
}
