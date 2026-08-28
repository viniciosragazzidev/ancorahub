/**
 * Erros normalizados do WahaClient.
 * Nunca expor stack traces ou detalhes internos ao consumidor.
 */
export type WahaErrorCode =
  | "WAHA_UNAVAILABLE"
  | "WAHA_TIMEOUT"
  | "WAHA_UNAUTHORIZED"
  | "WAHA_BAD_RESPONSE"
  | "WAHA_INTERNAL_ERROR"
  | "SESSION_NOT_FOUND"
  | "SESSION_EXISTS"
  | "QR_NOT_READY"
  | "QR_EXPIRED";

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
    public readonly providerStatusCode?: number,
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
  const s = raw.trim().toUpperCase();
  if (["WORKING", "CONNECTED", "READY", "AUTHENTICATED", "OPEN", "ONLINE"].includes(s)) return "CONNECTED";
  if (["FAILED", "ERROR", "INVALID", "UNAVAILABLE"].includes(s)) return "ERROR";
  if (["SCAN_QR_CODE", "STARTING", "WAITING_QR", "WAITING_FOR_QR", "QR", "QR_READY", "CREATED", "INITIALIZING", "CONNECTING", "LOADING"].includes(s)) return "WAITING_QR";
  if (["STOPPED", "DISCONNECTED", "CLOSED", "LOGGED_OUT", "LOGOUT", "OFFLINE"].includes(s)) return "DISCONNECTED";
  return "DISCONNECTED";
}
