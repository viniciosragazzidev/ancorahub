import { describe, expect, it } from "vitest";
import { conexaoParamsSchema } from "./conexao-schemas";

const EXT = "abcdefghijklmnopabcdefghijklmnop";
const DEVICE = "1f2e3d4c-0000-4000-8000-000000000000";

describe("parâmetros da página de conexão", () => {
  it("aceita id de extensão e aparelho no formato esperado", () => {
    expect(conexaoParamsSchema.safeParse({ ext: EXT, device: DEVICE }).success).toBe(true);
  });

  it("recusa id de extensão com letras fora de a-p ou tamanho errado", () => {
    expect(conexaoParamsSchema.safeParse({ ext: "ABCDEF", device: DEVICE }).success).toBe(false);
    expect(conexaoParamsSchema.safeParse({ ext: EXT.replace("a", "z"), device: DEVICE }).success).toBe(false);
  });

  it("recusa aparelho que não é uuid", () => {
    expect(conexaoParamsSchema.safeParse({ ext: EXT, device: "não-é-uuid" }).success).toBe(false);
  });
});
