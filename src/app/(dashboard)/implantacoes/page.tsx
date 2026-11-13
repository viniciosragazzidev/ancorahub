import { getImplantations } from "@/features/erp/implantations";
import { ImplantationsWorkspace } from "@/features/erp/components/implantations-workspace";
import { ErpHeaderActions, ErpHelp } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ImplantationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const workspace = await getImplantations(await searchParams);
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Implantação">
      <p>Os negócios em fechamento ou convertidos no seu escopo entram nesta fila, da conferência dos documentos até a cobertura ativa.</p>
      <p>Recusa, cancelamento e reabertura exigem motivo. Para confirmar a implantação, a apólice, o início da cobertura e a evidência da operadora são obrigatórios.</p>
      <p>A implantação não comprova pagamento de mensalidade, recebimento de comissão ou repasse. O contrato final continua usando o cadastro e os documentos do CRM.</p>
    </ErpHelp>
  </ErpHeaderActions>;
  return <ErpPage pathname="/implantacoes" breadcrumb="Operação" title="Implantação" actions={actions}>
    <ImplantationsWorkspace workspace={workspace} />
  </ErpPage>;
}
