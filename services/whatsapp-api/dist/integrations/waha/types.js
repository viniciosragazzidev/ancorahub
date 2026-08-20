/**
 * Erro tipado do WahaClient.
 * Contém código normalizado e statusCode HTTP correspondente.
 */
export class WahaClientError extends Error {
    code;
    statusCode;
    constructor(code, statusCode = 502, message) {
        super(message ?? code);
        this.code = code;
        this.statusCode = statusCode;
        this.name = "WahaClientError";
    }
}
/**
 * Mapeia status reais do WAHA para status normalizados internamente.
 * Consistente com o mapping já existente no waha-relay/server.mjs.
 */
export function normalizeWahaStatus(raw) {
    const s = raw.toUpperCase();
    if (s === "WORKING")
        return "CONNECTED";
    if (s === "STOPPED")
        return "DISCONNECTED";
    if (s === "FAILED")
        return "ERROR";
    if (s === "SCAN_QR_CODE" || s === "STARTING")
        return "WAITING_QR";
    return "DISCONNECTED";
}
