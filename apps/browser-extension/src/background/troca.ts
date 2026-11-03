// Troca de código e desconexão, sempre dentro do worker (dona da credencial).
import { CRM_BASE } from "../config";
import { obterDeviceId } from "../shared/dispositivo";
import { credencialStore, redeReal } from "./api";
import type { Perfil } from "./credencial";

const TIMEOUT_MS = 15000;

/** Troca o código de uso único por sessão nova. O código amarrado só vale para a mesma extensão e aparelho. */
export async function trocarCodigoNoWorker(code: string, perfilPedido?: { nome: string; unidade: string }): Promise<{ ok: boolean; geracao?: string }> {
  const deviceId = await obterDeviceId();
  let response: Response;
  try {
    response = await fetch(`${CRM_BASE}/api/extension/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, deviceId, extensionId: chrome.runtime.id, extensionVersion: chrome.runtime.getManifest().version }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false };
  }
  const body = (await response.json().catch(() => ({}))) as { token?: unknown; session?: { userId?: unknown; sessionId?: unknown } };
  const { userId, sessionId } = body.session ?? {};
  if (!response.ok || typeof body.token !== "string" || typeof userId !== "string" || typeof sessionId !== "string") return { ok: false };
  // Perfil só para exibir, amarrado à sessão que o criou: troca de conta não reaproveita o nome.
  const perfil: Perfil | null = perfilPedido ? { ...perfilPedido, userId, sessionId } : null;
  const nova = await credencialStore.trocar(body.token, perfil, Date.now());
  return { ok: true, geracao: nova.geracao };
}

/** Desconecta a sessão indicada: revoga no CRM (se ainda for a atual) e remove só essa geração. */
export async function desconectarNoWorker(geracao: string): Promise<{ revogado: boolean; removido: boolean }> {
  const atual = await credencialStore.ler();
  let revogado = false;
  if (atual?.geracao === geracao) {
    const resposta = await redeReal("/api/extension/auth/revoke", "POST", atual.token).catch(() => null);
    revogado = Boolean(resposta?.ok);
  }
  // Remove mesmo se a revogação falhou: o aparelho deixa de usar a sessão.
  const removido = await credencialStore.sairSe(geracao);
  return { revogado, removido };
}
