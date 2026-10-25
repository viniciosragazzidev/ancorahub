// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Perfil do lead com a chave desligada: o HTML precisa continuar igual ao de antes do Lite. O snapshot foi gerado
// com o page.tsx original, com o banco, a sessão e as Server Actions trocados por dados fixos.
const fixtures = vi.hoisted(() => {
  const lead = {
    id: "11111111-1111-4111-8111-111111111111",
    nome: "Maria Nova",
    telefone: "21 90000-0101",
    email: "maria@exemplo.com",
    origem: "webhook",
    sourceCampaign: "Campanha PME",
    sourceAd: null,
    sourceForm: null,
    sourceChannel: null,
    sourceMetadata: null,
    capturedAt: new Date("2026-10-24T13:00:00.000Z"),
    metaCampaignId: null,
    metaAdSetId: null,
    metaAdId: null,
    metaFormId: null,
    metaPageId: null,
    tipo: "PME",
    status: "in_contact",
    qualificationStatus: "warm",
    qualificationState: "IN_PROGRESS",
    formData: { razaoSocial: "Padaria Nova Ltda", cnpj: "12.345.678/0001-90", funcionarios: "8" },
    qualificationDetails: { numberOfLives: "4", averageAge: "34", neighborhood: "Centro" },
    corretorId: "broker-1",
    branchId: "branch-1",
    planId: null,
    motivoPerda: null,
    lossCategory: null,
    slaBreachedAt: null,
    firstContactLatencySeconds: 120,
    consentimentoLgpd: true,
    createdAt: new Date("2026-10-24T12:00:00.000Z"),
    assignedAt: new Date("2026-10-24T12:05:00.000Z"),
    serviceStartedAt: new Date("2026-10-24T12:20:00.000Z"),
    stageEnteredAt: new Date("2026-10-24T12:20:00.000Z"),
    corretorNome: "Ana Souza",
    corretorImage: null,
    branchNome: "Centro",
    productName: null,
    dutyScheduleName: null,
  };
  const chain = (result: unknown): unknown => {
    const target = function () {};
    const proxy: unknown = new Proxy(target, {
      get: (_target, key) => (key === "then" ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) : () => proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  const db = {
    select: (fields: Record<string, unknown> = {}) => {
      if ("nome" in fields && "telefone" in fields) return chain([lead]);
      if ("minutes" in fields) return chain([{ minutes: 15 }]);
      if ("title" in fields && "priority" in fields) {
        return chain([{ id: "task-1", title: "Ligar para a cliente", description: null, priority: "high", dueAt: new Date("2026-10-25T13:00:00.000Z"), completedAt: null, createdAt: new Date("2026-10-24T12:30:00.000Z"), assignedTo: "broker-1", assigneeName: "Ana Souza" }]);
      }
      if ("name" in fields && "id" in fields && Object.keys(fields).length === 2) return chain([{ id: "broker-1", name: "Ana Souza" }]);
      return chain([]);
    },
  };
  const interactions = [
    { id: "i1", tipo: "status_change", conteudo: "Status alterado para Em atendimento", metadata: null, userId: "broker-1", createdAt: new Date("2026-10-24T12:20:00.000Z"), userName: "Ana Souza" },
  ];
  const context = { role: "director", tenantId: "tenant-1", userId: "director-1", branchId: null, jobTitle: "director" };
  return { lead, db, interactions, context, liteStyle: { current: false } };
});

vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => fixtures.db }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => fixtures.context }));
vi.mock("@/features/leads/queries", () => ({ getLeadTimeline: async () => fixtures.interactions }));
vi.mock("@/features/documents/actions", () => ({
  getRequirementsForLead: async () => [],
  getLeadDocuments: async () => [],
  getLeadDocumentChecklist: async () => [],
}));
vi.mock("@/features/post-sale/queries", () => ({ getLeadBeneficiaries: async () => [] }));
vi.mock("@/features/conversation-intelligence", async () => ({
  AiConversationInsightCard: (await import("@/features/conversation-intelligence/components/ai-conversation-insight-card")).AiConversationInsightCard,
}));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadScopeWhere: () => undefined }));
vi.mock("@/features/supervisor-workspace/team-lead-detail-presentation", () => ({ buildTeamLeadLightDetail: vi.fn(), getTeamLeadPresentationSupplements: vi.fn() }));
// O cabeçalho é do chrome (outra frente): aqui só confere o título e a migalha que a página passa.
vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title }: { breadcrumb?: string; title?: string }) => <header data-testid="dashboard-header">{breadcrumb} / {title}</header>,
}));
// Ramos de outros papéis (gestor, supervisor e corretor Lite): fora deste teste do diretor.
vi.mock("@/features/manager-workspace/manager-lite-leads", () => ({ ManagerLiteLeadDetailPage: () => null }));
vi.mock("@/features/supervisor-workspace/supervisor-lead-detail", () => ({ SupervisorLeadDetail: () => null }));
vi.mock("@/features/broker-workspace/components/light-lead-detail", () => ({ LightLeadDetail: () => null }));
vi.mock("@/features/broker-workspace/chat/lead-conversation", () => ({ LeadConversation: () => null }));
vi.mock("@/features/broker-workspace/chat/lead-script", () => ({ buildLeadConversationScript: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => null }));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode: async () => "FULL" }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => null }));
vi.mock("@/features/director-lite/style-flag", () => ({ shouldUseDirectorLiteStyle: async () => fixtures.liteStyle.current }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/leads/11111111-1111-4111-8111-111111111111",
}));
// Server Actions ("use server") ficam fora do teste: cada uma vira um mock que devolve funções vazias.
const serverModule = vi.hoisted(() => () => new Proxy({}, { has: (_target, key) => key !== "then", get: (_target, key) => (key === "then" || key === "__esModule" ? undefined : () => undefined) }));
vi.mock("@/app/(auth)/invite/accept/actions", serverModule);
vi.mock("@/app/(auth)/login/actions", serverModule);
vi.mock("@/app/(auth)/recuperar-senha/actions", serverModule);
vi.mock("@/app/(dashboard)/equipe/actions", serverModule);
vi.mock("@/app/(dashboard)/equipe/cargos/actions", serverModule);
vi.mock("@/app/(dashboard)/equipe/recuperacoes/actions", serverModule);
vi.mock("@/app/(dashboard)/integrations/whats_alt/actions", serverModule);
vi.mock("@/app/(dashboard)/leads/[id]/service-action", serverModule);
vi.mock("@/app/(dashboard)/leads/actions", serverModule);
vi.mock("@/app/(dashboard)/leads/status-actions", serverModule);
vi.mock("@/app/(dashboard)/notificacoes/actions", serverModule);
vi.mock("@/app/(dashboard)/relatorios/_components/spreadsheet-actions", serverModule);
vi.mock("@/app/(dashboard)/settings/actions", serverModule);
vi.mock("@/app/(dashboard)/settings/feedback-actions", serverModule);
vi.mock("@/app/(dashboard)/settings/integrations-actions", serverModule);
vi.mock("@/app/(dashboard)/settings/security-actions", serverModule);
vi.mock("@/app/(dashboard)/settings/waha-connection-actions", serverModule);
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", serverModule);
vi.mock("@/app/(platform-admin)/super-admin/actions", serverModule);
vi.mock("@/app/(platform-admin)/super-admin/integrations/whatsapp/actions", serverModule);
vi.mock("@/app/(platform-admin)/super-admin/whatsapp-review/actions", serverModule);
vi.mock("@/app/(platform-admin)/super-dev/actions", serverModule);
vi.mock("@/app/primeiro-acesso/onboarding-actions", serverModule);
vi.mock("@/features/agent-training/actions", serverModule);
vi.mock("@/features/ai-agent/actions", serverModule);
vi.mock("@/features/ai-agent/quick-reply-actions", serverModule);
vi.mock("@/features/ai-gateway/ask-assistant", serverModule);
vi.mock("@/features/ai-gateway/consent-actions", serverModule);
vi.mock("@/features/ai-qualification/actions", serverModule);
vi.mock("@/features/ai-qualification/bulk-qualification-actions", serverModule);
vi.mock("@/features/ai-qualification/cold-lead-requalification-actions", serverModule);
vi.mock("@/features/attendance-flows/actions", serverModule);
vi.mock("@/features/attendance-situations/actions", serverModule);
vi.mock("@/features/automations/actions", serverModule);
vi.mock("@/features/branches/actions", serverModule);
vi.mock("@/features/broker-availability/actions", serverModule);
vi.mock("@/features/broker-workspace/broker-template-actions", serverModule);
vi.mock("@/features/broker-workspace/chat/chat-actions", serverModule);
vi.mock("@/features/broker-workspace/experience-mode", serverModule);
vi.mock("@/features/broker-workspace/first-message/actions", serverModule);
vi.mock("@/features/browser-extension/actions", serverModule);
vi.mock("@/features/catalog/actions", serverModule);
vi.mock("@/features/commissions/actions", serverModule);
vi.mock("@/features/communication-channels/actions", serverModule);
vi.mock("@/features/communication-channels/manual-meta-actions", serverModule);
vi.mock("@/features/conversation-intelligence/actions", serverModule);
vi.mock("@/features/conversations/actions", serverModule);
vi.mock("@/features/global-catalog/actions", serverModule);
vi.mock("@/features/goals/actions", serverModule);
vi.mock("@/features/goals/lite-goals-actions", serverModule);
vi.mock("@/features/journey/actions", serverModule);
vi.mock("@/features/journey/campaign-actions", serverModule);
vi.mock("@/features/journey/director-actions", serverModule);
vi.mock("@/features/journey/recognition-actions", serverModule);
vi.mock("@/features/lead-distribution/actions", serverModule);
vi.mock("@/features/lead-distribution/broker-summary-actions", serverModule);
vi.mock("@/features/lead-distribution/cold-age-release-actions", serverModule);
vi.mock("@/features/lead-distribution/ddd-routing-actions", serverModule);
vi.mock("@/features/lead-distribution/disqualified-routing-actions", serverModule);
vi.mock("@/features/lead-distribution/duty-actions", serverModule);
vi.mock("@/features/lead-distribution/duty-roster-pending-actions", serverModule);
vi.mock("@/features/lead-distribution/duty-swap-actions", serverModule);
vi.mock("@/features/lead-distribution/duty-type-actions", serverModule);
vi.mock("@/features/lead-distribution/monthly-duty-actions", serverModule);
vi.mock("@/features/lead-distribution/on-duty-check", serverModule);
vi.mock("@/features/lead-distribution/roster-actions", serverModule);
vi.mock("@/features/lead-distribution/routing-actions", serverModule);
vi.mock("@/features/lead-distribution/sla-actions", serverModule);
vi.mock("@/features/lead-tags/actions", serverModule);
vi.mock("@/features/leads/accept-offer-action", serverModule);
vi.mock("@/features/leads/actions", serverModule);
vi.mock("@/features/leads/actions/send-lead-media", serverModule);
vi.mock("@/features/leads/actions/send-lead-message", serverModule);
vi.mock("@/features/leads/availability-action", serverModule);
vi.mock("@/features/leads/bulk-import", serverModule);
vi.mock("@/features/leads/checklist-actions", serverModule);
vi.mock("@/features/leads/decline-action", serverModule);
vi.mock("@/features/leads/director-service-start-action", serverModule);
vi.mock("@/features/leads/feedback-actions", serverModule);
vi.mock("@/features/leads/investigation-observation-action", serverModule);
vi.mock("@/features/leads/management-actions", serverModule);
vi.mock("@/features/leads/qualification-tab-actions", serverModule);
vi.mock("@/features/leads/reminder-actions", serverModule);
vi.mock("@/features/leads/task-actions", serverModule);
vi.mock("@/features/leads/whatsapp-open-action", serverModule);
vi.mock("@/features/manager-workspace/manager-lead-status-action", serverModule);
vi.mock("@/features/marketing-import/actions", serverModule);
vi.mock("@/features/message-library/actions", serverModule);
vi.mock("@/features/meta-ads/actions", serverModule);
vi.mock("@/features/meta-ads/meta-conversion-actions", serverModule);
vi.mock("@/features/notifications/push-actions", serverModule);
vi.mock("@/features/onboarding/actions/check-onboarding-redirect", serverModule);
vi.mock("@/features/onboarding/actions/complete-initial-setup", serverModule);
vi.mock("@/features/onboarding/actions/dismiss-tenant-onboarding", serverModule);
vi.mock("@/features/onboarding/actions/onboarding-progress-actions", serverModule);
vi.mock("@/features/onboarding/actions/route-onboarding-actions", serverModule);
vi.mock("@/features/operator-catalog/actions", serverModule);
vi.mock("@/features/performance/actions", serverModule);
vi.mock("@/features/post-sale/actions", serverModule);
vi.mock("@/features/promotional-materials/actions", serverModule);
vi.mock("@/features/proposals/actions", serverModule);
vi.mock("@/features/qualification-flow/actions", serverModule);
vi.mock("@/features/qualification-turbo/actions", serverModule);
vi.mock("@/features/quotes/actions", serverModule);
vi.mock("@/features/quotes/external-quote-actions", serverModule);
vi.mock("@/features/relationship/actions", serverModule);
vi.mock("@/features/sales-tools/actions", serverModule);
vi.mock("@/features/sales/actions", serverModule);
vi.mock("@/features/situation-learning/actions", serverModule);
vi.mock("@/features/super-admin/role-impersonation-actions", serverModule);
vi.mock("@/features/supervisor-workspace/actions", serverModule);
vi.mock("@/features/supervisor-workspace/my-team-actions", serverModule);
vi.mock("@/features/supervisor-workspace/notes-actions", serverModule);
vi.mock("@/features/supervisor-workspace/transfer-actions", serverModule);
vi.mock("@/features/system-report/actions", serverModule);
vi.mock("@/features/tenant-intelligence/rag/cotacao-express-actions", serverModule);
vi.mock("@/features/user-profile/actions", serverModule);
vi.mock("@/features/waha-group-capture/admin-actions", serverModule);
vi.mock("@/features/waha-group-capture/channel-actions", serverModule);
vi.mock("@/features/whatsapp-plantao-notice/actions", serverModule);
vi.mock("@/shared/auth/actions", serverModule);
vi.mock("@/shared/auth/password-recovery-client", serverModule);
vi.mock("@/utils/plugins/actions", serverModule);

import LeadDetailPage from "./page";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00.000Z"));
});

afterEach(cleanup);

/** Resolve a página (componente de servidor assíncrono) até a árvore que o React renderiza. */
async function resolveLeadDetailPage() {
  const page = (await LeadDetailPage({ params: Promise.resolve({ id: fixtures.lead.id }), searchParams: Promise.resolve({}) })) as ReactElement<Record<string, unknown>>;
  const content = page.type as (props: Record<string, unknown>) => Promise<ReactElement>;
  return content(page.props);
}

describe("perfil do lead com a chave desligada", () => {
  it("preserva o HTML legado do diretor", async () => {
    fixtures.liteStyle.current = false;
    const tree = await resolveLeadDetailPage();
    const { container } = render(<NuqsTestingAdapter>{tree}</NuqsTestingAdapter>);
    expect(screen.getAllByText("Maria Nova").length).toBeGreaterThan(0);
    expect(container.innerHTML).toMatchSnapshot();
  }, 30_000);

  it("com a chave do diretor, mostra o perfil Lite com as mesmas peças e ações", async () => {
    fixtures.liteStyle.current = true;
    const tree = await resolveLeadDetailPage();
    const { container } = render(<NuqsTestingAdapter>{tree}</NuqsTestingAdapter>);
    fixtures.liteStyle.current = false;
    expect(container.querySelector('[data-skin="diretor"]')).not.toBeNull();
    expect(screen.getByTestId("dashboard-header")).toHaveTextContent("Perfil do lead");
    expect(screen.getByRole("heading", { level: 2, name: "Maria Nova" })).toBeInTheDocument();
    expect(screen.getAllByText("Em atendimento").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Atendimento" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Documentos/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Tarefas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados do lead" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conversas/ })).toHaveAttribute("href", `/conversas?leadId=${fixtures.lead.id}&draft=broker_intro`);
    expect(screen.getByRole("heading", { name: "Dados da empresa (PME)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Origem Meta Ads" })).toBeInTheDocument();
    expect(container.textContent).toContain("Supervisão");
    expect(container.textContent).toContain("Excluir");
    // Contrato: sem título da página repetido no corpo e sem caixa alta nas peças Lite.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  }, 30_000);
});
