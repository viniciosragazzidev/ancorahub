import "server-only";

import { createFailureLimiter, ExtensionRateLimitError, ipDoCliente } from "@/features/browser-extension/rate-limit";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { callAncoraSessionStore, toDeviceState, type CallAncoraSnapshot } from "./session-store";

/**
 * API do app Android (Call Âncora). Autenticação só por token de dispositivo no
 * Authorization: Bearer, sem cookies. O token vale para uma sessão e cai quando a web
 * reinicia a sessão.
 */

export const DEVICE_NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

/** Tentativas de pareamento que falharam, por IP: 10 a cada 5 minutos. */
export const devicePairFailures = createFailureLimiter({ requests: 10, windowMs: 5 * 60_000 });

export { ExtensionRateLimitError as DeviceRateLimitError, ipDoCliente as deviceClientIp };

export function deviceJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...DEVICE_NO_STORE, ...extraHeaders } });
}

export function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function featureEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.CALL_ANCORA_VISUAL).catch(() => "false")) === "true";
}

/** A flag global liberada, ou a sessão é de admin/dev (mesma regra da página do celular). */
export async function deviceAllowed(token: string) {
  return (await featureEnabled()) || callAncoraSessionStore.deviceCanUseWhenFlagDisabled(token);
}

export async function pairingAllowed(ticket: string) {
  return (await featureEnabled()) || callAncoraSessionStore.pairingCanUseWhenFlagDisabled(ticket);
}

export function deviceStateBody(snapshot: CallAncoraSnapshot) {
  return { state: toDeviceState(snapshot) };
}

export const DEVICE_UNAUTHORIZED = "O pareamento deste celular terminou. Leia um novo QR na tela do Call Âncora.";
export const DEVICE_DISABLED = "O Call Âncora está desativado.";
