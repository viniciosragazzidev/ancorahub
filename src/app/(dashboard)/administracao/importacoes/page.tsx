import { getErpImports } from "@/features/erp/imports";
import { ImportsWorkspace } from "@/features/erp/components/import-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ImportsPage() {
  const data = await getErpImports();
  return <ErpPage pathname="/administracao/importacoes" breadcrumb="Operação" title="Importações">
    <ImportsWorkspace data={data} />
  </ErpPage>;
}
