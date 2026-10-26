import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão das quedas de 26/10 (EMAXCONNSESSION): o build de produção inclui o módulo do banco em
 * mais de um bundle, e cada cópia abria o próprio pool (18 conexões num container). Aqui cada
 * `vi.resetModules()` + import simula uma cópia nova do módulo no mesmo processo.
 */
async function freshCopy() {
  vi.resetModules();
  const client = await import("./client");
  const background = await import("./background-pool");
  return { ...client, ...background };
}

describe("um pool por processo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("ancorahub.db.pools")];
  });

  it("duas cópias do módulo devolvem o mesmo pool de páginas e o mesmo de jobs", async () => {
    // postgres.js só abre socket na primeira query: criar o cliente aqui não conecta em nada.
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:5432/postgres");
    const first = await freshCopy();
    const second = await freshCopy();
    expect(second.getDatabase).not.toBe(first.getDatabase);

    expect(second.getDatabase()).toBe(first.getDatabase());
    const firstBackground = first.runInBackgroundPool(() => first.getDatabase());
    // O escopo aberto por uma cópia vale para o getDatabase() da outra.
    const secondBackground = first.runInBackgroundPool(() => second.getDatabase());
    expect(secondBackground).toBe(firstBackground);
    expect(firstBackground).not.toBe(first.getDatabase());
  });
});
