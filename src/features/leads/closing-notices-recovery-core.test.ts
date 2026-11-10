import { describe, expect, it } from "vitest";

import {
  formatClosingNoticePreview,
  hasPendingClosingNoticeDelivery,
  planClosingNoticeRecovery,
} from "./closing-notices-recovery-core";

const BROKER_KEY = "lead-closing-stage:lead-1:broker-1";
const DIRECTOR = { phone: "5521999990000", key: "lead-closing-director:lead-1:5521999990000" };

describe("recuperação conjunta dos avisos de fechamento", () => {
  it("envia só à direção quando os parabéns já foram registrados", () => {
    const plan = planClosingNoticeRecovery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR],
      existingKeys: new Set([BROKER_KEY]),
    });

    expect(plan).toEqual({ sendCongratulations: false, directorPhones: [DIRECTOR.phone] });
  });

  it("envia só os parabéns quando a direção já recebeu o aviso", () => {
    const plan = planClosingNoticeRecovery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR],
      existingKeys: new Set([DIRECTOR.key]),
    });

    expect(plan).toEqual({ sendCongratulations: true, directorPhones: [] });
  });

  it("envia os dois avisos quando ambos estão pendentes", () => {
    const plan = planClosingNoticeRecovery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR],
      existingKeys: new Set(),
    });

    expect(plan).toEqual({ sendCongratulations: true, directorPhones: [DIRECTOR.phone] });
  });

  it("não agenda envio quando ambos já estão registrados", () => {
    const plan = planClosingNoticeRecovery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR],
      existingKeys: new Set([BROKER_KEY, DIRECTOR.key]),
    });

    expect(plan).toEqual({ sendCongratulations: false, directorPhones: [] });
    expect(hasPendingClosingNoticeDelivery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR.key],
      existingKeys: new Set([BROKER_KEY, DIRECTOR.key]),
    })).toBe(false);
  });

  it("preserva destinatários já enviados e seleciona somente o telefone da direção que falta", () => {
    const otherDirector = { phone: "5521888880000", key: "lead-closing-director:lead-1:5521888880000" };
    expect(planClosingNoticeRecovery({
      brokerKey: BROKER_KEY,
      directorKeys: [DIRECTOR, otherDirector],
      existingKeys: new Set([BROKER_KEY, DIRECTOR.key]),
    })).toEqual({ sendCongratulations: false, directorPhones: [otherDirector.phone] });
  });

  it("mostra status e horário em São Paulo no formato curto", () => {
    expect(formatClosingNoticePreview({
      congratulations: {
        status: "sent",
        sentAt: "2026-11-03T23:09:00.000Z",
        queuedAt: null,
        failedAt: null,
        createdAt: "2026-11-03T23:08:00.000Z",
      },
      directorRecipients: [{ attempt: null }],
    })).toBe("Parabéns: enviado 03/11 20:09 · Direção: não enviado");
  });

  it("identifica o status de cada destinatário da direção sem expor o telefone inteiro", () => {
    expect(formatClosingNoticePreview({
      congratulations: null,
      directorRecipients: [
        { label: "final 0000", attempt: { status: "sent", sentAt: "2026-11-03T23:09:00.000Z", queuedAt: null, failedAt: null, createdAt: null } },
        { label: "final 0001", attempt: null },
      ],
    })).toBe("Parabéns: não enviado · Direção: final 0000: enviado 03/11 20:09 · final 0001: não enviado");
  });
});
