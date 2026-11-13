import { getImplantations } from "@/features/erp/implantations";
import { ImplantationsWorkspace } from "@/features/erp/components/implantations-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ImplantationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const workspace = await getImplantations(await searchParams);
  return <ErpPage pathname="/implantacoes" breadcrumb="Operação" title="Implantação">
    <ImplantationsWorkspace workspace={workspace} />
  </ErpPage>;
}
