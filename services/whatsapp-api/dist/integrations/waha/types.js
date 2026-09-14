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
    // AUTHENTICATING/OPENING são a janela pós-scan (5–30s). Mapear para
    // WAITING_QR (e nunca DISCONNECTED): o relay trata WAITING_QR como
    // "sessão viva — reutilizar, não reiniciar", evitando que um start
    // concorrente destrua o pareamento em andamento. O QR já não é válido
    // nessa janela, então getQr retorna null e a UI mostra "Gerando QR".
    if (["SCAN_QR_CODE", "STARTING", "WAITING_QR", "WAITING_FOR_QR", "QR", "QR_READY", "CREATED", "INITIALIZING", "CONNECTING", "LOADING", "AUTHENTICATING", "OPENING"].includes(s))
        return "WAITING_QR";
    if (["STOPPED", "DISCONNECTED", "CLOSED", "LOGGED_OUT", "LOGOUT", "OFFLINE"].includes(s))
        return "DISCONNECTED";
    return "DISCONNECTED";
}
