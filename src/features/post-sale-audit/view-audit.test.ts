import { describe, expect, it } from "vitest";

import { postSaleViewAuditId } from "./view-audit";

const base = { tenantId: "t1", userId: "u1", entity: "post_sale_survey", entityId: "s1", action: "post_sale_survey.messages_viewed" };

describe("auditoria de visualização do pós-venda", () => {
  it("repete o id dentro da mesma hora (uma linha por hora)", () => {
    expect(postSaleViewAuditId({ ...base, now: new Date("2026-11-09T15:00:00Z") })).toBe(postSaleViewAuditId({ ...base, now: new Date("2026-11-09T15:59:59Z") }));
  });

  it("gera outro id na hora seguinte, para outro usuário, outra pesquisa ou outra ação", () => {
    const id = postSaleViewAuditId({ ...base, now: new Date("2026-11-09T15:10:00Z") });
    expect(postSaleViewAuditId({ ...base, now: new Date("2026-11-09T16:00:00Z") })).not.toBe(id);
    expect(postSaleViewAuditId({ ...base, userId: "u2", now: new Date("2026-11-09T15:10:00Z") })).not.toBe(id);
    expect(postSaleViewAuditId({ ...base, entityId: "s2", now: new Date("2026-11-09T15:10:00Z") })).not.toBe(id);
    expect(postSaleViewAuditId({ ...base, action: "post_sale_survey.viewed", now: new Date("2026-11-09T15:10:00Z") })).not.toBe(id);
    expect(postSaleViewAuditId({ ...base, tenantId: "t2", now: new Date("2026-11-09T15:10:00Z") })).not.toBe(id);
  });

  it("cabe na chave primária de texto", () => {
    expect(postSaleViewAuditId({ ...base, now: new Date() })).toMatch(/^post-sale-view-[0-9a-f]{40}$/);
  });
});
