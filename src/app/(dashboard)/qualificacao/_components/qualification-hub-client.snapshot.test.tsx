// @vitest-environment jsdom
// Snapshot do HTML de hoje do hub de qualificação (chave desligada), aba por aba, tirado antes da versão Lite.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/qualificacao", useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/features/ai-qualification/actions", () => ({ updateQualificationSettingsAction: vi.fn(), toggleQualificationEnabledAction: vi.fn(), addTestNumberAction: vi.fn(), removeTestNumberAction: vi.fn(), resetMemoryAction: vi.fn(), saveFollowUpRuleAction: vi.fn(), deleteFollowUpRuleAction: vi.fn(), updateToolPermissionAction: vi.fn(), saveDestinationRuleAction: vi.fn(), saveBrokerEligibilityProfileAction: vi.fn(), acknowledgeAlertAction: vi.fn() }));
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title, rightSlot }: { title: string; rightSlot?: React.ReactNode }) => <header data-stub="header"><h1>{title}</h1>{rightSlot}</header> }));
vi.mock("@/features/ai-qualification/components/bulk-qualification-dialog", () => ({ BulkQualificationDialog: () => <div data-stub="bulk" /> }));
vi.mock("@/features/communication-channels/components/whatsapp-test-message-card", () => ({ WhatsAppTestMessageCard: () => <div data-stub="test-message" /> }));
vi.mock("./agent-triggers-panel", () => ({ AgentTriggersPanel: () => <div data-stub="agent-triggers" /> }));
vi.mock("@/app/(dashboard)/settings/_components/agent-training-tab", () => ({ AgentTrainingTab: () => null }));
vi.mock("@/components/dashboard/metric-card", () => ({ StatCard: ({ label, value }: { label: string; value: React.ReactNode }) => <div data-stub="stat">{label}: {value}</div> }));

import { QUALIFICATION_HUB_FIXTURE } from "./qualification-hub-fixtures";
import { QualificationHubClient } from "./qualification-hub-client";

afterEach(() => {
  cleanup();
  search.value = "";
});

describe("hub de qualificação com a chave desligada", () => {
  for (const tab of ["overview", "whatsapp_diag", "agent_triggers", "followup_rules", "simulator"]) {
    it(`aba ${tab}`, () => {
      search.value = `tab=${tab}`;
      const { container } = render(<QualificationHubClient {...QUALIFICATION_HUB_FIXTURE} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});
