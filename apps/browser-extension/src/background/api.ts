import { CRM_BASE } from "../config";
import { chamarApi, type Armazem, type Dependencias, type Rede, type RespostaApi } from "./sessao-token";

const TIMEOUT_MS = 15000;

// Credencial guardada só na sessão do navegador (chrome.storage.session), nunca no conteúdo da página.
export const armazemSessao: Armazem = {
  async ler() {
    const token = (await chrome.storage.session.get("token")).token;
    const tokenEm = (await chrome.storage.session.get("tokenEm")).tokenEm;
    return {
      token: typeof token === "string" ? token : undefined,
      tokenEm: typeof tokenEm === "number" ? tokenEm : undefined,
    };
  },
  async gravar({ token, tokenEm }) {
    await chrome.storage.session.set({ token, tokenEm });
  },
  async limpar() {
    await chrome.storage.session.remove(["token", "tokenEm"]);
  },
};

export const redeReal: Rede = async (path, method, token, body): Promise<RespostaApi> => {
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

export const dependenciasReais: Dependencias = { armazem: armazemSessao, rede: redeReal, agora: () => Date.now() };

/** Chamada à API pelo service worker: rotaciona o token quando preciso e limpa a credencial em 401. */
export function chamarApiReal(path: string, method: "GET" | "POST", body?: unknown) {
  return chamarApi(dependenciasReais, path, method, body);
}
