import { describe, expect, it } from "vitest";

import { applyPushPrivacy, defaultNotificationPreferences, notificationGroupFor, shouldDeliverNotification } from "@/features/notifications/preferences-core";

import { buildProposalOutcomeNotice } from "./proposal-outcome-notice";

const base = { proposalId: "prop-1", previousStatus: "enviada" as const, previousUpdatedAt: new Date("2026-11-26T12:00:00.000Z"), leadName: "Maria Silva", operatorName: "Amil" };

describe("aviso de proposta aprovada ou recusada", () => {
  it("monta o texto curto com o nome e a operadora", () => {
    expect(buildProposalOutcomeNotice({ ...base, newStatus: "aprovada" })).toMatchObject({
      capability: "proposal_approved",
      title: "Proposta de Maria Silva aprovada pela Amil",
    });
    expect(buildProposalOutcomeNotice({ ...base, newStatus: "perdida" })).toMatchObject({
      capability: "proposal_rejected",
      title: "Proposta de Maria Silva encerrada sem venda",
    });
  });

  it("sem operadora conhecida, diz só operadora", () => {
    expect(buildProposalOutcomeNotice({ ...base, newStatus: "aprovada", operatorName: null })?.title).toBe("Proposta de Maria Silva aprovada pela operadora");
  });

  it("não avisa se o mesmo status for salvo de novo nem em outras mudanças", () => {
    expect(buildProposalOutcomeNotice({ ...base, previousStatus: "aprovada", newStatus: "aprovada" })).toBeNull();
    expect(buildProposalOutcomeNotice({ ...base, newStatus: "negociacao" })).toBeNull();
  });

  it("a mesma mudança gera a mesma chave; uma nova aprovação depois gera outra", () => {
    const first = buildProposalOutcomeNotice({ ...base, newStatus: "aprovada" })!;
    const repeated = buildProposalOutcomeNotice({ ...base, newStatus: "aprovada" })!;
    const later = buildProposalOutcomeNotice({ ...base, previousStatus: "negociacao", previousUpdatedAt: new Date("2026-11-27T12:00:00.000Z"), newStatus: "aprovada" })!;
    expect(repeated.idempotencyKey).toBe(first.idempotencyKey);
    expect(later.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("segue o grupo Proposta e documentos e a privacidade do push", () => {
    expect(notificationGroupFor("proposal_approved")).toBe("proposal_outcome");
    expect(notificationGroupFor("proposal_rejected")).toBe("proposal_outcome");
    const prefs = defaultNotificationPreferences();
    prefs.channels.proposal_outcome.push = false;
    expect(shouldDeliverNotification(prefs, "proposal_approved", "push")).toBe(false);
    const privateOn = { ...defaultNotificationPreferences(), pushPrivacy: true };
    const notice = buildProposalOutcomeNotice({ ...base, newStatus: "aprovada" })!;
    expect(applyPushPrivacy({ title: notice.title, body: notice.message }, privateOn, notice.capability).body).toBe("Uma proposta sua foi aprovada");
    expect(applyPushPrivacy({ title: "x", body: "y" }, privateOn, "proposal_rejected").body).toBe("Uma proposta sua foi encerrada sem venda");
  });
});
