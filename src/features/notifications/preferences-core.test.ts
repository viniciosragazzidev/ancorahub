import { describe, expect, it } from "vitest";

import { notificationCapabilities } from "./catalog";
import {
  applyPushPrivacy,
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
  notificationGroupFor,
  PRIVATE_PUSH_FALLBACK,
  privatePushText,
  shouldDeliverNotification,
} from "./preferences-core";

describe("preferências de notificação", () => {
  it("todo aviso do catálogo tem um tipo na tela", () => {
    for (const capability of notificationCapabilities) expect(notificationGroupFor(capability.id), capability.id).not.toBeNull();
  });

  it("padrão: tudo ligado e privacidade desligada", () => {
    const prefs = defaultNotificationPreferences();
    expect(prefs.pushPrivacy).toBe(false);
    for (const capability of notificationCapabilities) {
      expect(shouldDeliverNotification(prefs, capability.id, "push")).toBe(true);
      expect(shouldDeliverNotification(prefs, capability.id, "whatsapp")).toBe(true);
    }
  });

  it("desligar o push de um tipo segura só esse tipo e esse canal", () => {
    const prefs = defaultNotificationPreferences();
    prefs.channels.lead_assigned.push = false;
    expect(shouldDeliverNotification(prefs, "lead_assignment", "push")).toBe(false);
    expect(shouldDeliverNotification(prefs, "lead_reassigned", "push")).toBe(false);
    expect(shouldDeliverNotification(prefs, "lead_assignment", "whatsapp")).toBe(true);
    expect(shouldDeliverNotification(prefs, "task_overdue", "push")).toBe(true);
  });

  it("desligar o WhatsApp do lead novo não mexe no push", () => {
    const prefs = defaultNotificationPreferences();
    prefs.channels.lead_assigned.whatsapp = false;
    expect(shouldDeliverNotification(prefs, "lead_assignment", "whatsapp")).toBe(false);
    expect(shouldDeliverNotification(prefs, "lead_assignment", "push")).toBe(true);
  });

  it("sem preferência ou sem tipo conhecido, envia como antes", () => {
    const prefs = defaultNotificationPreferences();
    prefs.channels.task_due.push = false;
    expect(shouldDeliverNotification(null, "task_overdue", "push")).toBe(true);
    expect(shouldDeliverNotification(prefs, undefined, "push")).toBe(true);
    // Tarefa não oferece WhatsApp: o canal que não aparece na tela nunca é bloqueado.
    expect(shouldDeliverNotification(prefs, "task_overdue", "whatsapp")).toBe(true);
  });

  it("lê jsonb parcial ou estranho caindo no padrão", () => {
    const prefs = normalizeNotificationPreferences({ channels: { lead_message: { push: false, whatsapp: "x" }, outro: { push: false } }, pushPrivacy: "sim" });
    expect(prefs.channels.lead_message).toEqual({ push: false, whatsapp: true });
    expect(prefs.channels.lead_assigned).toEqual({ push: true, whatsapp: true });
    expect(prefs.pushPrivacy).toBe(false);
    expect(normalizeNotificationPreferences(null)).toEqual(defaultNotificationPreferences());
  });
});

describe("privacidade do push", () => {
  const payload = { title: "Novo Lead Atribuído! ⚡", body: "O lead \"Maria Souza (21) 99999-0000\" foi distribuído para você.", url: "/leads/1" };

  it("desligada, o texto sai como veio", () => {
    expect(applyPushPrivacy(payload, defaultNotificationPreferences(), "lead_assignment")).toEqual(payload);
  });

  it("ligada, o lead novo vira só 'Lead novo atribuído a você', sem nome nem telefone", () => {
    const prefs = { ...defaultNotificationPreferences(), pushPrivacy: true };
    const result = applyPushPrivacy(payload, prefs, "lead_assignment");
    expect(result.body).toBe("Lead novo atribuído a você");
    expect(`${result.title} ${result.body}`).not.toMatch(/Maria|Souza|9999/);
    expect(result.url).toBe("/leads/1");
  });

  it("todo tipo tem texto genérico, e aviso fora do catálogo usa o padrão", () => {
    for (const capability of notificationCapabilities) expect(privatePushText(capability.id)).toBeTruthy();
    expect(privatePushText("lead_client_returned")).toBe("Mensagem nova de um lead");
    expect(privatePushText(undefined)).toBe(PRIVATE_PUSH_FALLBACK);
  });
});
