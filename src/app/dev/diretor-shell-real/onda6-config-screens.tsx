"use client";

/**
 * Dev-only: as demais telas da Onda 6 (integrações, WhatsApp, atendimento, qualificação, comissões, checklists,
 * extensão, diagnóstico e fluxos) no visual Lite dentro da moldura real, com dados de exemplo realistas. Cada tela usa
 * os mesmos componentes Lite da página real.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { AtendimentoHeadingLite } from "@/app/(dashboard)/atendimento/_components/atendimento-heading-lite";
import { FlowEditorLite } from "@/app/(dashboard)/atendimento/fluxo/_components/flow-editor-lite";
import { MessagesWorkspaceLite } from "@/app/(dashboard)/atendimento/mensagens/_components/messages-workspace-lite";
import { SituationsWorkspaceLite } from "@/app/(dashboard)/atendimento/situacoes/_components/situations-workspace-lite";
import { DirectorWhatsAppLite } from "@/app/(dashboard)/integrations/whatsapp/director-whatsapp-lite";
import { MaterialsWhatsAppLite } from "@/app/(dashboard)/integrations/whatsapp/materials-whatsapp-lite";
import { QualificationHubLite } from "@/app/(dashboard)/qualificacao/_components/lite/qualification-hub-lite";
import { QUALIFICATION_HUB_FIXTURE } from "@/app/(dashboard)/qualificacao/_components/qualification-hub-fixtures";
import { ExtensionLiteView } from "@/app/(dashboard)/settings/_components/lite/extension-lite-view";
import { FeedbackTemplatesLite } from "@/app/(dashboard)/settings/feedback-templates/feedback-templates-lite";
import { WahaDiagnosticLite } from "@/app/(dashboard)/settings/waha-diagnostic/waha-diagnostic-lite";
import { WhatsAppPageLite, type WhatsAppChannel } from "@/app/(dashboard)/settings/whatsapp-page-lite";
import type { SituationRow } from "@/features/attendance-situations/service";
import { WhatsappFlowsLite } from "@/features/automations/components/whatsapp-flows-lite";
import { IntegrationsCatalogLite } from "@/features/communication-channels/components/integrations-catalog-lite";
import { CommissionRulesLite, PostSaleSettingsLite } from "@/features/commissions/components/commission-rules-lite";
import type { LibraryMessage } from "@/features/message-library/service";
import { QUALIFICATION_FIELDS } from "@/features/qualification-flow/domain";
import { TurboAdminLite } from "@/features/qualification-turbo/components/turbo-admin-lite";

const AT = new Date("2026-10-20T13:00:00.000Z");

export function IntegracoesShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Integrações" />
      <main className={litePage.stack}><IntegrationsCatalogLite /></main>
    </>
  );
}

const CHANNEL_BASE: WhatsAppChannel = {
  id: "ch-1", branchId: null, displayPhoneNumber: "+55 21 3333-4444", verifiedName: "Âncora Saúde Corretora", branchName: null, status: "active", qualityRating: "GREEN", messagingLimit: "TIER_1K",
  registrationStatus: "registered", registrationErrorCode: null, registeredAt: AT, businessId: "123", wabaId: "456", phoneNumberId: "789", lastWebhookAt: AT, activatedAt: AT, tokenExpiresAt: null, isDefault: true,
  onboardingMode: "embedded", syncStatus: null, syncRequestedAt: null, syncError: null, hasCredentials: true,
};

export function WhatsappShellScreen() {
  const coexist: WhatsAppChannel = { ...CHANNEL_BASE, id: "ch-2", isDefault: false, displayPhoneNumber: "+55 21 98888-7777", verifiedName: "Âncora Anúncios Barra da Tijuca", onboardingMode: "coexistence", branchId: "branch-barra", branchName: "Barra da Tijuca" };
  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="WhatsApp" />
      <WhatsAppPageLite official={{ enabled: true, configured: true, missing: [], appId: "app-1", embeddedSignupConfigId: "cfg-1", canConfigure: true, branches: [{ id: "branch-barra", name: "Barra da Tijuca" }], channels: [CHANNEL_BASE, coexist], companyAccount: CHANNEL_BASE, queues: [{ id: "q1", name: "PME" }], adAccountNames: ["Âncora Saúde Ads"] }} />
    </>
  );
}

export function WhatsappDiretoriaShellScreen() {
  const notices = [
    { key: "brokerLeadNotification", label: "Lead novo para o corretor", description: "Avisa o corretor quando um lead chega para ele.", metaOnly: false, alwaysOn: false, chat: false, immediate: true, enabled: true, channel: "company_number" as const, freeMessageIds: [], builtInPreviews: ["Corretor Ana, chegou o lead Maria Souza (plano de saúde)."] },
    { key: "leadFeedbackReminder", label: "Lembrete de feedback", description: "Cobra o registro do atendimento no prazo.", metaOnly: false, alwaysOn: false, chat: false, immediate: false, enabled: false, channel: "company_number" as const, freeMessageIds: [], builtInPreviews: ["Ana, registre o feedback de Maria Souza."] },
  ];
  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="WhatsApp" />
      <DirectorWhatsAppLite channel={{ id: "waha-1", status: "ready", phone: "+55 21 97777-1234", lastHealthAt: AT.toISOString() }} notices={notices} freeMessages={[{ id: "m1", name: "Boas-vindas da diretoria", content: "Olá, equipe!" }]} />
    </>
  );
}

export function WhatsappMateriaisShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="WhatsApp" />
      <MaterialsWhatsAppLite
        channel={{ id: "waha-2", status: "ready", phone: "+55 21 96666-0000", lastHealthAt: AT.toISOString() }}
        captureOn={false}
        loadFailed={false}
        missingTables={false}
        groups={[{ id: "g1", groupId: "1203@g.us", groupName: "Amil Corretores RJ: tabelas e materiais de venda", active: true }, { id: "g2", groupId: "1204@g.us", groupName: "Bradesco Saúde PME", active: false }]}
        stats={{ total: 37, lastMessageAt: AT, byStatus: { captured: 21, duplicate_material: 9, needs_ocr: 4, error: 3 } }}
      />
    </>
  );
}

export function ComissoesShellScreen() {
  const base = { tenantId: "t", planId: null, planName: null, createdBy: "u", createdAt: AT, updatedAt: AT };
  const rules = [
    { ...base, id: "r1", name: "Padrão individual e familiar", carrierId: null, carrierName: null, type: "escalonada" as const, percentages: [100, 25, 5], appliesToAll: true, active: true },
    { ...base, id: "r2", name: "Amil PME acima de 30 vidas", carrierId: "c1", carrierName: "Amil", type: "escalonada" as const, percentages: [120, 30, 10, 5], appliesToAll: false, active: true },
    { ...base, id: "r3", name: "Bradesco Saúde Top Nacional Flex", carrierId: "c2", carrierName: "Bradesco Saúde", type: "unica" as const, percentages: [150], appliesToAll: false, active: false },
  ];
  return (
    <>
      <DashboardHeader breadcrumb="Configurações / Financeiro" title="Regras de comissão" />
      <main className={litePage.stack}>
        <CommissionRulesLite rules={rules} carriers={[{ id: "c1", name: "Amil" }, { id: "c2", name: "Bradesco Saúde" }, { id: "c3", name: "SulAmérica" }]} />
        <PostSaleSettingsLite chargebackWindowDays={90} active />
      </main>
    </>
  );
}

export function ChecklistsShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Configurações" title="Checklists de atendimento" />
      <main className={litePage.stack}>
        <FeedbackTemplatesLite
          initialTemplates={[
            { id: "t1", name: "Primeiro contato", description: "Ligação inicial depois que o lead chega", active: true, items: [{ id: "i1", sortOrder: 0, question: "Conseguiu falar com o cliente?", answerType: "boolean", options: null, required: true }, { id: "i2", sortOrder: 1, question: "Qual o interesse principal (rede, preço ou carência)?", answerType: "text", options: null, required: false }] },
            { id: "t2", name: "Retorno da proposta enviada", description: null, active: false, items: [{ id: "i3", sortOrder: 0, question: "Nota do atendimento de 1 a 5", answerType: "rating", options: null, required: true }] },
          ]}
        />
      </main>
    </>
  );
}

export function ExtensaoShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Configurações / Integrações" title="AncoraHub Assistant" />
      <main className={litePage.stack}><ExtensionLiteView data={{ enabled: true, minimumVersion: "0.4.2", canConfigure: true }} /></main>
    </>
  );
}

export function WahaShellScreen() {
  return <WahaDiagnosticLite initialResult={{ ok: false, step: "health_check", kind: "WAHA_UNREACHABLE", base: "https://waha.ancorasaude.example", error: "connect ETIMEDOUT 203.0.113.10:443 depois de 10000 ms", timestamp: "2026-10-25T11:42:10.000Z" }} />;
}

const situation = (id: string, kind: SituationRow["kind"], title: string, response: string, action: SituationRow["action"], enabled = true): SituationRow => ({ id, key: id, kind, title, response, action, enabled, critical: false, phrases: kind === "builtin" ? ["vocês atendem"] : [], recognizedBy: ["atende em", "cobre a região"] });

export function SituacoesShellScreen() {
  const situations = [
    situation("s1", "builtin", "Cliente pergunta se atende na região", "Atendemos todo o estado do Rio de Janeiro, inclusive Niterói e Baixada.", "continue"),
    situation("s2", "custom", "Quer falar com um corretor agora", "Claro! Já vou chamar um corretor da equipe para você.", "transfer"),
    situation("s3", "custom", "Pergunta sobre carência de parto em plano familiar com dependentes", "A carência de parto é de 300 dias na maioria das operadoras.", "continue", false),
    situation("s4", "guided", "Dúvidas que nenhuma situação cobre", "", "guide"),
  ];
  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Situações" />
      <main className={litePage.stack}>
        <AtendimentoHeadingLite active="situacoes" />
        <SituationsWorkspaceLite situations={situations} learning={{ suggestions: [], coverage: { percent: 82, covered: 41, total: 50 }, autoActivate: false }} autoActivatedKeys={["s1"]} canConfigure />
      </main>
    </>
  );
}

const message = (id: string, kind: LibraryMessage["kind"], kindLabel: string, name: string, text: string, status: string, usages: LibraryMessage["usages"]): LibraryMessage => ({
  id, kind, kindLabel, name, text, status, category: kind === "meta_template" ? "UTILITY" : null, variables: [], usages,
  validity: kind === "meta_template" ? [{ channel: "meta", label: "Meta a qualquer hora", valid: "always" }] : [{ channel: "company_number", label: "WhatsApp da empresa", valid: "always" }, { channel: "meta", label: "Meta na janela de 24h", valid: "window" }],
});

export function MensagensShellScreen() {
  const messages = [
    message("m1", "meta_template", "Template Meta", "primeira_mensagem_qualificacao", "Olá {{1}}, aqui é a Ana da Âncora Saúde. Posso te ajudar com a cotação do seu plano?", "Aprovado", [{ area: "ai", label: "1ª mensagem da qualificação" }]),
    message("m2", "free_message", "Mensagem livre", "Aviso de plantão para corretores da Barra da Tijuca", "Bom dia, equipe! O plantão de hoje começa às 8h.", "Ativa", [{ area: "team_notice", label: "Aviso de plantão" }, { area: "team_notice", label: "Lembrete de feedback" }]),
    message("m3", "quick_reply", "Resposta rápida da IA", "Atende na região", "Atendemos todo o estado do Rio de Janeiro.", "Personalizada", []),
  ];
  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Mensagens" />
      <main className={litePage.stack}>
        <AtendimentoHeadingLite active="mensagens" />
        <MessagesWorkspaceLite messages={messages} />
      </main>
    </>
  );
}

export function FluxoShellScreen() {
  const keys = QUALIFICATION_FIELDS.map((field) => field.key);
  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Fluxo de atendimento" />
      <main className={litePage.stack}>
        <AtendimentoHeadingLite active="fluxo" />
        <FlowEditorLite enabledOrder={keys.slice(0, Math.max(1, keys.length - 1))} texts={{ [keys[0]!]: "Para começar, qual o seu nome completo?" }} canEdit />
      </main>
    </>
  );
}

export function QualificacaoShellScreen() {
  return <QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />;
}

export function TurboShellScreen() {
  const row = (name: string, label: string, touch: string, status: string, category: string | null) => ({ name, label, touch, expectedCategory: category ?? "UTILITY", status, category, quality: null, rejectedReason: status === "REJECTED" ? "Conteúdo promocional em template de utilidade" : null, body: "Olá {{1}}! Vi que você se interessou por um plano de saúde. Quer receber as opções da sua região?", buttons: ["Quero receber", "Agora não"] });
  return (
    <>
      <DashboardHeader breadcrumb="Qualificação" title="Qualificação turbo" />
      <main className={litePage.stack}>
        <TurboAdminLite data={{ settings: { enabled: true, cadence: true, learn: false, companyDisplayName: "Âncora Saúde" }, templates: [row("t0_lead_ads", "Primeira mensagem (Lead Ads)", "t0", "APPROVED", "UTILITY"), row("t1_reminder", "Lembrete de 20 minutos", "t1", "PENDING", "UTILITY"), row("t2_reengage", "Reengajamento de 3 horas", "t2", "REJECTED", "MARKETING"), row("t4_goodbye", "Despedida", "t4", "MISSING", null)], metaConnected: true, canEdit: true } as never} />
      </main>
    </>
  );
}

export function FluxosWhatsappShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Fluxos de WhatsApp" />
      <main className={litePage.stack}>
        <p className={litePage.cardDescription}>Recepção, qualificação e roteamento de contatos do WhatsApp usando a frota ativa do WAHA.</p>
        <WhatsappFlowsLite initialFlows={[{ id: "f1", name: "Fluxo Lead Ads campanhas de outubro", triggerType: "lead_ads", status: "active", configuration: {}, createdAt: AT }, { id: "f2", name: "Fluxo site institucional", triggerType: "site", status: "paused", configuration: {}, createdAt: AT }]} />
      </main>
    </>
  );
}
