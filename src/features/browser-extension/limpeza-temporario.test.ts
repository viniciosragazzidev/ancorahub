import { describe, expect, it, vi } from "vitest";
import { removerTemporario } from "../../../scripts/limpeza-temporario.mjs";
import { criarCredencialStore, type Armazenamento, type Credencial } from "../../../apps/browser-extension/src/background/credencial";

describe("limpeza do temporário do empacotamento", () => {
  it("EPERM na limpeza não derruba o build: só avisa e devolve falso", async () => {
    const erro = Object.assign(new Error("permissão negada"), { code: "EPERM" });
    const avisar = vi.fn();
    const removeu = await removerTemporario("zip.novo", async () => { throw erro; }, avisar);
    expect(removeu).toBe(false);
    expect(avisar.mock.calls[0][0]).toMatch(/EPERM/);
  });

  it("limpeza que funciona devolve verdadeiro sem avisar", async () => {
    const avisar = vi.fn();
    expect(await removerTemporario("zip.novo", async () => undefined, avisar)).toBe(true);
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe("troca de código no worker: nunca sobrescreve outra sessão", () => {
  it("trocar gera nova geração e substitui a credencial anterior", async () => {
    let guardado: Credencial | null = null;
    const armazem: Armazenamento = { ler: async () => (guardado ? { ...guardado } : null), gravar: async (v) => { guardado = v; } };
    const store = criarCredencialStore(armazem);
    const primeira = await store.trocar("token-1", null, 1);
    const segunda = await store.trocar("token-2", null, 2);
    expect(segunda.geracao).not.toBe(primeira.geracao);
    expect((await store.ler())?.token).toBe("token-2");
  });
});
