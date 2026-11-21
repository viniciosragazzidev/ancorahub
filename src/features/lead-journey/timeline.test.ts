import { describe, expect, it } from "vitest";

import { buildTimeline } from "./timeline";

describe("buildTimeline", () => {
  it("junta mensagens, toques, dados e auditoria, do mais recente ao mais antigo", () => {
    const items = buildTimeline({
      messages: [
        { id: "m1", direction: "outbound", sender_role: "assistant", body: "Quantos anos tem quem vai usar o plano?", provider: "meta", provider_status: "sent", sent_at: "2026-11-21T14:48:00Z" },
        { id: "m0", direction: "inbound", sender_role: "user", body: "Familiar, 3 pessoas", provider: "meta", provider_status: null, sent_at: "2026-11-21T14:46:00Z" },
        { id: "ai_silence_followup_l1", direction: "outbound", sender_role: "assistant", body: "Andréia, consegue me dizer a idade?", provider: "waha", provider_status: "sent", sent_at: "2026-11-21T14:56:00Z" },
      ],
      events: [{ event: "question_answered", step_key: "numberOfLives", occurred_at: "2026-11-21T14:46:30Z", metadata: {} }],
      audits: [{ acao: "qualification.timeout_manual_hold", created_at: "2026-11-21T15:05:00Z" }, { acao: "qualification.silence_follow_up_sent:waha", created_at: "2026-11-21T14:56:01Z" }],
      turbo: { touches: [{ touch: "t0", status: "sent", at: "2026-11-21T14:40:00Z" }, { touch: "t2", status: "skipped", errorCode: "template_not_approved", at: "2026-11-21T17:40:00Z" }] },
      memory: { numberOfLives: { value: "3", confidence: 1 }, planType: { value: "familiar", confidence: 1, sourceMessageId: "m0" } },
    });
    expect(items.map((item) => item.title)).toEqual([
      "Lembrete T2 (3 h)",
      "Virou frio e ficou segurado",
      "Follow-up de silêncio",
      "IA",
      "Dado: Vidas",
      "Dado: Tipo de plano",
      "Cliente",
    ]);
    expect(items[0].outcome).toBe("Pulado: template não aprovado na Meta");
    expect(items[2].channel).toBe("WAHA");
    expect(items[4].detail).toBe("3");
  });
});
