import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: vi.fn(),
  schema: {},
}));

import { syncEachWaba, templateExampleValues, WhatsAppTemplateResolver } from "./template-sync-service";

describe("WhatsAppTemplateResolver", () => {
  it("keeps the homologated fallback when the database is unavailable", async () => {
    const { getDatabase } = await import("@/shared/db");
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error("database unavailable"); });
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "brokerLeadNotification")).resolves.toEqual({
      name: "new_lead_broker", language: "pt_BR", isCustom: false,
    });
  });

  it("keeps broker invitations on the broker_first_access fallback", async () => {
    const { getDatabase } = await import("@/shared/db");
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error("database unavailable"); });
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "brokerInvitation")).resolves.toEqual({
      name: "broker_first_access", language: "pt_BR", isCustom: false,
    });
  });

  it("does not fall back to an unapproved presence template when Meta sync is unavailable", async () => {
    const { getDatabase } = await import("@/shared/db");
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error("database unavailable"); });
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "dutyPresenceConfirmation")).resolves.toBeNull();
  });
});

describe("syncEachWaba", () => {
  const at = new Date("2026-11-06T21:00:00Z");
  const decrypt = (ciphertext: string) => {
    if (ciphertext === "quebrado") throw new Error("Token de canal inválido.");
    return `token-${ciphertext}`;
  };

  it("uma WABA com token que não descriptografa não impede a outra de sincronizar", async () => {
    const synced: string[] = [];
    const failed: string[] = [];
    const result = await syncEachWaba(
      [{ wabaId: "waba-ruim", ciphertext: "quebrado" }, { wabaId: "waba-boa", ciphertext: "ok" }],
      decrypt,
      async ({ wabaId, accessToken }) => { synced.push(`${wabaId}:${accessToken}`); return { syncedCount: 3, syncedAt: at }; },
      (wabaId) => failed.push(wabaId),
    );
    expect(synced).toEqual(["waba-boa:token-ok"]);
    expect(failed).toEqual(["waba-ruim"]);
    expect(result).toEqual({ syncedCount: 3, syncedAt: at });
  });

  it("soma as WABAs que sincronizaram e segue depois de uma falha da Meta", async () => {
    const result = await syncEachWaba(
      [{ wabaId: "a", ciphertext: "1" }, { wabaId: "b", ciphertext: "2" }, { wabaId: "c", ciphertext: "3" }],
      decrypt,
      async ({ wabaId }) => { if (wabaId === "b") throw new Error("Graph 500"); return { syncedCount: 2, syncedAt: at }; },
      () => undefined,
    );
    expect(result.syncedCount).toBe(4);
  });

  it("lança erro quando todas falham ou quando não há WABA", async () => {
    await expect(syncEachWaba([{ wabaId: "a", ciphertext: "quebrado" }], decrypt, async () => ({ syncedCount: 1, syncedAt: at }), () => undefined)).rejects.toThrow("Não foi possível sincronizar");
    await expect(syncEachWaba([], decrypt, async () => ({ syncedCount: 1, syncedAt: at }), () => undefined)).rejects.toThrow("Nenhum canal corporativo");
  });
});

describe("templateExampleValues", () => {
  it("usa o exemplo aprovado de cada variável do corpo", () => {
    const components = [{ type: "BODY", text: "Olá, {{1}}! {{2}} e {{3}}", example: { body_text: [["Maria", "Âncora Saúde", "Jane"]] } }];
    expect(templateExampleValues(components, ["1", "2", "3"])).toEqual(["Maria", "Âncora Saúde", "Jane"]);
  });

  it("completa quando falta exemplo e não inventa variável em template sem variável", () => {
    expect(templateExampleValues([{ type: "BODY", text: "{{1}} {{2}}" }], ["1", "2"])).toEqual(["Exemplo 1", "Exemplo 2"]);
    expect(templateExampleValues([{ type: "BODY", text: "Oi" }], [])).toEqual([]);
  });
});
