import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { condicaoSessaoAtiva, condicaoUnidade, sessaoAtivaEm } from "./conexao-status";

vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({}) }));

const DIA = 24 * 60 * 60_000;
const AGORA = new Date("2026-11-04T12:00:00.000Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * DIA);
const base = { userId: "u1", tenantId: "t1", revokedAt: null, expiresAt: new Date(AGORA.getTime() + DIA), createdAt: dias(1), lastSeenAt: dias(0.5) };

describe("sessão ativa (critério da E0a)", () => {
  it("usada há pouco e criada há pouco: ativa", () => {
    expect(sessaoAtivaEm(base, AGORA)).toBe(true);
  });

  it("ociosa há 7 dias ou mais: inativa", () => {
    expect(sessaoAtivaEm({ ...base, lastSeenAt: dias(7) }, AGORA)).toBe(false);
    expect(sessaoAtivaEm({ ...base, lastSeenAt: dias(6.9) }, AGORA)).toBe(true);
  });

  it("nunca usada: a ociosidade conta desde a criação", () => {
    expect(sessaoAtivaEm({ ...base, lastSeenAt: null, createdAt: dias(8) }, AGORA)).toBe(false);
    expect(sessaoAtivaEm({ ...base, lastSeenAt: null, createdAt: dias(6) }, AGORA)).toBe(true);
  });

  it("teto de 30 dias desde a criação, mesmo usada agora", () => {
    expect(sessaoAtivaEm({ ...base, createdAt: dias(30), lastSeenAt: dias(0) }, AGORA)).toBe(false);
    expect(sessaoAtivaEm({ ...base, createdAt: dias(29), lastSeenAt: dias(0) }, AGORA)).toBe(true);
  });

  it("revogada ou vencida: inativa", () => {
    expect(sessaoAtivaEm({ ...base, revokedAt: dias(0) }, AGORA)).toBe(false);
    expect(sessaoAtivaEm({ ...base, expiresAt: dias(0) }, AGORA)).toBe(false);
  });

  it("a consulta SQL carrega usuário, empresa e os limites de 7 e 30 dias", () => {
    const { params } = new PgDialect().sqlToQuery(condicaoSessaoAtiva("u1", "t1", AGORA));
    // Colunas de data chegam como texto ISO e o template SQL como Date: lê os dois formatos.
    const datas = params.flatMap((p) => (p instanceof Date ? [p.getTime()] : typeof p === "string" && /^\d{4}-/.test(p) ? [new Date(p).getTime()] : []));
    expect(params).toEqual(expect.arrayContaining(["u1", "t1"]));
    expect(datas).toEqual(expect.arrayContaining([AGORA.getTime() - 30 * DIA, AGORA.getTime() - 7 * DIA]));
  });
});

describe("unidade do corretor", () => {
  it("filtra pela unidade e pela empresa, não só pelo id", () => {
    const { params, sql } = new PgDialect().sqlToQuery(condicaoUnidade("tenant-b", "unidade-a"));
    expect(params).toEqual(["unidade-a", "tenant-b"]);
    expect(sql).toMatch(/tenant_id/);
  });
});
