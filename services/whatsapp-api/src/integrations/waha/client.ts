import type { WahaConfig } from "../../config.js";
import {
  WahaClientError,
  normalizeWahaStatus,
  type WahaHealthResult,
  type WahaSession,
  type WahaSessionStatus,
} from "./types.js";

type FetchFn = typeof globalThis.fetch;

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
      throw new WahaClientError("WAHA_INTERNAL_ERROR", 502, `WAHA retornou status ${response.status}.`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new WahaClientError("WAHA_BAD_RESPONSE", 502, "WAHA retornou JSON inválido.");
    }

    return data as T;
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
   * Retorna null se a sessão não existe.
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
      if (error instanceof WahaClientError && error.statusCode === 502) {
        // WAHA retornou erro — provavelmente sessão não existe ou WAHA indisponível
        return null;
      }
      throw error;
    }
  }

  /**
   * Cria uma nova sessão no WAHA.
   * Se a sessão já existe (409), retorna o status atual.
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
      // 409 = sessão já existe — não é erro
      if (isWahaConflict(error)) {
        const existing = await this.getSession(name);
        if (existing) return existing;
        // Se não conseguiu ler, criar erro genérico
        throw new WahaClientError("WAHA_INTERNAL_ERROR", 502, "Sessão já existe mas não foi possível ler status.");
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
   * Retorna null se QR não disponível ou expirado.
   */
  async getQr(name: string): Promise<string | null> {
    try {
      const raw = await this.request<{ data?: string }>(
        `/api/${encodeURIComponent(name)}/auth/qr?format=image`,
        {
          timeoutMs: 5_000,
          headers: { accept: "application/json" },
        },
      );
      return typeof raw?.data === "string" ? raw.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Para uma sessão (pause/stop).
   */
  async stopSession(name: string): Promise<void> {
    try {
      await this.request(`/api/sessions/${encodeURIComponent(name)}/stop`, {
        method: "POST",
        timeoutMs: 5_000,
        headers: { "content-type": "application/json" },
      });
    } catch {
      // Ignorar erro — sessão pode já estar parada
    }
  }

  /**
   * Deleta uma sessão.
   */
  async deleteSession(name: string): Promise<void> {
    try {
      // Primeiro fazer logout (como o relay faz)
      await this.request(`/api/sessions/${encodeURIComponent(name)}/logout`, {
        method: "POST",
        timeoutMs: 5_000,
        headers: { "content-type": "application/json" },
      });
    } catch {
      // Ignorar — sessão pode não existir mais
    }

    try {
      await this.request(`/api/sessions/${encodeURIComponent(name)}`, {
        method: "DELETE",
        timeoutMs: 5_000,
      });
    } catch {
      // Ignorar — sessão pode não existir mais
    }
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

/**
 * Verifica se um erro é de conflito (409) do WAHA.
 */
function isWahaConflict(error: unknown): boolean {
  return (
    error instanceof WahaClientError &&
    error.code === "WAHA_INTERNAL_ERROR" &&
    error.message.includes("409")
  );
}
