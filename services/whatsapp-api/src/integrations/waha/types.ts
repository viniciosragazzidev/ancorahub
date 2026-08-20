/**
 * Erros normalizados do WahaClient.
 * Nunca expor stack traces ou detalhes internos ao consumidor.
 */
export type WahaErrorCode =
  | "WAHA_UNAVAILABLE"
  | "WAHA_TIMEOUT"
  | "WAHA_UNAUTHORIZED"
  | "WAHA_BAD_RESPONSE"
  | "WAHA_INTERNAL_ERROR";

/**
 * Status normalizados internamente.
 * Mapeados a partir dos status reais do WAHA para não espalhar
 * strings específicas do WAHA pelo sistema.
 */
export type WahaSessionStatus =
  | "DISCONNECTED"
  | "STARTING"
  | "WAITING_QR"
  | "CONNECTED"
  | "ERROR";

/**
 * Resultado de uma operação de health check.
 */
export type WahaHealthResult = {
  ok: boolean;
  status: "healthy" | "unavailable" | "timeout" | "unauthorized";
  error?: WahaErrorCode;
  durationMs: number;
};

/**
 * Representação normalizada de uma sessão WAHA.
 */
export type WahaSession = {
  name: string;
  status: WahaSessionStatus;
  displayPhoneNumber: string | null;
  qrCode: string | null;
};

/**
 * Erro tipado do WahaClient.
 * Contém código normalizado e statusCode HTTP correspondente.
 */
export class WahaClientError extends Error {
  constructor(
    public readonly code: WahaErrorCode,
    public readonly statusCode: number = 502,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WahaClientError";
  }
}

/**
 * Mapeia status reais do WAHA para status normalizados internamente.
 * Consistente com o mapping já existente no waha-relay/server.mjs.
 */
export function normalizeWahaStatus(raw: string): WahaSessionStatus {
  const s = raw.toUpperCase();
  if (s === "WORKING") return "CONNECTED";
  if (s === "STOPPED") return "DISCONNECTED";
  if (s === "FAILED") return "ERROR";
  if (s === "SCAN_QR_CODE" || s === "STARTING") return "WAITING_QR";
  return "DISCONNECTED";
}
