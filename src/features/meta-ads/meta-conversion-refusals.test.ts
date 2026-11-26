import { describe, expect, it } from "vitest";

import { checkMetaConversionRetry, describeMetaConversionRefusal, metaConversionStageLabel } from "./meta-conversion-refusals";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-25T12:00:00.000Z");

describe("describeMetaConversionRefusal", () => {
  it.each([
    ["A Meta recusou o token da conexão para esta fonte de dados (código 190). Reconecte com a permissão ads_management.", "token", "Token expirado"],
    ["Meta recusou o envio (código 100): Error validating access token: Session has expired", "token", "Token expirado"],
    ["Meta recusou o envio (código 100): Object with ID '556677' does not exist, cannot be loaded due to missing permissions", "token", "Token expirado"],
    ["Meta recusou o envio (código 100): Unsupported post request. Object with ID '556677' does not exist", "dataset", "Pixel ou fonte de dados inválido"],
    ["Meta recusou o envio (código 100): Invalid pixel id", "dataset", "Pixel ou fonte de dados inválido"],
    ["Meta recusou o envio: Duplicate event_id for this dataset", "duplicate", "Evento duplicado"],
    ["Evento recusado pela Meta: parâmetro em_hash ausente para 1 lead sem e-mail.", "user_data", "Dados do lead insuficientes"],
    ["Meta recusou o envio (código 100): The parameter user_data must contain customer information", "user_data", "Dados do lead insuficientes"],
    ["Meta recusou o envio (código 100): event_time is more than 7 days ago", "window", "Fora da janela de 7 dias"],
    ["Evento com mais de 7 dias: a Meta não aceita mais.", "window", "Fora da janela de 7 dias"],
    ["Meta recusou o envio: HTTP 500", "meta", "Erro da Meta"],
    ["Falha de rede ao enviar para a Meta: fetch failed", "meta", "Erro da Meta"],
  ])("%s", (error, kind, label) => {
    const reason = describeMetaConversionRefusal(error);
    expect(reason.kind).toBe(kind);
    expect(reason.label).toBe(label);
    expect(reason.hint).not.toMatch(/—/);
  });

  it("sem erro gravado ou texto desconhecido cai em Motivo não informado", () => {
    expect(describeMetaConversionRefusal(null).label).toBe("Motivo não informado");
    expect(describeMetaConversionRefusal("   ").label).toBe("Motivo não informado");
    expect(describeMetaConversionRefusal("xyz").label).toBe("Motivo não informado");
  });

  it("nomeia a etapa enviada", () => {
    expect(metaConversionStageLabel("lead_received")).toBe("Lead recebido");
    expect(metaConversionStageLabel("qualified")).toBe("Qualificado");
    expect(metaConversionStageLabel("hot")).toBe("Quente");
    expect(metaConversionStageLabel("sale")).toBe("Venda");
  });
});

describe("checkMetaConversionRetry", () => {
  const base = { status: "failed", eventTime: new Date(now.getTime() - 2 * DAY), lastError: "Meta recusou o envio: HTTP 500", enabled: true, now };

  it("recusa recente com envio ligado volta para a fila", () => {
    expect(checkMetaConversionRetry(base)).toEqual({ retryable: true });
  });

  it("passou dos 7 dias: recusa com causa", () => {
    const check = checkMetaConversionRetry({ ...base, eventTime: new Date(now.getTime() - 7 * DAY - 1000) });
    expect(check).toEqual({ retryable: false, cause: expect.stringContaining("7 dias") });
  });

  it("no limite dos 7 dias ainda volta", () => {
    expect(checkMetaConversionRetry({ ...base, eventTime: new Date(now.getTime() - 7 * DAY) }).retryable).toBe(true);
  });

  it("duplicado, envio desligado e linha que não está recusada não voltam", () => {
    expect(checkMetaConversionRetry({ ...base, lastError: "Duplicate event_id" }).retryable).toBe(false);
    expect(checkMetaConversionRetry({ ...base, enabled: false })).toEqual({ retryable: false, cause: expect.stringContaining("desligado") });
    expect(checkMetaConversionRetry({ ...base, status: "pending" }).retryable).toBe(false);
    expect(checkMetaConversionRetry({ ...base, status: "sent" }).retryable).toBe(false);
  });
});
