import { describe, expect, it, vi } from "vitest";
import { getInvitationDeliveryFailureUpdate, resolveTemplateTextBody, whatsappOutboundStatusValues } from "./outbound-service";
import { BROKER_LEAD_NOTIFICATION_INTERVAL_MS, scheduleBrokerLeadNotification } from "@/features/notifications/broker-lead-cadence";

vi.mock("server-only", () => ({}));

describe("outboundService", () => {
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

  it("spaces broker lead notifications by the configured interval", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(scheduleBrokerLeadNotification({ now }).toISOString()).toBe(now.toISOString());
    expect(scheduleBrokerLeadNotification({ now, lastScheduledAt: now }).toISOString())
      .toBe(new Date(now.getTime() + BROKER_LEAD_NOTIFICATION_INTERVAL_MS).toISOString());
  });

  it("formats template messages into clean plain text for WAHA fallback", () => {
    const inviteText = resolveTemplateTextBody("brokerInvitation", ["Carlos", "Âncora Seguros"], "token-123");
    expect(inviteText).toContain("Olá *Carlos*!");
    expect(inviteText).toContain("Âncora Seguros");
    expect(inviteText).toContain("https://ancorahub.com.br/convite/token-123");

    const leadNotifText = resolveTemplateTextBody("brokerLeadNotification", ["Corretor", "João Silva", "Maria Souza", "Plano de Saúde PME"], "lead-999");
    expect(leadNotifText).toContain("⚡ *Novo Lead Atribuído!*");
    expect(leadNotifText).toContain("Maria Souza");
    expect(leadNotifText).toContain("Plano de Saúde PME");
    expect(leadNotifText).toContain("https://ancorahub.com.br/conversas?lead=lead-999");

    const confirmedText = resolveTemplateTextBody("leadAssignmentConfirmed", ["João Silva", "Ana Lima", "(11) 98888-7777", "Individual", "Saúde Bradesco", "2", "lead-999"]);
    expect(confirmedText).toContain("✅ *Atribuição Confirmada*");
    expect(confirmedText).toContain("Ana Lima");
    expect(confirmedText).toContain("(11) 98888-7777");

    const taskText = resolveTemplateTextBody("taskReminder", ["Carlos", "Retornar orçamento", "15:30"]);
    expect(taskText).toContain("⏰ *Lembrete de Tarefa*");
    expect(taskText).toContain("Retornar orçamento");

    const qualifText = resolveTemplateTextBody("leadQualification", ["Fernanda"]);
    expect(qualifText).toContain("Olá *Fernanda*!");
    expect(qualifText).toContain("Como podemos te ajudar");
  });
});
