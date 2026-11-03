type ChromeExterno = {
  runtime?: {
    lastError?: unknown;
    sendMessage?: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
  };
};

const TEMPO_LIMITE_MS = 15_000;

/**
 * Envia a mensagem para a extensão pelo id recebido na URL.
 * Devolve null quando não há extensão instalada, quando há erro do navegador ou quando não responde no tempo limite.
 * Uma resposta que chega depois do limite é ignorada.
 */
export function enviarParaExtensao(extensionId: string, message: unknown, tempoLimiteMs = TEMPO_LIMITE_MS): Promise<{ ok: boolean } | null> {
  const chromeApi = (globalThis as unknown as { chrome?: ChromeExterno }).chrome;
  if (!chromeApi?.runtime?.sendMessage) return Promise.resolve(null);
  return new Promise((resolve) => {
    let concluido = false;
    const concluir = (valor: { ok: boolean } | null) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(limite);
      resolve(valor);
    };
    const limite = setTimeout(() => concluir(null), tempoLimiteMs);
    try {
      chromeApi.runtime!.sendMessage!(extensionId, message, (response) => {
        concluir(chromeApi.runtime?.lastError ? null : (response as { ok: boolean }));
      });
    } catch {
      concluir(null);
    }
  });
}
