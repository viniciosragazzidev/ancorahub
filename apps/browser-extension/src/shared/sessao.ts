import { CRM_BASE } from "../config";
import { obterDeviceId } from "./dispositivo";
import type { Perfil } from "../background/conexao";
import { avisarMudancaSessao } from "../background/abas";

const TIMEOUT_MS = 15000;

/** Perfil para exibir, amarrado à sessão que o criou: troca de conta invalida o nome antigo. */
export type PerfilGuardado = Perfil & { userId: string; sessionId: string };

/** Troca um código de uso único por sessão. O código amarrado só funciona com a mesma extensão e o mesmo aparelho. */
export async function trocarCodigo(code: string, perfil?: Perfil): Promise<boolean> {
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
    return false;
  }
  const body = (await response.json().catch(() => ({}))) as { token?: unknown; session?: { userId?: unknown; sessionId?: unknown } };
  const { userId, sessionId } = body.session ?? {};
  if (!response.ok || typeof body.token !== "string" || typeof userId !== "string" || typeof sessionId !== "string") return false;
  await chrome.storage.session.set({ token: body.token, tokenEm: Date.now() });
  // Sem perfil novo, apaga o de uma conexão anterior para não mostrar o nome de outra conta.
  if (perfil) await chrome.storage.local.set({ perfil: { ...perfil, userId, sessionId } satisfies PerfilGuardado });
  else await chrome.storage.local.remove("perfil");
  await avisarMudancaSessao();
  return true;
}

/** Perfil guardado, só se tiver o formato completo. */
export async function lerPerfilGuardado(): Promise<PerfilGuardado | null> {
  const { perfil } = await chrome.storage.local.get("perfil");
  if (!perfil || typeof perfil !== "object") return null;
  const { nome, unidade, userId, sessionId } = perfil as Record<string, unknown>;
  return typeof nome === "string" && typeof unidade === "string" && typeof userId === "string" && typeof sessionId === "string"
    ? { nome, unidade, userId, sessionId }
    : null;
}
