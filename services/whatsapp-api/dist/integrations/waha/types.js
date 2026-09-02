/**
 * Erro tipado do WahaClient.
 * Contém código normalizado e statusCode HTTP correspondente.
 */
export class WahaClientError extends Error {
    code;
    statusCode;
    providerStatusCode;
    constructor(code, statusCode = 502, message, providerStatusCode) {
        super(message ?? code);
        this.code = code;
        this.statusCode = statusCode;
        this.providerStatusCode = providerStatusCode;
        this.name = "WahaClientError";
    }
}
/**
 * Mapeia status reais do WAHA para status normalizados internamente.
 * Consistente com o mapping já existente no waha-relay/server.mjs.
 */
export function normalizeWahaStatus(raw) {
    const s = raw.trim().toUpperCase();
    if (["WORKING", "CONNECTED", "READY", "AUTHENTICATED", "OPEN", "ONLINE"].includes(s))
        return "CONNECTED";
    if (["FAILED", "ERROR", "INVALID", "UNAVAILABLE"].includes(s))
        return "ERROR";
    if (["SCAN_QR_CODE", "STARTING", "WAITING_QR", "WAITING_FOR_QR", "QR", "QR_READY", "CREATED", "INITIALIZING", "CONNECTING", "LOADING"].includes(s))
        return "WAITING_QR";
    if (["STOPPED", "DISCONNECTED", "CLOSED", "LOGGED_OUT", "LOGOUT", "OFFLINE"].includes(s))
        return "DISCONNECTED";
    return "DISCONNECTED";
}
