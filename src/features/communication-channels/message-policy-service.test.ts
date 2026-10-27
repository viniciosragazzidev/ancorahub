import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const database = vi.hoisted(() => {
  const results: unknown[][] = [];
  const conditions: SQL[] = [];
  const query = {
    from: () => query,
    where: (condition: SQL) => { conditions.push(condition); return query; },
    orderBy: () => query,
    limit: async () => results.shift() ?? [],
  };
  return { results, conditions, select: () => query };
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"),
  getDatabase: () => database,
}));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => "true" }));

import { resolveApprovedMetaEventTemplate, resolveEventMessagePlan, saveMessageEventPolicy } from "./message-policy-service";

const utility = {
  id: "utility-template", name: "anc_t0_assistente", language: "pt_BR",
  status: "APPROVED", category: "UTILITY", bodyText: "Olá, {{nome}}. Aqui é {{nome_bot}}, da {{empresa}}.",
  variables: ["nome", "nome_bot", "empresa"],
};
const marketing = { ...utility, id: "old-template", name: "retired_first_contact", category: "MARKETING" };
const policy = {
  id: "policy", version: 1, primaryKind: "meta_template", fallbackKind: null,
  metaTemplateId: marketing.id, metaVariableMappingsJson: {}, freeMessageTemplateId: null,
};
const input = { tenantId: "tenant-test", purpose: "leadQualification", variables: ["Cliente Teste", "Assistente Teste", "Empresa Teste"] };
const channel = [{ wabaId: "waba-test" }];

beforeEach(() => {
  database.results.length = 0;
  database.conditions.length = 0;
});

describe("qualification template cost policy", () => {
  it("replaces a stale Marketing FIRST_CONTACT binding with the approved Utility first contact", async () => {
    database.results.push([policy], channel, [marketing], channel, [utility]);
    const plan = await resolveApprovedMetaEventTemplate(input);
    expect(plan?.primary).toMatchObject({ templateName: utility.name, providerVariables: input.variables });
    expect(plan?.fallback).toBeNull();
    expect(plan?.policyId).toBeNull();
  });

  it("keeps an approved configured Utility template and its policy", async () => {
    database.results.push([{ ...policy, metaTemplateId: utility.id }], channel, [utility]);
    const plan = await resolveApprovedMetaEventTemplate(input);
    expect(plan?.primary.templateName).toBe(utility.name);
    expect(plan?.policyId).toBe(policy.id);
  });

  it("blocks instead of keeping Marketing when the Utility alternative is unavailable", async () => {
    database.results.push([policy], channel, [marketing], channel, []);
    await expect(resolveApprovedMetaEventTemplate(input)).resolves.toBeNull();
  });

  it("blocks an explicitly requested template reclassified as Marketing", async () => {
    database.results.push(channel, [{ ...marketing, name: "anc_t1_lembrete" }]);
    await expect(resolveApprovedMetaEventTemplate({ ...input, templateName: "anc_t1_lembrete" })).resolves.toBeNull();
  });

  it("blocks when the default first-contact alternative has also been reclassified", async () => {
    database.results.push([policy], channel, [marketing], channel, [{ ...utility, category: "MARKETING" }]);
    await expect(resolveApprovedMetaEventTemplate(input)).resolves.toBeNull();
  });

  it("requires an active WABA even for a known Utility template name", async () => {
    database.results.push([]);
    await expect(resolveApprovedMetaEventTemplate({ ...input, templateName: "anc_t1_lembrete" })).resolves.toBeNull();
  });

  it("accepts the approved Utility reminder with automatic named-variable mapping", async () => {
    database.results.push(channel, [{ ...utility, name: "anc_t1_lembrete", variables: ["nome", "empresa"] }]);
    const plan = await resolveApprovedMetaEventTemplate({ ...input, templateName: "anc_t1_lembrete" });
    expect(plan?.primary).toMatchObject({ templateName: "anc_t1_lembrete", providerVariables: [input.variables[0], input.variables[2]] });
    const dialect = new PgDialect();
    const filters = database.conditions.map((condition) => dialect.sqlToQuery(condition).params);
    expect(filters[0]).toContain(input.tenantId);
    expect(filters[1]).toEqual(expect.arrayContaining([input.tenantId, "waba-test", "anc_t1_lembrete", "APPROVED"]));
  });

  it("applies the same Utility guard to the ordinary enqueue plan", async () => {
    database.results.push([], [policy], [policy], channel, [marketing], channel, [utility]);
    const plan = await resolveEventMessagePlan({ ...input, recipientType: "lead", recipientId: "lead-test", destinationPhone: "5521900000001" });
    expect(plan?.primary.templateName).toBe(utility.name);
    expect(plan?.fallback).toBeNull();
  });

  it("uses only the synchronized one-parameter contract for a lost lead offer", async () => {
    const lostOfferTemplate = {
      id: "lost-offer-template",
      name: "lead_assignment_expired",
      language: "pt_BR",
      status: "APPROVED",
      category: "UTILITY",
      bodyText: "Olá {{nome}}, o prazo do lead terminou.",
      variables: ["nome"],
    };
    database.results.push([], channel, [], [lostOfferTemplate]);

    const plan = await resolveEventMessagePlan({
      tenantId: "tenant-test",
      recipientType: "user",
      recipientId: "broker-test",
      destinationPhone: "5521999999999",
      purpose: "leadAssignmentExpired",
      variables: ["Ana", "Fulano de Tal"],
    });

    expect(plan?.primary).toMatchObject({
      templateName: "lead_assignment_expired",
      providerVariables: ["Ana"],
      renderedBody: "Olá Ana, o prazo do lead terminou.",
    });
  });

  it("preserves the eligible free message inside the service window", async () => {
    database.results.push([{ sentAt: new Date() }], [{ ...policy, freeMessageTemplateId: "free-test" }], [{ id: "free-test", name: "free", content: "Olá, {{lead_nome}}.", variables: ["lead_nome"] }]);
    const plan = await resolveEventMessagePlan({ ...input, recipientType: "lead", recipientId: "lead-test", destinationPhone: "5521900000001" });
    expect(plan?.primary).toMatchObject({ type: "text", renderedBody: "Olá, Cliente Teste." });
    expect(plan?.fallback).toBeNull();
  });

  it("uses the tenant's free reminder text for WAHA even outside the Meta service window", async () => {
    database.results.push(
      [{ ...policy, eventKey: "DUTY_SHIFT_REMINDER", primaryKind: "free_message", freeMessageTemplateId: "duty-free" }],
      [{ id: "duty-free", name: "Lembrete plantão", category: "internal", content: "Oi {{nome}}, plantão {{plantao}} em {{data}}.", variables: ["nome", "plantao", "data"] }],
    );
    const plan = await resolveEventMessagePlan({
      tenantId: "tenant-test", recipientType: "user", recipientId: "broker-test", destinationPhone: "5521900000001",
      purpose: "dutyShiftReminder", variables: ["Ana", "terça-feira", "27/10", "Presencial tarde", "10:00", "16:00", "online"], forceCompanyFreeText: true,
    });
    expect(plan).toMatchObject({
      eventKey: "DUTY_SHIFT_REMINDER", policyId: "policy", policyVersion: 1, preferWahaDirect: true,
      primary: { type: "text", renderedBody: "Oi Ana, plantão Presencial tarde em 27/10." },
      fallback: null,
    });
  });

  it("does not change the template category policy of unrelated events", async () => {
    database.results.push(channel, [marketing]);
    const plan = await resolveApprovedMetaEventTemplate({ ...input, purpose: "clientNotice", templateName: marketing.name });
    expect(plan?.primary.templateName).toBe(marketing.name);
  });

  it("rejects saving a Marketing binding for FIRST_CONTACT before any write", async () => {
    database.results.push(channel, [marketing]);
    await expect(saveMessageEventPolicy(input.tenantId, "actor-test", {
      eventKey: "FIRST_CONTACT", primaryKind: "meta_template", metaTemplateId: marketing.id,
      freeMessageTemplateId: null, fallbackKind: null, active: true,
    })).rejects.toThrow("Utility");
  });
});
