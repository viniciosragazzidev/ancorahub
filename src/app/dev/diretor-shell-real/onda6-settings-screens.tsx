"use client";

/**
 * Dev-only: /settings da Onda 6 no visual Lite dentro da moldura real, com dados de exemplo (nomes longos, várias
 * fontes de captura, unidade com data). As seções usam os mesmos componentes Lite da página real; as que leem o banco
 * no servidor entram pela versão de visualização com dados prontos.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { LiteRelatedLinks } from "@/components/lite/page/related-links";
import { AccountSummaryLite } from "@/app/(dashboard)/settings/_components/lite/account-summary-lite";
import { FeedbackLite, StageModeLite } from "@/app/(dashboard)/settings/_components/lite/atendimento-lite";
import { EmpresaLite } from "@/app/(dashboard)/settings/_components/lite/empresa-lite";
import { ExtensionLiteView } from "@/app/(dashboard)/settings/_components/lite/extension-lite-view";
import { IntegrationsLite } from "@/app/(dashboard)/settings/_components/lite/integrations-lite";
import { SecurityLite } from "@/app/(dashboard)/settings/_components/lite/security-lite";
import { SettingsLite, type SettingsLiteSection } from "@/app/(dashboard)/settings/_components/lite/settings-lite";
import { UnitLite, WhatsappLite } from "@/app/(dashboard)/settings/_components/lite/unit-lite";

const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
  { id: "branch-ni", name: "Niterói 1" },
];

const INTEGRATIONS = [
  { id: "int-1", name: "Landing page Amil PME outubro", source: "landing_page", branchId: "branch-centro", branchName: "Centro", status: "active" as const, tokenPrefix: "lp_8f2a", createdAt: new Date("2026-10-02T13:00:00Z") },
  { id: "int-2", name: "Pixel do site institucional", source: "site_pixel", branchId: null, branchName: null, status: "active" as const, tokenPrefix: "px_19c0", createdAt: new Date("2026-09-14T13:00:00Z") },
  { id: "int-3", name: "Formulário de cotação Bradesco Saúde Top Nacional Flex", source: "landing_page", branchId: "branch-barra", branchName: "Barra da Tijuca", status: "revoked" as const, tokenPrefix: "lp_77de", createdAt: new Date("2026-08-01T13:00:00Z") },
];

/** As mesmas seções por papel da página real (tabIds): diretor, marketing (com integrações) ou gestor/cargo personalizado. */
const SETTINGS_TABS: Record<"director" | "marketing" | "manager", string[]> = {
  director: ["conta", "empresa", "unidade", "atendimento", "whatsapp", "integracoes", "seguranca", "extensao"],
  marketing: ["conta", "integracoes", "whatsapp", "seguranca", "extensao"],
  manager: ["conta", "unidade", "atendimento", "whatsapp", "seguranca", "extensao"],
};

export function SettingsShellScreen({ variant = "director" }: { variant?: "director" | "marketing" | "manager" } = {}) {
  const isDirector = variant === "director";
  const all: SettingsLiteSection[] = [
    { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: <AccountSummaryLite name="Marina Exemplo de Albuquerque" email="marina.albuquerque@ancora.example" role={isDirector ? "director" : "manager"} /> },
    { id: "empresa", title: "Empresa", description: "Dados da corretora e identidade visual", node: <EmpresaLite canEdit tenant={{ name: "Âncora Saúde", legalName: "Âncora Saúde Corretora de Seguros Ltda", cnpj: "12.345.678/0001-90", logoUrl: null, brandColor: "#2563EB" }} /> },
    { id: "unidade", title: "Unidade", description: "Centro", node: <UnitLite branch={{ id: "branch-centro", name: "Centro", status: "active", acceptingLeads: true, autoDistribute: false, createdAt: new Date("2025-03-12T12:00:00Z") }} /> },
    {
      id: "atendimento",
      title: "Atendimento",
      description: "Lembretes de feedback, distribuição e etapa pela IA",
      node: (
        <>
          <FeedbackLite feedbackReminderInterval="30" feedbackReminderMaxAttempts={5} feedbackPushEnabled feedbackToastEnabled feedbackRequiredEnabled={false} maxActiveLeadsLimit={10} canEdit={isDirector} />
          {isDirector ? <StageModeLite initialMode="suggest" /> : null}
        </>
      ),
    },
    { id: "whatsapp", title: "WhatsApp", description: "O número que você usa no atendimento", node: <WhatsappLite /> },
    { id: "integracoes", title: "Integrações", description: "Fontes de captura, webhooks e pixels", node: <IntegrationsLite integrations={INTEGRATIONS} branches={BRANCHES} /> },
    { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: <SecurityLite enabled={false} email="marina.albuquerque@ancora.example" /> },
    { id: "extensao", title: "Extensão", description: "Atendimento contextual no WhatsApp Web", node: <ExtensionLiteView data={{ enabled: true, minimumVersion: "0.4.2", canConfigure: isDirector }} /> },
  ];
  const sections = SETTINGS_TABS[variant].map((id) => all.find((section) => section.id === id)).filter((section): section is SettingsLiteSection => Boolean(section));
  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Configurações" />
      <main className={litePage.stack}>
        <SettingsLite sections={sections} />
        <LiteRelatedLinks
          title="Configurações relacionadas"
          description="Atalhos para parâmetros avançados e módulos."
          links={[
            { label: "Qualificação e robô IA", href: "/qualificacao", description: "Prompt, diagnóstico do WhatsApp e MCP" },
            { label: "Equipe e corretores", href: "/equipe", description: "Convites de usuários e permissões" },
            { label: "Regras de distribuição", href: "/leads?tab=distribuicao", description: "Roleta de atendimento e prioridades" },
            { label: "Guia e manual do sistema", href: "/guia", description: "Tours e definições de domínio" },
          ]}
        />
      </main>
    </>
  );
}
