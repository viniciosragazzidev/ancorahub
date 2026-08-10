import { DashboardHeader } from "@/components/dashboard-header";
import { SystemGuide } from "@/features/guide/components/system-guide";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { RelatedActions } from "@/components/related-actions";

export default async function GuidePage() {
  const context = await getRequiredTenantContext();

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Guia do Sistema & Manual de Operação" />
      <div className="space-y-6 pb-8">
        <SystemGuide role={context.role} />

        <div className="px-4 lg:px-6">
          <RelatedActions
            title="Navegação Direta para Principais Áreas"
            description="Explore as seções explicadas neste guia."
            links={[
              { label: "Central de Leads", href: "/leads", description: "Atendimento e funil de oportunidades" },
              { label: "Qualificação IA", href: "/qualificacao", description: "Configuração do robô de triagem" },
              { label: "Vendas & Propostas", href: "/vendas", description: "Esteira de fechamentos" },
              { label: "Parâmetros do Sistema", href: "/settings", description: "Perfil, integrações e comissões" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
