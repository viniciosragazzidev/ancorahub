import { CRM_BASE } from "../config";
import { armazenamentoDeSessao, criarCredencialStore } from "./credencial";
import { avisarAbasWhatsApp } from "./abas";
import { chamarApi, type Dependencias, type Metodo, type Rede, type RespostaApi } from "./sessao-token";

const TIMEOUT_MS = 15000;

// Fonte única da credencial no worker. Toda mudança avisa as abas do WhatsApp para descartarem a tela.
export const credencialStore = criarCredencialStore(armazenamentoDeSessao(), () => {
  void avisarAbasWhatsApp();
});

export const redeReal: Rede = async (path, method: Metodo, token, body): Promise<RespostaApi> => {
  try {
    const response = await fetch(`${CRM_BASE}${path}`, {
      method,
      headers: { authorization: token ? `Bearer ${token}` : "", "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const retry = Number(response.headers.get("Retry-After"));
    return {
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => ({})),
      retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined,
    };
  } catch {
    return { ok: false, status: 0, body: { error: "OFFLINE" } };
  }
};

export const dependenciasReais: Dependencias = { store: credencialStore, rede: redeReal, agora: () => Date.now() };

/** Chamada à API pelo worker: a sessão e a rotação ficam no worker; a resposta traz a geração usada. */
export function chamarApiReal(path: string, method: Metodo, body?: unknown) {
  return chamarApi(dependenciasReais, path, method, body);
}
