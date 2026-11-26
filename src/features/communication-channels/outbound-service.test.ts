import { describe, expect, it, vi } from "vitest";
import { DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS, getInvitationDeliveryFailureUpdate, parseMetaOutboundStaleAfterHours, resolveNoticeTextVariants, resolveTemplateTextBody, isTeamMemberOnlyCompanyNumber, selectInternalBrokerDeliveryRoute, teamCompanyRetryAt, whatsappOutboundStatusValues } from "./outbound-service";

vi.mock("server-only", () => ({}));

describe("outboundService", () => {
  it("sends every message to a team member only through the company number (26/11/2026)", () => {
    expect(isTeamMemberOnlyCompanyNumber({ recipientType: "user", purpose: "dutyPresenceConfirmation" })).toBe(true);
    expect(isTeamMemberOnlyCompanyNumber({ recipientType: "user", purpose: "directText" })).toBe(true);
    expect(isTeamMemberOnlyCompanyNumber({ recipientType: "user", purpose: "postSaleSurvey" })).toBe(false);
    expect(isTeamMemberOnlyCompanyNumber({ recipientType: "lead", purpose: "leadQualification" })).toBe(false);
  });

  it("waits up to 2 h for a company number that is down and retries a refused send 3 times", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(teamCompanyRetryAt({ attempts: 9, createdAt: new Date("2026-11-26T11:00:00Z") }, true, now)).toEqual(new Date("2026-11-26T12:02:00Z"));
    expect(teamCompanyRetryAt({ attempts: 1, createdAt: new Date("2026-11-26T09:59:00Z") }, true, now)).toBeNull();
    expect(teamCompanyRetryAt({ attempts: 0, createdAt: now }, false, now)).toEqual(new Date("2026-11-26T12:01:00Z"));
    expect(teamCompanyRetryAt({ attempts: 2, createdAt: now }, false, now)).toEqual(new Date("2026-11-26T12:04:00Z"));
    expect(teamCompanyRetryAt({ attempts: 3, createdAt: now }, false, now)).toBeNull();
  });

  it("defines supported whatsapp outbound statuses", () => {
    expect(whatsappOutboundStatusValues).toContain("pending");
    expect(whatsappOutboundStatusValues).toContain("queued");
    expect(whatsappOutboundStatusValues).toContain("sent");
    expect(whatsappOutboundStatusValues).toContain("failed");
  });

  it("keeps a transient invitation queued and marks a terminal Meta failure", () => {
    expect(getInvitationDeliveryFailureUpdate({ shouldRetry: true, attempts: 2 })).toMatchObject({
      deliveryStatus: "queued",
      deliveryAttempts: 2,
    });
    expect(getInvitationDeliveryFailureUpdate({ shouldRetry: false, attempts: 5 })).toMatchObject({
      deliveryStatus: "failed",
      deliveryAttempts: 5,
    });
  });

  it("routes every official notification through Meta Cloud", () => {
    expect(selectInternalBrokerDeliveryRoute({
      enabled: true,
      deliveryMode: "waha_direct",
      configuredWahaNumberId: "selected-waha",
      activeWahaNumberId: null,
    })).toEqual({ route: "meta_only", wahaNumberId: null });

    expect(selectInternalBrokerDeliveryRoute({
      enabled: true,
      deliveryMode: "meta_then_waha",
      configuredWahaNumberId: "selected-waha",
      activeWahaNumberId: "selected-waha",
    })).toEqual({ route: "meta_only", wahaNumberId: null });

    expect(selectInternalBrokerDeliveryRoute({
      enabled: false,
      deliveryMode: "waha_direct",
      configuredWahaNumberId: "selected-waha",
      activeWahaNumberId: "selected-waha",
    })).toEqual({ route: "meta_only", wahaNumberId: null });
  });

  it("bounds the stale outbox safety window", () => {
    expect(parseMetaOutboundStaleAfterHours(undefined)).toBe(DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS);
    expect(parseMetaOutboundStaleAfterHours("24")).toBe(24);
    expect(parseMetaOutboundStaleAfterHours("0")).toBe(DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS);
    expect(parseMetaOutboundStaleAfterHours("999")).toBe(DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS);
  });

  it("always routes official template messages through Meta Cloud", () => {
    expect(selectInternalBrokerDeliveryRoute({
      enabled: true,
      deliveryMode: "waha_direct",
      configuredWahaNumberId: "selected-waha",
      activeWahaNumberId: "selected-waha",
      messageType: "template",
    })).toEqual({ route: "meta_only", wahaNumberId: null });
  });

  it("formats template messages into clean plain text for WAHA fallback", () => {
    const inviteText = resolveTemplateTextBody("brokerInvitation", ["Carlos", "Âncora Seguros"], "token-123");
    expect(inviteText).toContain("Olá *Carlos*!");
    expect(inviteText).toContain("Âncora Seguros");
    expect(inviteText).toContain("https://crm.ancorasaude.cloud/primeiro-acesso?token=token-123");

    const leadNotifText = resolveTemplateTextBody("brokerLeadNotification", ["Corretor", "João Silva", "Maria Souza", "Plano de Saúde PME"], "lead-999");
    expect(leadNotifText).toContain("⚡ *Novo Lead Atribuído!*");
    expect(leadNotifText).toContain("Maria Souza");
    expect(leadNotifText).toContain("Plano de Saúde PME");
    // Same destination as the Meta template button: the lead in the CRM.
    expect(leadNotifText).toContain("https://crm.ancorasaude.cloud/leads/lead-999");

    const confirmedText = resolveTemplateTextBody("leadAssignmentConfirmed", ["João Silva", "Ana Lima", "(11) 98888-7777", "Individual", "Saúde Bradesco", "2", "Nova Iguaçu", "lead-999"]);
    expect(confirmedText).toContain("✅ *Atribuição Confirmada*");
    expect(confirmedText).toContain("Ana Lima");
    expect(confirmedText).toContain("(11) 98888-7777");
    expect(confirmedText).toContain("Nova Iguaçu");

    const taskText = resolveTemplateTextBody("taskReminder", ["Carlos", "Retornar orçamento", "15:30"]);
    expect(taskText).toContain("⏰ *Lembrete de Tarefa*");
    expect(taskText).toContain("Retornar orçamento");

    const qualifText = resolveTemplateTextBody("leadQualification", ["Fernanda"]);
    expect(qualifText).toContain("Olá *Fernanda*!");
    expect(qualifText).toContain("Como podemos te ajudar");
  });

  it("formats the activation notice with the configured CRM login URL", () => {
    expect(resolveTemplateTextBody("brokerAccountActivated", ["Ana", "Âncora", "https://crm.ancorasaude.cloud/login"]))
      .toContain("https://crm.ancorasaude.cloud/login");
  });

  it.each([
    ["leadAssignmentUnavailable", "o lead *Fulano de Tal* já foi atribuído"],
    ["leadAssignmentExpired", "o prazo para aceitar o lead *Fulano de Tal*"],
  ] as const)("includes the lead name in Meta text fallback and corporate-number variants for %s", (purpose, expected) => {
    const variables = ["Ana", "Fulano de Tal", "+55 21 99999-0000"];
    expect(resolveTemplateTextBody(purpose, variables)).toContain(expected);
    expect(resolveNoticeTextVariants(purpose, variables, new Date("2026-10-27T12:00:00.000Z")))
      .toEqual(expect.arrayContaining([expect.stringContaining("Fulano de Tal")]));
    expect(resolveNoticeTextVariants(purpose, variables).join(" ")).not.toContain("+55 21 99999-0000");
  });

});
