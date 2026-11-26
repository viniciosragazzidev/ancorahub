import { describe, expect, it } from "vitest";

import { TEAM_NOTICES, teamNoticeByKey } from "./catalog";
import { describeNoticeDelivery, noticeDeliveryReason, noticePurposes, noticeTestable, remainingNoticeTests, type NoticeDeliverySource } from "./deliveries";
import { PREVIEW_VARIABLES } from "./preview-variables";

const base: NoticeDeliverySource = {
  id: "1",
  status: "sent",
  deliveryRoute: "meta_only",
  destinationPhone: "5521996462596",
  holdReason: null,
  providerErrorCode: null,
  providerErrorMessage: null,
  idempotencyKey: "closing:1",
  createdAt: new Date("2026-11-20T12:00:00Z"),
  sentAt: new Date("2026-11-20T12:01:00Z"),
  failedAt: null,
  nextAttemptAt: null,
};

describe("describeNoticeDelivery", () => {
  it("mostra só os 4 últimos dígitos, a hora do envio e o canal", () => {
    expect(describeNoticeDelivery(base)).toEqual({ id: "1", at: "2026-11-20T12:01:00.000Z", to: "final 2596", situation: "sent", reason: "Pela Meta oficial.", test: false });
    expect(describeNoticeDelivery({ ...base, deliveryRoute: "waha_direct", idempotencyKey: "notice-test:X:1:2" })).toMatchObject({ reason: "Pelo WhatsApp da empresa.", test: true });
  });

  it("explica a falha da Meta em pt-BR e cai no código quando não conhece", () => {
    expect(noticeDeliveryReason({ ...base, status: "failed", providerErrorCode: "131026" })).toBe("O número não tem WhatsApp.");
    expect(noticeDeliveryReason({ ...base, status: "failed", providerErrorCode: "999" })).toBe("Falha no envio (código 999).");
  });

  it("diz por que está na fila ou foi descartado", () => {
    expect(describeNoticeDelivery({ ...base, status: "queued", sentAt: null, holdReason: "weekend" })).toMatchObject({ situation: "queued", reason: "Fim de semana. Sai na segunda às 8h." });
    expect(describeNoticeDelivery({ ...base, status: "skipped", sentAt: null, holdReason: "disabled" })).toMatchObject({ situation: "not_sent", reason: "Aviso desligado na hora do envio." });
  });

  it("no que saiu, só conta a troca de canal, nunca uma espera que já passou", () => {
    expect(noticeDeliveryReason({ ...base, holdReason: "outside_business_hours" })).toBe("Pela Meta oficial.");
    expect(noticeDeliveryReason({ ...base, holdReason: "company_number_paused" })).toBe("WhatsApp da empresa pausado. Foi pela Meta oficial.");
    expect(noticeDeliveryReason({ ...base, deliveryRoute: "waha_direct", providerErrorMessage: "Meta não enviou (x); enviado pelo WhatsApp da empresa." })).toBe("A Meta não enviou. Saiu pelo WhatsApp da empresa.");
  });
});

describe("catálogo e teste", () => {
  it("lê o chat como texto livre e os extras do mesmo interruptor", () => {
    expect(noticePurposes(teamNoticeByKey("BROKER_CHAT")!)).toEqual(["directText"]);
    expect(noticePurposes(teamNoticeByKey("LEAD_CONVERTED_DIRECTOR")!)).toEqual(["leadConvertedDirectorAlert", "leadSaleRegisteredDirectorAlert"]);
  });

  it("não testa chat nem os sempre ligados, e todo aviso testável tem valores de exemplo", () => {
    const testable = TEAM_NOTICES.filter(noticeTestable);
    expect(testable.some((notice) => notice.alwaysOn || notice.chat)).toBe(false);
    for (const notice of testable) expect(PREVIEW_VARIABLES[notice.purpose], notice.key).toBeDefined();
  });

  it("limita a 3 testes por hora", () => {
    expect(remainingNoticeTests(0)).toBe(3);
    expect(remainingNoticeTests(5)).toBe(0);
  });
});
