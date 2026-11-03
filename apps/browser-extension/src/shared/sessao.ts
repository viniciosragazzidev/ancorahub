import { CRM_BASE } from "../config";
import { obterDeviceId } from "./dispositivo";
import type { Perfil } from "../background/conexao";

/** Troca um código de uso único por sessão. O código amarrado só funciona com a mesma extensão e o mesmo aparelho. */
export async function trocarCodigo(code: string, perfil?: Perfil): Promise<boolean> {
  const deviceId = await obterDeviceId();
  const response = await fetch(`${CRM_BASE}/api/extension/auth/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, deviceId, extensionId: chrome.runtime.id, extensionVersion: chrome.runtime.getManifest().version }),
  });
  const body = (await response.json().catch(() => ({}))) as { token?: unknown };
  if (!response.ok || typeof body.token !== "string") return false;
  await chrome.storage.session.set({ token: body.token });
  // Sem perfil novo, apaga o de uma conexão anterior para não mostrar o nome de outra conta.
  if (perfil) await chrome.storage.local.set({ perfil });
  else await chrome.storage.local.remove("perfil").catch(() => undefined);
  return true;
}
