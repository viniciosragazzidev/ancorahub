import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarParaExtensao } from "./enviar-extensao";

type Listener = (response: unknown) => void;

function instalarChrome(comportamento: (listener: Listener) => void) {
  const envio = vi.fn((_id: string, _mensagem: unknown, listener: Listener) => comportamento(listener));
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage: envio, lastError: undefined } };
  return envio;
}

describe("envio para a extensão da página de conexão", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("devolve a resposta da extensão quando ela responde", async () => {
    instalarChrome((listener) => listener({ ok: true }));
    await expect(enviarParaExtensao("abcdefghijklmnopabcdefghijklmnop", { type: "CONECTAR_EXTENSAO" })).resolves.toEqual({ ok: true });
  });

  it("sem extensão instalada (sem chrome.runtime), devolve null", async () => {
    await expect(enviarParaExtensao("abcdefghijklmnopabcdefghijklmnop", {})).resolves.toBeNull();
  });

  it("erro do navegador (lastError) devolve null", async () => {
    const envio = vi.fn((_id: string, _m: unknown, listener: Listener) => listener(undefined));
    (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage: envio, lastError: { message: "Could not establish connection" } } };
    await expect(enviarParaExtensao("abcdefghijklmnopabcdefghijklmnop", {})).resolves.toBeNull();
  });

  it("sem resposta, desiste no tempo limite (não fica pendurado)", async () => {
    instalarChrome(() => undefined);
    const pendente = enviarParaExtensao("abcdefghijklmnopabcdefghijklmnop", {}, 15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pendente).resolves.toBeNull();
  });

  it("resposta que chega depois do limite é ignorada", async () => {
    let depois: Listener = () => undefined;
    instalarChrome((listener) => { depois = listener; });
    const pendente = enviarParaExtensao("abcdefghijklmnopabcdefghijklmnop", {}, 15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    depois({ ok: true });
    await expect(pendente).resolves.toBeNull();
  });
});
