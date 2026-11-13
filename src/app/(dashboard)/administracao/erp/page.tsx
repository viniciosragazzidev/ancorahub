import { getErpGovernance } from "@/features/erp/governance";
import { ErpGovernanceWorkspace } from "@/features/erp/components/governance-forms";
import { ErpHeaderActions, ErpHelp } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ErpGovernancePage() {
  const workspace = await getErpGovernance();
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Módulos">
      <p>Escolha os módulos da empresa e os perfis que poderão usá-los. Clique em um módulo para ativar e definir quem acessa.</p>
      <p>Cada pessoa continua limitada ao próprio papel, cargo e escopo. Valores financeiros exigem conferência e aprovação de outra pessoa.</p>
      <p>Um módulo só fica disponível depois da liberação global feita pelo Super-admin. Desligar preserva o histórico.</p>
    </ErpHelp>
  </ErpHeaderActions>;
  return <ErpPage pathname="/administracao/erp" breadcrumb="Operação" title="Módulos" actions={actions}>
    <ErpGovernanceWorkspace workspace={workspace} />
  </ErpPage>;
}
