import { z } from "zod";

import {
  DEVICE_DISABLED,
  DeviceRateLimitError,
  deviceClientIp,
  deviceJson,
  devicePairFailures,
  deviceStateBody,
  pairingAllowed,
} from "@/features/call-ancora/device-api";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** App Android: troca o ticket do QR (uso único, 2 min) por um token de dispositivo. */
export async function POST(request: Request) {
  const ip = deviceClientIp(request);
  try {
    devicePairFailures.verificar(ip);
  } catch (error) {
    if (error instanceof DeviceRateLimitError) {
      return deviceJson({ error: "Muitas tentativas. Espere alguns minutos e leia um novo QR." }, 429, { "Retry-After": String(error.retryAfter) });
    }
    throw error;
  }

  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,80}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    devicePairFailures.registrarFalha(ip);
    return deviceJson({ error: "O código de pareamento está incompleto." }, 400);
  }
  if (!(await pairingAllowed(parsed.data.token))) {
    devicePairFailures.registrarFalha(ip);
    return deviceJson({ error: DEVICE_DISABLED }, 403);
  }

  const result = callAncoraSessionStore.pair(parsed.data.token);
  if (!result.ok) {
    devicePairFailures.registrarFalha(ip);
    const status = result.reason === "expired" ? 410 : result.reason === "reused" ? 409 : 404;
    const error = result.reason === "expired"
      ? "Este QR venceu. Gere outro na tela do Call Âncora."
      : result.reason === "reused"
        ? "Este QR já foi usado. Gere outro na tela do Call Âncora."
        : "Não encontrei uma sessão para este QR.";
    return deviceJson({ error }, status);
  }

  return deviceJson({
    deviceToken: result.deviceToken,
    brokerFirstName: result.snapshot.brokerFirstName,
    sessionId: result.snapshot.sessionId,
    ...deviceStateBody(result.snapshot),
  });
}
