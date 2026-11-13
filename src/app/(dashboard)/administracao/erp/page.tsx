import { getErpGovernance } from "@/features/erp/governance";
import { ErpGovernanceWorkspace } from "@/features/erp/components/governance-forms";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ErpGovernancePage() {
  const workspace = await getErpGovernance();
  return <ErpPage pathname="/administracao/erp" breadcrumb="Administração" title="ERP operacional">
    <ErpGovernanceWorkspace workspace={workspace} />
  </ErpPage>;
}
