// Uso da credencial no service worker: rotação do token e chamadas à API (B4).
// Toda decisão usa a geração da sessão: rotação, descarte por 401 e nova tentativa só valem para a mesma sessão.

import type { Credencial, CredencialStore } from "./credencial";

export type Metodo = "GET" | "POST" | "PATCH";
export type RespostaApi = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number };
export type Rede = (path: string, method: Metodo, token: string | null, body?: unknown) => Promise<RespostaApi>;
export type Dependencias = { store: CredencialStore; rede: Rede; agora(): number };

/** Depois deste tempo sem rotação, o próximo uso troca o token (POST /api/extension/session). */
export const ROTACAO_APOS_MS = 24 * 60 * 60_000;

// Singleflight por geração: chamadas simultâneas da mesma sessão dividem uma rotação.
const rotacoesEmVoo = new Map<string, Promise<Credencial | null>>();

async function rotacionar(deps: Dependencias, credencial: Credencial): Promise<Credencial | null> {
  const existente = rotacoesEmVoo.get(credencial.geracao);
  if (existente) return existente;
  const tarefa = (async () => {
    const resposta = await deps.rede("/api/extension/session", "POST", credencial.token);
    if (resposta.ok && typeof resposta.body.token === "string") {
      // Só grava se a sessão ainda é a mesma: outra conta conectada no meio não é sobrescrita.
      return deps.store.rotacionar(credencial.geracao, resposta.body.token, deps.agora());
    }
    if (resposta.status === 401) {
      await deps.store.sairSe(credencial.geracao);
      return null;
    }
    // Falha transitória: segue com a credencial atual; a próxima chamada tenta de novo.
    return credencial;
  })().finally(() => rotacoesEmVoo.delete(credencial.geracao));
  rotacoesEmVoo.set(credencial.geracao, tarefa);
  return tarefa;
}

/** Credencial que pode ser usada agora (rotaciona antes se passou do prazo). Null = sem sessão válida. */
export async function credencialVigente(deps: Dependencias): Promise<Credencial | null> {
  const credencial = await deps.store.ler();
  if (!credencial) return null;
  if (deps.agora() - credencial.tokenEm < ROTACAO_APOS_MS) return credencial;
  return rotacionar(deps, credencial);
}

/**
 * Chamada à API com a sessão vigente. Devolve também a geração usada (null se não havia sessão),
 * para a tela descartar respostas de uma sessão que já não é a atual.
 * Nova tentativa só com o token rotacionado da MESMA geração; 401 final descarta só essa geração.
 */
export async function chamarApi(deps: Dependencias, path: string, method: Metodo, body?: unknown): Promise<RespostaApi & { geracao: string | null }> {
  const credencial = await credencialVigente(deps);
  if (!credencial) return { ok: false, status: 401, body: { error: "SESSION_EXPIRED" }, geracao: null };
  const geracao = credencial.geracao;
  let resposta = await deps.rede(path, method, credencial.token, body);
  if (resposta.status === 401) {
    const atual = await deps.store.ler();
    if (atual?.geracao === geracao && atual.token !== credencial.token) {
      resposta = await deps.rede(path, method, atual.token, body);
    }
    if (resposta.status === 401) await deps.store.sairSe(geracao);
  }
  return { ...resposta, geracao };
}
