// Credencial da extensão no service worker: rotação do token centralizada aqui (B4).
// Dependências são injetadas para testar sem rede nem chrome.storage.

export type Credencial = { token: string; tokenEm: number };
export type Armazem = {
  ler(): Promise<{ token?: string; tokenEm?: number }>;
  gravar(credencial: Credencial): Promise<void>;
  limpar(): Promise<void>;
};
export type RespostaApi = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number };
export type Rede = (path: string, method: "GET" | "POST", token: string | null, body?: unknown) => Promise<RespostaApi>;
export type Dependencias = { armazem: Armazem; rede: Rede; agora(): number };

/** Depois deste tempo sem rotação, o próximo uso do worker troca o token (POST /api/extension/session). */
export const ROTACAO_APOS_MS = 24 * 60 * 60_000;

// Singleflight: várias requisições ao mesmo tempo compartilham uma única rotação em voo.
let rotacaoEmVoo: Promise<string | null> | null = null;

async function rotacionar(deps: Dependencias): Promise<string | null> {
  const { token } = await deps.armazem.ler();
  if (!token) return null;
  const resposta = await deps.rede("/api/extension/session", "POST", token);
  if (resposta.ok && typeof resposta.body.token === "string") {
    // Grava antes de devolver: as próximas requisições já usam o token novo.
    await deps.armazem.gravar({ token: resposta.body.token, tokenEm: deps.agora() });
    return resposta.body.token;
  }
  if (resposta.status === 401) {
    await deps.armazem.limpar();
    return null;
  }
  // Falha transitória (rede ou 5xx): segue com o token atual; a próxima requisição tenta rotacionar de novo.
  return token;
}

/** Token que pode ser usado agora: rotaciona antes se já passou do prazo. */
export async function tokenVigente(deps: Dependencias): Promise<string | null> {
  const credencial = await deps.armazem.ler();
  if (!credencial.token) return null;
  if (credencial.tokenEm !== undefined && deps.agora() - credencial.tokenEm < ROTACAO_APOS_MS) return credencial.token;
  rotacaoEmVoo ??= rotacionar(deps).finally(() => {
    rotacaoEmVoo = null;
  });
  return rotacaoEmVoo;
}

/**
 * Chamada à API com o token vigente. Se o token foi rotacionado enquanto a chamada estava em voo e o servidor
 * recusou o antigo, tenta uma vez com o novo. 401 final limpa a credencial: sem sessão, nada fica guardado.
 */
export async function chamarApi(deps: Dependencias, path: string, method: "GET" | "POST", body?: unknown): Promise<RespostaApi> {
  const token = await tokenVigente(deps);
  // Sem credencial não há o que enviar: 401 direto, sem ir à rede.
  if (!token) return { ok: false, status: 401, body: { error: "SESSION_EXPIRED" } };
  let resposta = await deps.rede(path, method, token, body);
  if (resposta.status === 401 && token) {
    const atual = (await deps.armazem.ler()).token;
    if (atual && atual !== token) resposta = await deps.rede(path, method, atual, body);
  }
  if (resposta.status === 401) await deps.armazem.limpar();
  return resposta;
}
