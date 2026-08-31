import type { WahaConfig } from "../../config.js";
import {
  WahaClientError,
  normalizeWahaStatus,
  type WahaHealthResult,
  type WahaSession,
  type WahaSessionStatus,
} from "./types.js";

type FetchFn = typeof globalThis.fetch;

export type WahaRecoveryCleanup = {
  operation: "stop" | "logout" | "delete";
  outcome: "completed" | "ignored";
  providerStatusCode?: number;
  normalizedError?: string;
};

/**
 * Cliente central para comunicação com o WAHA.
 *
 * Responsabilidades:
 * - Executar chamadas HTTP ao WAHA com autenticação `x-api-key`
 * - Aplicar timeout explícito em toda operação
 * - Normalizar erros em códigos conhecidos
 * - Nunca expor secrets
 *
 * Arquitetura:
 *   Fastify route → WahaClient → WAHA
 */
export class WahaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly healthTimeoutMs: number;
  private readonly fetchFn: FetchFn;

  constructor(config: WahaConfig, fetchFn: FetchFn = globalThis.fetch) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.healthTimeoutMs = config.healthTimeoutMs;
    this.fetchFn = fetchFn;
  }

  /**
   * Executa uma chamada HTTP autenticada ao WAHA.
   * Timeout aplicado em toda operação.
   * Preserva providerStatusCode para diagnóstico.
   */
  private async request<T = unknown>(
    path: string,
    options: {
      method?: string;
      timeoutMs?: number;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const { method = "GET", timeoutMs = 15_000, body, headers = {} } = options;

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "x-api-key": this.apiKey,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new WahaClientError("WAHA_TIMEOUT", 504, "WAHA não respondeu dentro do timeout.");
      }
      throw new WahaClientError("WAHA_UNAVAILABLE", 502, "WAHA indisponível.");
    }

    if (response.status === 401) {
      throw new WahaClientError("WAHA_UNAUTHORIZED", 502, "Autenticação com WAHA falhou.");
    }

    if (!response.ok) {
      throw new WahaClientError(
        "WAHA_INTERNAL_ERROR",
        502,
        `WAHA retornou status ${response.status}.`,
        response.status,
      );
    }

    // DELETE bem-sucedido pode responder 204 sem corpo. Não é uma falha de
    // contrato nem deve abortar a recuperação da sessão.
    if (response.status === 204) return {} as T;

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new WahaClientError("WAHA_BAD_RESPONSE", 502, "WAHA retornou JSON inválido.");
    }

    return data as T;
  }

  /**
   * Executa uma chamada que pode retornar binário (ex: image/png para QR).
   * Tenta JSON primeiro; se Content-Type indicar imagem, retorna base64.
   */
  private async requestQr(
    path: string,
    timeoutMs = 5_000,
  ): Promise<{ base64: string | null; status: string | null }> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          accept: "application/json, image/*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new WahaClientError("WAHA_TIMEOUT", 504, "WAHA não respondeu dentro do timeout.");
      }
      throw new WahaClientError("WAHA_UNAVAILABLE", 502, "WAHA indisponível.");
    }

    if (response.status === 401) {
      throw new WahaClientError("WAHA_UNAUTHORIZED", 502, "Autenticação com WAHA falhou.");
    }

    if (!response.ok) {
      throw new WahaClientError(
        "WAHA_INTERNAL_ERROR",
        502,
        `WAHA retornou status ${response.status} ao buscar QR.`,
        response.status,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    // Se retornar imagem binária, converter para base64
    if (contentType.includes("image/")) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) return { base64: null, status: null };
      const base64 = Buffer.from(buffer).toString("base64");
      return { base64, status: null };
    }

    // Senão, tentar parsear como JSON
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new WahaClientError("WAHA_BAD_RESPONSE", 502, "WAHA retornou JSON inválido no endpoint de QR.");
    }

    const obj = data as Record<string, unknown> | null;
    if (obj && typeof obj === "object") {
      const qrData = typeof obj.data === "string" ? obj.data : null;
      const sessionStatus = typeof obj.status === "string" ? obj.status : null;
      return { base64: qrData, status: sessionStatus };
    }

    return { base64: null, status: null };
  }

  /**
   * Health check do WAHA.
   * Valida: serviço responde, autenticação funciona, resposta é válida.
   */
  async health(): Promise<WahaHealthResult> {
    const startedAt = Date.now();

    try {
      await this.request("/api/server/health", {
        timeoutMs: this.healthTimeoutMs,
      });
      return {
        ok: true,
        status: "healthy",
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (error instanceof WahaClientError) {
        const status =
          error.code === "WAHA_TIMEOUT"
            ? "timeout"
            : "unavailable";
        return { ok: false, status, error: error.code, durationMs };
      }
      return {
        ok: false,
        status: "unavailable",
        error: "WAHA_UNAVAILABLE",
        durationMs,
      };
    }
  }

  /**
   * Consulta o status de uma sessão.
   * Retorna null SOMENTE quando a sessão realmente não existe (404).
   * Outros erros são propagados para diagnóstico correto.
   */
  async getSession(name: string): Promise<WahaSession | null> {
    try {
      const raw = await this.request<{
        name?: string;
        status?: string;
        me?: { id?: string };
      }>(`/api/sessions/${encodeURIComponent(name)}`, {
        timeoutMs: 5_000,
      });

      const rawStatus = String(raw?.status ?? "").toUpperCase();
      const status: WahaSessionStatus =
        rawStatus === "WORKING" ? "CONNECTED" : normalizeWahaStatus(rawStatus);

      const displayPhoneNumber =
        status === "CONNECTED" && typeof raw?.me?.id === "string"
          ? raw.me.id.replace(/@.+$/, "")
          : null;

      return {
        name: raw?.name ?? name,
        status,
        displayPhoneNumber,
        qrCode: null,
      };
    } catch (error) {
      if (error instanceof WahaClientError && error.providerStatusCode === 404) {
        // Sessão realmente não existe
        return null;
      }
      throw error;
    }
  }

  /**
   * Cria uma nova sessão no WAHA.
   * Se a sessão já existe (409), retorna o status atual (idempotente).
   * Detecta 409 via providerStatusCode, não via parsing de string.
   */
  async createSession(name: string): Promise<WahaSession> {
    try {
      await this.request(`/api/sessions/`, {
        method: "POST",
        timeoutMs: 8_000,
        body: { name },
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      // 409 = sessão já existe — resolver existente e retornar
      if (error instanceof WahaClientError && error.providerStatusCode === 409) {
        const existing = await this.getSession(name);
        if (existing) return existing;
        throw new WahaClientError(
          "SESSION_EXISTS",
          502,
          "Sessão já existe mas não foi possível ler status.",
          409,
        );
      }
      throw error;
    }

    // Sessão criada — retornar status (deve estar em estado inicial)
    const session = await this.getSession(name);
    return session ?? {
      name,
      status: "DISCONNECTED",
      displayPhoneNumber: null,
      qrCode: null,
    };
  }

  /**
   * Inicia uma sessão existente.
   */
  async startSession(name: string): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(name)}/start`, {
      method: "POST",
      timeoutMs: 8_000,
      headers: { "content-type": "application/json" },
    });
  }

  /**
   * Obtém o QR Code de uma sessão.
   *
   * Trata tanto resposta binária (image/png) quanto JSON (data field).
   * Lança erros específicos em vez de retornar null silenciosamente.
   *
   * Erros:
   * - QR_NOT_READY: sessão não está em WAITING_QR
   * - QR_EXPIRED: QR expirou ou não está mais disponível
   * - WAHA_TIMEOUT / WAHA_UNAVAILABLE: problemas de conexão
   * - SESSION_NOT_FOUND: sessão não existe
   */
  async getQr(name: string): Promise<string> {
    // Verificar status da sessão antes de buscar QR
    const session = await this.getSession(name);
    if (!session) {
      throw new WahaClientError("SESSION_NOT_FOUND", 502, `Sessão '${name}' não encontrada.`);
    }
    if (session.status === "CONNECTED") {
      throw new WahaClientError("QR_NOT_READY", 200, "Sessão já conectada. QR não necessário.");
    }
    if (session.status !== "WAITING_QR") {
      throw new WahaClientError(
        "QR_NOT_READY",
        200,
        `Sessão em estado '${session.status}'. Aguarde WAITING_QR.`,
      );
    }

    // Buscar QR — suporta tanto JSON quanto imagem binária
    const { base64 } = await this.requestQr(
      `/api/${encodeURIComponent(name)}/auth/qr?format=image`,
    );

    if (!base64) {
      throw new WahaClientError("QR_EXPIRED", 200, "QR Code não disponível ou expirado.");
    }

    return base64;
  }

  /**
   * Para uma sessão (pause/stop).
   */
  async stopSession(name: string): Promise<WahaRecoveryCleanup> {
    try {
      await this.request(`/api/sessions/${encodeURIComponent(name)}/stop`, {
        method: "POST",
        timeoutMs: 5_000,
        headers: { "content-type": "application/json" },
      });
      return { operation: "stop", outcome: "completed" };
    } catch (error) {
      if (isExpectedCleanupError(error, "stop")) {
        return cleanupIgnored("stop", error);
      }
      throw error;
    }
  }

  /**
   * Deleta uma sessão.
   */
  async deleteSession(name: string): Promise<WahaRecoveryCleanup[]> {
    const cleanup: WahaRecoveryCleanup[] = [];
    try {
      // Primeiro fazer logout (como o relay faz)
      await this.request(`/api/sessions/${encodeURIComponent(name)}/logout`, {
        method: "POST",
        timeoutMs: 5_000,
        headers: { "content-type": "application/json" },
      });
      cleanup.push({ operation: "logout", outcome: "completed" });
    } catch (error) {
      if (!isExpectedCleanupError(error, "logout")) throw error;
      cleanup.push(cleanupIgnored("logout", error));
    }

    try {
      await this.request(`/api/sessions/${encodeURIComponent(name)}`, {
        method: "DELETE",
        timeoutMs: 5_000,
      });
      cleanup.push({ operation: "delete", outcome: "completed" });
    } catch (error) {
      if (!isExpectedCleanupError(error, "delete")) throw error;
      cleanup.push(cleanupIgnored("delete", error));
    }
    return cleanup;
  }

  /**
   * Recupera uma sessão WAHA falhada sem assumir que stop/logout aceitam FAILED.
   * Somente erros de estado/ausência (400 e 404) são tolerados no cleanup; falhas
   * de autenticação, rede ou provider permanecem observáveis para o chamador.
   */
  async recoverFailedSession(name: string): Promise<{ session: WahaSession; cleanup: WahaRecoveryCleanup[] }> {
    const current = await this.getSession(name);
    if (current?.status !== "ERROR") {
      if (current) return { session: current, cleanup: [] };
      const created = await this.createSession(name);
      if (created.status !== "CONNECTED" && created.status !== "WAITING_QR") await this.startSession(name);
      return { session: (await this.getSession(name)) ?? created, cleanup: [] };
    }

    const cleanup = [await this.stopSession(name), ...(await this.deleteSession(name))];
    const remaining = await this.getSession(name);
    if (remaining) {
      throw new WahaClientError("SESSION_EXISTS", 502, "A sessão falhada não foi removida com segurança.");
    }

    const created = await this.createSession(name);
    if (created.status !== "CONNECTED" && created.status !== "WAITING_QR") await this.startSession(name);
    return { session: (await this.getSession(name)) ?? created, cleanup };
  }

  /**
   * Garante que uma sessão de teste existe e está pronta.
   * Reutiliza sessão existente ou cria nova.
   */
  async ensureTestSession(testSessionName: string): Promise<WahaSession> {
    const existing = await this.getSession(testSessionName);
    if (existing) return existing;
    return this.createSession(testSessionName);
  }

  /**
   * Envia uma mensagem de texto via WAHA.
   * Retorna o providerMessageId se sucesso.
   */
  async sendText(sessionName: string, chatId: string, text: string): Promise<{ messageId: string }> {
    const result = await this.request<{ id?: string | { _serialized?: string }; messageId?: string }>(
      "/api/sendText",
      {
        method: "POST",
        timeoutMs: 10_000,
        body: { session: sessionName, chatId, text },
        headers: { "content-type": "application/json" },
      },
    );

    // Normalize message ID from different WAHA response formats
    const messageId =
      typeof result?.id === "string"
        ? result.id
        : typeof result?.id === "object" && result?.id?._serialized
          ? result.id._serialized
          : typeof result?.messageId === "string"
            ? result.messageId
            : null;

    if (!messageId) {
      throw new WahaClientError("WAHA_BAD_RESPONSE", 502, "WAHA não retornou message ID.");
    }

    return { messageId };
  }
}

/**
 * Verifica se um erro é de timeout.
 */
function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function isExpectedCleanupError(
  error: unknown,
  operation: WahaRecoveryCleanup["operation"],
): error is WahaClientError {
  if (!(error instanceof WahaClientError)) return false;

  // WAHA pode sinalizar que stop/logout já não se aplicam à sessão com 400,
  // 404, 422 ou 425 (not in valid state — ex.: logout em sessão que não está
  // WORKING). Isso é seguro para o cleanup: a remoção ainda é tentada.
  // Não toleramos 422/425 no DELETE, pois a sessão pode continuar ativa.
  if (operation === "delete") return error.providerStatusCode === 404;
  return [400, 404, 422, 425].includes(error.providerStatusCode ?? 0);
}

function cleanupIgnored(operation: WahaRecoveryCleanup["operation"], error: WahaClientError): WahaRecoveryCleanup {
  return { operation, outcome: "ignored", providerStatusCode: error.providerStatusCode, normalizedError: error.code };
}
