// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsWorkspace } from "./leads-workspace";

// Regressão do incidente de /leads com a chave do diretor (React #130 em produção): a page (Server Component) mandava
// um elemento <LeadsFilters/> e o workspace fazia cloneElement nele. Pelo RSC esse elemento pode chegar como lazy
// (módulo client ainda carregando) e o clone sai com tipo undefined. Agora a page manda só as props (serializáveis).
vi.mock("./_components/leads-filters", () => ({
  LeadsFilters: ({ storageKey, trailing }: { storageKey: string; trailing?: React.ReactNode }) => (
    <div data-testid="lite-filters" data-storage-key={storageKey}>{trailing}</div>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=list"),
  usePathname: () => "/leads",
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
vi.mock("@/features/documents/actions", serverModule);
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

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.localStorage.clear();
});

afterEach(cleanup);

const leads: LeadWorkspaceItem[] = [
  {
    id: "l1",
    nome: "Maria Nova",
    telefone: "21 90000-0101",
    status: "new",
    createdAt: "2026-10-24T14:02:00.000Z",
    qualificationStatus: "hot",
    origem: "Meta Ads",
    sourceCampaign: null,
    tipo: "PME",
    assignedAt: null,
    stageEnteredAt: null,
    serviceStartedAt: null,
    firstContactAt: null,
    corretorId: null,
    corretorNome: null,
    branchId: "b1",
    branchName: "Centro",
  },
];

describe("filtros Lite na barra do workspace de /leads", () => {
  it("recebe as props serializáveis da page e monta os filtros com as abas de visão no fim", () => {
    render(
      <NuqsTestingAdapter>
        <ArcScopeProvider enabled>
          <LeadsWorkspace
            leads={leads}
            contextRole="director"
            initialView="list"
            brokers={[]}
            branches={[]}
            liteFilters={{ storageKey: "teste:filtros", branches: [], brokers: [] }}
          />
        </ArcScopeProvider>
      </NuqsTestingAdapter>,
    );
    const filters = screen.getByTestId("lite-filters");
    expect(filters).toHaveAttribute("data-storage-key", "teste:filtros");
    expect(within(filters).getByRole("tablist", { name: "Visualização de leads" })).toBeInTheDocument();
  });
});
