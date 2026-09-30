// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveRule, deleteRule, successToast, errorToast } = vi.hoisted(() => ({
  saveRule: vi.fn(),
  deleteRule: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/features/ai-qualification/actions", () => ({
  saveFollowUpRuleAction: saveRule,
  deleteFollowUpRuleAction: deleteRule,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: successToast, error: errorToast } }));

import { FollowUpRulesPanel } from "./followup-rules-panel";

const coldRule = {
  id: "cold-rule-1",
  name: "Reativação de lead frio",
  enabled: true,
  trigger: "cold_lead_reactivation",
  delayMinutes: 120,
  maxAttempts: 1,
  minimumIntervalMinutes: 120,
  allowedDays: [1, 2, 3, 4, 5],
  allowedStartTime: "08:00",
  allowedEndTime: "18:00",
  timezone: "America/Sao_Paulo",
  messageMode: "template",
  fixedMessage: null,
  templateId: null,
  stopConditions: ["client_responded", "human_taken", "lead_closed", "opt_out"],
};

afterEach(() => {
  cleanup();
  saveRule.mockReset();
  deleteRule.mockReset();
  successToast.mockReset();
  errorToast.mockReset();
});

describe("FollowUpRulesPanel cold-lead rule", () => {
  it("shows the default rule as enabled and exposes only its pause switch", () => {
    render(<FollowUpRulesPanel rules={[coldRule]} />);

    expect(screen.getByText(/Template FIRST_CONTACT · uma tentativa · dias úteis, 08h–18h/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pausar Reativação de lead frio" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("persists a pause without allowing tenants to alter the approved template contract", async () => {
    saveRule.mockResolvedValue([{ ...coldRule, enabled: false }]);
    render(<FollowUpRulesPanel rules={[coldRule]} />);

    fireEvent.click(screen.getByRole("switch", { name: "Pausar Reativação de lead frio" }));
    await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1));
    expect(saveRule.mock.calls[0][0]).toMatchObject({
      id: coldRule.id,
      enabled: false,
      trigger: "cold_lead_reactivation",
      delayMinutes: 120,
      maxAttempts: 1,
      messageMode: "template",
      fixedMessage: undefined,
    });
  });
});
