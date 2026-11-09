import { describe, expect, it } from "vitest";
import {
  classifyPostSaleRetry,
  describePostSaleRetryResult,
  isChannelSkipReason,
  nextPostSaleRetryAttempt,
  postSaleCampaignBucket,
  postSaleRetryIdempotencyKey,
  summarizePostSaleCampaignSurveys,
  type PostSaleRetrySurvey,
} from "./campaign-retry";

const base: PostSaleRetrySurvey = { status: "failed", skipReason: null, outboundStatus: null, step: 0, hasReply: false, completed: false };

describe("post-sale campaign retry: what can be retried", () => {
  it("retries a survey the outbox failed, cancelled or expired", () => {
    for (const outboundStatus of ["failed", "cancelled", "expired", null]) {
      expect(classifyPostSaleRetry({ ...base, outboundStatus })).toBe("failed");
    }
  });

  it("retries a survey marked sent whose opening Meta rejected later (131042)", () => {
    expect(classifyPostSaleRetry({ ...base, status: "sent", outboundStatus: "failed" })).toBe("failed");
    expect(postSaleCampaignBucket({ ...base, status: "sent", outboundStatus: "failed" })).toBe("failed");
  });

  it("never retries a survey that went out, has a reply or moved past the opening", () => {
    expect(classifyPostSaleRetry({ ...base, status: "sent", outboundStatus: "read" })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "sent", outboundStatus: "failed", hasReply: true })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "sent", outboundStatus: "failed", step: 1 })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "completed", outboundStatus: "failed", completed: true })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "answering", outboundStatus: "failed" })).toBeNull();
  });

  it("leaves the retry to the newer campaign that already has the lead", () => {
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: "número de origem indisponível", superseded: true })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "sent", outboundStatus: "failed", superseded: true })).toBeNull();
  });

  it("does not retry while the outbox row is still in flight", () => {
    for (const outboundStatus of ["queued", "pending", "processing", "sent", "delivered"]) {
      expect(classifyPostSaleRetry({ ...base, outboundStatus })).toBeNull();
    }
    expect(classifyPostSaleRetry({ ...base, status: "queued" })).toBeNull();
  });

  it("retries skips caused by the channel or the template, never by a client protection", () => {
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: "número de origem indisponível" })).toBe("skipped_channel");
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: "template de pós-venda ainda não aprovado" })).toBe("skipped_channel");
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: "Canal Meta de origem indisponível.", outboundStatus: "skipped" })).toBe("skipped_channel");
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: "cliente pediu para parar" })).toBeNull();
    expect(classifyPostSaleRetry({ ...base, status: "skipped", skipReason: null })).toBeNull();
    expect(isChannelSkipReason("Número de origem indisponível.")).toBe(true);
    expect(isChannelSkipReason("conversa humana ativa nas últimas 24 horas")).toBe(false);
  });
});

describe("post-sale campaign retry: outbox keys", () => {
  it("keeps the post-sale:<campaign>:<lead> shape the outbox reads and adds the attempt", () => {
    const key = postSaleRetryIdempotencyKey("camp-1", "lead-1", 1);
    expect(key).toBe("post-sale:camp-1:lead-1:retry:1");
    const [, campaignId, leadId] = key.split(":");
    expect([campaignId, leadId]).toEqual(["camp-1", "lead-1"]);
    expect(key).not.toBe("post-sale:camp-1:lead-1");
  });

  it("uses a new attempt number after the existing ones", () => {
    expect(nextPostSaleRetryAttempt([], "c", "l")).toBe(1);
    expect(nextPostSaleRetryAttempt(["post-sale:c:l:retry:1", "post-sale:c:l:retry:3", "post-sale:c:l", "post-sale:c:other:retry:9", "post-sale:c:l:retry:x"], "c", "l")).toBe(4);
  });

  it("rejects an invalid attempt", () => {
    expect(() => postSaleRetryIdempotencyKey("c", "l", 0)).toThrow();
  });
});

describe("post-sale campaign counts", () => {
  it("counts sent, failed, skipped and retryable from grouped rows", () => {
    const counts = summarizePostSaleCampaignSurveys([
      { ...base, status: "skipped", skipReason: "número de origem indisponível", count: 31 },
      { ...base, status: "sent", outboundStatus: "failed", count: 25 },
      { ...base, status: "sent", outboundStatus: "read", count: 3 },
      { ...base, status: "completed", outboundStatus: "read", hasReply: true, completed: true, count: 1 },
      { ...base, status: "skipped", skipReason: "cliente pediu para parar", count: 2 },
      { ...base, status: "queued", outboundStatus: "pending", count: 4 },
    ]);
    expect(counts).toEqual({ sent: 4, failed: 25, skipped: 33, queued: 4, retryable: 56 });
  });

  it("describes the result in pt-BR without the em dash", () => {
    const text = describePostSaleRetryResult({ requeued: 20, failed: 1, stillSkipped: { "pesquisado nos últimos 60 dias": 3 } });
    expect(text).toBe("20 pesquisas voltaram para a fila. 1 falhou de novo. Continuam fora: 3 pesquisado nos últimos 60 dias.");
    expect(text).not.toContain("—");
  });
});

describe("escopo do gestor no reenvio", () => {
  it("pesquisa de lead de outra unidade fica fora (não é lida, reenviada nem marcada)", async () => {
    const { keepSurveysInUnit } = await import("./campaign-retry");
    const surveys = [{ id: "s1", leadId: "l1" }, { id: "s2", leadId: "l2" }];
    expect(keepSurveysInUnit(surveys, new Set(["l1"])).map((s) => s.id)).toEqual(["s1"]);
    expect(keepSurveysInUnit(surveys, new Set())).toEqual([]);
  });
});
