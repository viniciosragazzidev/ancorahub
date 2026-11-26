import { describe, expect, it } from "vitest";

import {
  describeMediaRetentionPreview,
  isLeadMediaRetentionEligible,
  isMediaExpired,
  MEDIA_RETENTION_REMOVED_TEXT,
  mediaRetentionCutoff,
  mediaRetentionReferenceDate,
  parseMediaRetentionPolicy,
  removedMediaBody,
  selectExpiredMedia,
  serializeMediaRetentionPolicy,
  type MediaRetentionCandidate,
} from "./media-retention";

const NOW = new Date("2026-11-26T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function candidate(overrides: Partial<Omit<MediaRetentionCandidate, "lead">> & { lead?: Partial<MediaRetentionCandidate["lead"]> } = {}): MediaRetentionCandidate {
  const { lead, ...rest } = overrides;
  return {
    messageId: "m1",
    storageKey: "whatsapp-media/t1/m1.ogg",
    sentAt: daysAgo(400),
    clientId: null,
    ...rest,
    lead: { status: "lost", archivedAt: null, stageEnteredAt: daysAgo(400), hasClient: false, hasSale: false, ...lead },
  };
}

describe("política de retenção", () => {
  it("nasce em Sempre e nunca apaga sem decisão", () => {
    expect(parseMediaRetentionPolicy(null).option).toBe("always");
    expect(parseMediaRetentionPolicy("lixo").option).toBe("always");
    expect(parseMediaRetentionPolicy(JSON.stringify({ option: "15" })).option).toBe("always");
    expect(mediaRetentionCutoff("always", NOW)).toBeNull();
    expect(isMediaExpired(candidate({ sentAt: daysAgo(5000) }), "always", NOW)).toBe(false);
  });

  it("guarda o prazo e quem escolheu", () => {
    const raw = serializeMediaRetentionPolicy({ option: "365", updatedBy: "u1", updatedAt: NOW.toISOString() });
    expect(parseMediaRetentionPolicy(raw)).toEqual({ option: "365", updatedBy: "u1", updatedAt: NOW.toISOString() });
  });

  it("corta pelos dias de cada opção", () => {
    expect(mediaRetentionCutoff("90", NOW)?.toISOString()).toBe(daysAgo(90).toISOString());
    expect(mediaRetentionCutoff("730", NOW)?.toISOString()).toBe(daysAgo(730).toISOString());
  });
});

describe("prazo", () => {
  it("apaga só o que passou do prazo", () => {
    expect(isMediaExpired(candidate({ sentAt: daysAgo(91), lead: { stageEnteredAt: daysAgo(91) } }), "90", NOW)).toBe(true);
    expect(isMediaExpired(candidate({ sentAt: daysAgo(89), lead: { stageEnteredAt: daysAgo(89) } }), "90", NOW)).toBe(false);
    expect(isMediaExpired(candidate({ sentAt: daysAgo(200), lead: { stageEnteredAt: daysAgo(200) } }), "365", NOW)).toBe(false);
  });

  it("conta da perda quando o lead foi perdido depois da mensagem", () => {
    const recent = candidate({ sentAt: daysAgo(700), lead: { stageEnteredAt: daysAgo(10) } });
    expect(mediaRetentionReferenceDate(recent).toISOString()).toBe(daysAgo(10).toISOString());
    expect(isMediaExpired(recent, "90", NOW)).toBe(false);
  });

  it("conta do arquivamento quando ele é mais recente", () => {
    const archived = candidate({ sentAt: daysAgo(700), lead: { status: "in_contact", archivedAt: daysAgo(30), stageEnteredAt: daysAgo(700) } });
    expect(isMediaExpired(archived, "90", NOW)).toBe(false);
    expect(isMediaExpired({ ...archived, lead: { ...archived.lead, archivedAt: daysAgo(120) } }, "90", NOW)).toBe(true);
  });

  it("a entrada na etapa só conta para lead perdido", () => {
    const archived = candidate({ sentAt: daysAgo(400), lead: { status: "negotiation", archivedAt: daysAgo(400), stageEnteredAt: daysAgo(1) } });
    expect(isMediaExpired(archived, "365", NOW)).toBe(true);
  });
});

describe("situação do lead", () => {
  it("só perdido ou arquivado", () => {
    expect(isLeadMediaRetentionEligible({ status: "lost", archivedAt: null, stageEnteredAt: null, hasClient: false, hasSale: false })).toBe(true);
    expect(isLeadMediaRetentionEligible({ status: "negotiation", archivedAt: daysAgo(1), stageEnteredAt: null, hasClient: false, hasSale: false })).toBe(true);
    expect(isMediaExpired(candidate({ lead: { status: "negotiation", archivedAt: null } }), "90", NOW)).toBe(false);
    expect(isMediaExpired(candidate({ lead: { status: "new", archivedAt: null } }), "90", NOW)).toBe(false);
  });

  it("nunca apaga de lead convertido, com cliente ou com venda", () => {
    expect(isMediaExpired(candidate({ lead: { status: "converted", archivedAt: daysAgo(400) } }), "90", NOW)).toBe(false);
    expect(isMediaExpired(candidate({ lead: { hasClient: true } }), "90", NOW)).toBe(false);
    expect(isMediaExpired(candidate({ lead: { hasSale: true } }), "90", NOW)).toBe(false);
    expect(isMediaExpired(candidate({ clientId: "c1" }), "90", NOW)).toBe(false);
  });
});

describe("idempotência", () => {
  it("mensagem sem arquivo guardado não entra de novo", () => {
    expect(isMediaExpired(candidate({ storageKey: null }), "90", NOW)).toBe(false);
  });

  it("seleciona só os vencidos e uma segunda rodada não acha nada", () => {
    const rows = [
      candidate({ messageId: "old" }),
      candidate({ messageId: "fresh", sentAt: daysAgo(10), lead: { stageEnteredAt: daysAgo(10) } }),
      candidate({ messageId: "client", lead: { hasClient: true } }),
    ];
    const first = selectExpiredMedia(rows, "90", NOW);
    expect(first.map((row) => row.messageId)).toEqual(["old"]);
    const after = rows.map((row) => (first.includes(row) ? { ...row, storageKey: null } : row));
    expect(selectExpiredMedia(after, "90", NOW)).toEqual([]);
  });

  it("o aviso entra no lugar do arquivo e não se repete", () => {
    expect(removedMediaBody("[audio]")).toBe(MEDIA_RETENTION_REMOVED_TEXT);
    expect(removedMediaBody("")).toBe(MEDIA_RETENTION_REMOVED_TEXT);
    const caption = removedMediaBody("Segue o RG");
    expect(caption).toBe(`Segue o RG\n\n${MEDIA_RETENTION_REMOVED_TEXT}`);
    expect(removedMediaBody(caption)).toBe(caption);
    expect(removedMediaBody(MEDIA_RETENTION_REMOVED_TEXT)).toBe(MEDIA_RETENTION_REMOVED_TEXT);
  });
});

describe("prévia na tela", () => {
  it("diz quantos arquivos a próxima limpeza remove", () => {
    expect(describeMediaRetentionPreview("90", 1)).toBe("Próxima limpeza remove cerca de 1 arquivo.");
    expect(describeMediaRetentionPreview("90", 1200)).toBe("Próxima limpeza remove cerca de 1.200 arquivos.");
    expect(describeMediaRetentionPreview("90", 0)).toBe("Próxima limpeza não remove nenhum arquivo.");
    expect(describeMediaRetentionPreview("always", 50)).toBe("Nenhuma mídia é apagada.");
  });
});
