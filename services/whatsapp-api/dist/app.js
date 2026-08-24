import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import { getWhatsAppReviewConfig, getWahaConfig } from "./config.js";
import { MetaGraphError, MetaGraphTimeoutError } from "./integrations/whatsapp/client.js";
import { sendTestMessage } from "./integrations/whatsapp/service.js";
import { WahaClient } from "./integrations/waha/client.js";
import { WahaClientError } from "./integrations/waha/types.js";
const failedSessionRecoveries = new Map();
function recoverFailedSessionOnce(client, sessionName) {
    const existing = failedSessionRecoveries.get(sessionName);
    if (existing)
        return existing;
    const recovery = client.recoverFailedSession(sessionName).finally(() => {
        if (failedSessionRecoveries.get(sessionName) === recovery)
            failedSessionRecoveries.delete(sessionName);
    });
    failedSessionRecoveries.set(sessionName, recovery);
    return recovery;
}
function logRecoveryCleanup(request, session, sessionStatus, cleanup) {
    for (const item of cleanup) {
        request.log.info({
            operation: "waha.connection.recover.cleanup",
            cleanupOperation: item.operation,
            session,
            sessionStatus,
            providerStatusCode: item.providerStatusCode,
            normalizedError: item.normalizedError,
            outcome: item.outcome,
        });
    }
}
/**
 * Comparação timing-safe de strings.
 * Usada para validar tokens internos sem viver a timing side-channel.
 */
function secureEquals(left, right) {
    if (!left || Array.isArray(left))
        return false;
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
/**
 * Auth guard genérico para rotas internas.
 * Reutiliza o mesmo mecanismo `x-corretop-internal-token` já existente.
 * Retorna true se autenticado, false e envia response 401 se não.
 */
function requireInternalAuth(request, reply, token) {
    if (!secureEquals(request.headers["x-corretop-internal-token"], token)) {
        reply.code(401).send({
            ok: false,
            service: "waha",
            status: "unauthorized",
        });
        return false;
    }
    return true;
}
export function buildApp() {
    const app = Fastify({
        logger: {
            redact: ["req.headers.x-corretop-internal-token", "req.body.to", "req.body.message"],
        },
    });
    // ── Health check independente (não verifica WAHA) ──────────────────────
    app.get("/health", async () => ({ status: "ok" }));
    // ── Review: envio de mensagem de teste (Meta Cloud) ────────────────────
    app.post("/api/integrations/whatsapp/send-test-message", {
        schema: {
            body: {
                type: "object",
                required: ["to", "message"],
                additionalProperties: false,
                properties: { to: { type: "string", minLength: 8, maxLength: 24 }, message: { type: "string", minLength: 1, maxLength: 4096 } },
            },
        },
    }, async (request, reply) => {
        let config;
        try {
            config = getWhatsAppReviewConfig();
        }
        catch (error) {
            request.log.error({ err: error }, "whatsapp_review_configuration_error");
            return reply.code(503).send({ success: false, error: { code: "SERVICE_NOT_CONFIGURED", message: "O serviço de revisão não está configurado." } });
        }
        if (!requireInternalAuth(request, reply, config.internalToken))
            return;
        try {
            const result = await sendTestMessage(config, request.body);
            request.log.info({ messageId: result.messageId }, "whatsapp_review_message_sent");
            return reply.code(201).send({ success: true, data: result });
        }
        catch (error) {
            if (error instanceof MetaGraphError) {
                request.log.warn({ statusCode: error.statusCode }, "whatsapp_review_meta_rejected");
                return reply.code(502).send({ success: false, error: { code: "META_REJECTED", message: "A Meta recusou o envio. Revise o número e as credenciais de teste." } });
            }
            if (error instanceof MetaGraphTimeoutError) {
                request.log.warn("whatsapp_review_meta_timeout");
                return reply.code(504).send({ success: false, error: { code: "META_TIMEOUT", message: "A Meta demorou para responder. Tente novamente." } });
            }
            const message = error instanceof Error ? error.message : "Não foi possível enviar a mensagem.";
            const statusCode = message.includes("desativado") ? 503 : 422;
            return reply.code(statusCode).send({ success: false, error: { code: statusCode === 503 ? "REVIEW_DISABLED" : "INVALID_INPUT", message } });
        }
    });
    // ── WAHA Health Check ──────────────────────────────────────────────────
    app.get("/internal/waha/health", async (request, reply) => {
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            request.log.warn("waha_health_config_missing");
            return reply.code(503).send({
                ok: false,
                service: "waha",
                status: "unavailable",
                error: "WAHA_INTERNAL_ERROR",
            });
        }
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        const client = new WahaClient(wahaConfig);
        const result = await client.health();
        request.log.info({
            operation: "waha.health",
            status: result.status,
            durationMs: result.durationMs,
            ...(result.error ? { errorCode: result.error } : {}),
        });
        if (!result.ok) {
            const statusCode = result.status === "timeout" ? 504 : 503;
            return reply.code(statusCode).send({
                ok: false,
                service: "waha",
                status: result.status,
                ...(result.error ? { error: result.error } : {}),
            });
        }
        return reply.code(200).send({
            ok: true,
            service: "waha",
            status: "healthy",
            timestamp: new Date().toISOString(),
        });
    });
    // ── WAHA Test Session: Start ────────────────────────────────────────
    app.post("/internal/waha/test-session/start", async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            request.log.warn("waha_session_config_missing");
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const client = new WahaClient(wahaConfig);
        const sessionName = "corretop_test";
        const startedAt = Date.now();
        try {
            const session = await client.ensureTestSession(sessionName);
            // Se não estiver conectado, iniciar
            if (session.status !== "CONNECTED") {
                await client.startSession(sessionName);
            }
            // Consultar status final
            const finalSession = await client.getSession(sessionName);
            const status = finalSession?.status ?? "DISCONNECTED";
            request.log.info({
                operation: "waha.test_session.start",
                session: sessionName,
                status,
                durationMs: Date.now() - startedAt,
            });
            return reply.code(200).send({
                ok: true,
                session: sessionName,
                status,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.test_session.start",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
                durationMs: Date.now() - startedAt,
            });
            return reply.code(502).send({
                ok: false,
                service: "waha",
                status: "unavailable",
                error: "WAHA_UNAVAILABLE",
            });
        }
    });
    // ── WAHA Test Session: Status ────────────────────────────────────────
    app.get("/internal/waha/test-session/status", async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const client = new WahaClient(wahaConfig);
        const sessionName = "corretop_test";
        try {
            const session = await client.getSession(sessionName);
            const status = session?.status ?? "DISCONNECTED";
            request.log.info({ operation: "waha.test_session.status", session: sessionName, status });
            return reply.code(200).send({
                ok: true,
                session: sessionName,
                status,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.test_session.status",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Test Session: QR Code ───────────────────────────────────────
    app.get("/internal/waha/test-session/qr", async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const client = new WahaClient(wahaConfig);
        const sessionName = "corretop_test";
        try {
            const session = await client.getSession(sessionName);
            const status = session?.status ?? "DISCONNECTED";
            let qr = null;
            if (status === "WAITING_QR") {
                try {
                    qr = await client.getQr(sessionName);
                }
                catch (qrError) {
                    // QR pode não estar pronto ainda — retornar null, não falhar
                    request.log.info({
                        operation: "waha.test_session.qr",
                        session: sessionName,
                        qrError: qrError instanceof Error ? qrError.message : "unknown",
                    });
                }
            }
            request.log.info({ operation: "waha.test_session.qr", session: sessionName, status, hasQr: qr !== null });
            // Nunca logar o QR em si
            return reply.code(200).send({
                ok: true,
                session: sessionName,
                status,
                qr,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.test_session.qr",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Test Session: Reset ─────────────────────────────────────────
    app.post("/internal/waha/test-session/reset", async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const client = new WahaClient(wahaConfig);
        const sessionName = "corretop_test";
        try {
            await client.stopSession(sessionName);
            await client.deleteSession(sessionName);
            request.log.info({ operation: "waha.test_session.reset", session: sessionName });
            return reply.code(200).send({
                ok: true,
                session: sessionName,
                status: "DISCONNECTED",
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.test_session.reset",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Connection: Create/Start ────────────────────────────────────
    app.post("/internal/waha/connections", {
        schema: {
            body: {
                type: "object",
                required: ["tenantId", "userId", "sessionName"],
                additionalProperties: false,
                properties: {
                    tenantId: { type: "string", minLength: 1, maxLength: 120 },
                    userId: { type: "string", minLength: 1, maxLength: 120 },
                    sessionName: { type: "string", minLength: 1, maxLength: 120 },
                },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const { sessionName } = request.body;
        const client = new WahaClient(wahaConfig);
        const startedAt = Date.now();
        try {
            // 1. Procurar sessão existente (idempotente)
            const existing = await client.getSession(sessionName);
            if (existing) {
                // Sessão já existe — reutilizar conforme lifecycle:
                // CONNECTED / WAITING_QR → não criar outra, retornar status atual
                // STARTING → aguardar, retornar status
                // STOPPED / DISCONNECTED → reiniciar
                if (existing.status === "CONNECTED") {
                    request.log.info({
                        operation: "waha.connection.create",
                        session: sessionName,
                        reused: true,
                        status: existing.status,
                        durationMs: Date.now() - startedAt,
                    });
                    return reply.code(200).send({
                        ok: true,
                        sessionName,
                        status: existing.status,
                        reused: true,
                        phoneNumber: existing.displayPhoneNumber,
                        timestamp: new Date().toISOString(),
                    });
                }
                if (existing.status === "WAITING_QR") {
                    // Sessão aguardando QR — não criar outra, retornar status
                    request.log.info({
                        operation: "waha.connection.create",
                        session: sessionName,
                        reused: true,
                        status: existing.status,
                        durationMs: Date.now() - startedAt,
                    });
                    return reply.code(200).send({
                        ok: true,
                        sessionName,
                        status: existing.status,
                        reused: true,
                        timestamp: new Date().toISOString(),
                    });
                }
                if (existing.status === "ERROR") {
                    const recovered = await recoverFailedSessionOnce(client, sessionName);
                    logRecoveryCleanup(request, sessionName, existing.status, recovered.cleanup);
                    request.log.info({
                        operation: "waha.connection.recover",
                        session: sessionName,
                        sessionStatus: existing.status,
                        cleanup: recovered.cleanup,
                    });
                    return reply.code(200).send({
                        ok: true,
                        sessionName,
                        status: recovered.session.status,
                        reused: true,
                        timestamp: new Date().toISOString(),
                    });
                }
                // Para outros estados (STOPPED, STARTING), reiniciar
                if (existing.status !== "STARTING") {
                    try {
                        await client.startSession(sessionName);
                    }
                    catch (startErr) {
                        // Se start falhar, logar mas continuar — o status refletirá o estado real
                        request.log.warn({
                            operation: "waha.connection.create",
                            session: sessionName,
                            startError: startErr instanceof Error ? startErr.message : "unknown",
                        });
                    }
                }
                const refreshed = await client.getSession(sessionName);
                const status = refreshed?.status ?? existing.status;
                request.log.info({
                    operation: "waha.connection.create",
                    session: sessionName,
                    reused: true,
                    status,
                    durationMs: Date.now() - startedAt,
                });
                return reply.code(200).send({
                    ok: true,
                    sessionName,
                    status,
                    reused: true,
                    timestamp: new Date().toISOString(),
                });
            }
            // 2. Criar nova sessão (idempotente — createSession trata 409)
            const created = await client.createSession(sessionName);
            // Se não estava em estado inicial, iniciar
            if (created.status !== "CONNECTED" && created.status !== "WAITING_QR") {
                try {
                    await client.startSession(sessionName);
                }
                catch {
                    // Ignorar — createSession já pode ter iniciado
                }
            }
            const finalSession = await client.getSession(sessionName);
            const status = finalSession?.status ?? created.status ?? "STARTING";
            request.log.info({
                operation: "waha.connection.create",
                session: sessionName,
                reused: false,
                status,
                durationMs: Date.now() - startedAt,
            });
            return reply.code(201).send({
                ok: true,
                sessionName,
                status,
                reused: false,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            const providerStatus = error instanceof WahaClientError ? error.providerStatusCode : undefined;
            request.log.warn({
                operation: "waha.connection.create",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
                providerStatus,
                durationMs: Date.now() - startedAt,
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Connection: Recover failed session ──────────────────────────
    app.post("/internal/waha/connections/:id/recover", {
        schema: {
            params: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const { id: sessionName } = request.params;
        const client = new WahaClient(wahaConfig);
        const current = await client.getSession(sessionName).catch((error) => {
            request.log.warn({
                operation: "waha.connection.recover.status",
                session: sessionName,
                providerStatusCode: error instanceof WahaClientError ? error.providerStatusCode : undefined,
                sessionStatus: "unknown",
                normalizedError: error instanceof WahaClientError ? error.code : "WAHA_UNAVAILABLE",
            });
            return undefined;
        });
        if (current === undefined)
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        try {
            const recovered = await recoverFailedSessionOnce(client, sessionName);
            logRecoveryCleanup(request, sessionName, current?.status ?? "DISCONNECTED", recovered.cleanup);
            request.log.info({
                operation: "waha.connection.recover",
                session: sessionName,
                sessionStatus: current?.status ?? "DISCONNECTED",
                cleanup: recovered.cleanup,
            });
            return reply.code(200).send({
                ok: true,
                sessionName,
                status: recovered.session.status,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.connection.recover",
                session: sessionName,
                providerStatusCode: error instanceof WahaClientError ? error.providerStatusCode : undefined,
                sessionStatus: current?.status ?? "unknown",
                normalizedError: error instanceof WahaClientError ? error.code : "WAHA_INTERNAL_ERROR",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: error instanceof WahaClientError ? error.code : "WAHA_INTERNAL_ERROR" });
        }
    });
    // ── WAHA Connection: Status ──────────────────────────────────────────
    app.get("/internal/waha/connections/:id/status", {
        schema: {
            params: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const { id: sessionName } = request.params;
        const client = new WahaClient(wahaConfig);
        try {
            const session = await client.getSession(sessionName);
            const status = session?.status ?? "DISCONNECTED";
            request.log.info({ operation: "waha.connection.status", session: sessionName, status });
            return reply.code(200).send({
                ok: true,
                sessionName,
                status,
                phoneNumber: session?.displayPhoneNumber ?? null,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.connection.status",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Connection: QR Code ─────────────────────────────────────────
    app.get("/internal/waha/connections/:id/qr", {
        schema: {
            params: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const { id: sessionName } = request.params;
        const client = new WahaClient(wahaConfig);
        try {
            const session = await client.getSession(sessionName);
            const status = session?.status ?? "DISCONNECTED";
            let qr = null;
            if (status === "WAITING_QR") {
                try {
                    qr = await client.getQr(sessionName);
                }
                catch (qrError) {
                    request.log.info({
                        operation: "waha.connection.qr",
                        session: sessionName,
                        qrError: qrError instanceof Error ? qrError.message : "unknown",
                    });
                }
            }
            request.log.info({ operation: "waha.connection.qr", session: sessionName, status, hasQr: qr !== null });
            return reply.code(200).send({
                ok: true,
                sessionName,
                status,
                qr,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.connection.qr",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ── WAHA Connection: Disconnect ──────────────────────────────────────
    app.post("/internal/waha/connections/:id/disconnect", {
        schema: {
            params: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_INTERNAL_ERROR" });
        }
        const { id: sessionName } = request.params;
        const client = new WahaClient(wahaConfig);
        try {
            await client.stopSession(sessionName);
            await client.deleteSession(sessionName);
            request.log.info({ operation: "waha.connection.disconnect", session: sessionName });
            return reply.code(200).send({
                ok: true,
                sessionName,
                status: "DISCONNECTED",
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            request.log.warn({
                operation: "waha.connection.disconnect",
                session: sessionName,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, service: "waha", status: "unavailable", error: "WAHA_UNAVAILABLE" });
        }
    });
    // ────────────────────────────────────────────────────────────────────────
    // POST /internal/webhooks/waha — Receive WAHA events and forward to CRM
    // ────────────────────────────────────────────────────────────────────────
    app.post("/internal/webhooks/waha", {
        schema: {
            body: { type: "object" },
            response: {
                200: { type: "object", properties: { accepted: { type: "boolean" } } },
                400: { type: "object", properties: { accepted: { type: "boolean" }, error: { type: "string" } } },
                502: { type: "object", properties: { accepted: { type: "boolean" }, error: { type: "string" } } },
            },
        },
    }, async (request, reply) => {
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL?.trim();
        const CRM_WEBHOOK_SECRET = process.env.WAHA_RELAY_SHARED_SECRET?.trim();
        if (!CRM_WEBHOOK_URL || !CRM_WEBHOOK_SECRET) {
            request.log.warn({
                operation: "waha.webhook.forward",
                error: !CRM_WEBHOOK_URL ? "CRM_WEBHOOK_URL not configured" : "WAHA_RELAY_SHARED_SECRET not configured",
            });
            return reply.code(503).send({ accepted: false, error: "CRM webhook not configured" });
        }
        const rawBody = JSON.stringify(request.body);
        const timestamp = String(Date.now());
        const nonce = randomUUID();
        const signature = createHmac("sha256", CRM_WEBHOOK_SECRET)
            .update(`${timestamp}.${nonce}.${rawBody}`)
            .digest("hex");
        try {
            const headers = {
                "Content-Type": "application/json",
                "x-ancora-timestamp": timestamp,
                "x-ancora-nonce": nonce,
                "x-ancora-signature": signature,
            };
            const response = await fetch(CRM_WEBHOOK_URL, {
                method: "POST",
                headers,
                body: rawBody,
                signal: AbortSignal.timeout(15_000),
            });
            const result = await response.json().catch(() => ({ accepted: false }));
            request.log.info({
                operation: "waha.webhook.forward",
                crmStatus: response.status,
                accepted: result.accepted,
            });
            return reply.code(response.status).send(result);
        }
        catch (error) {
            request.log.error({
                operation: "waha.webhook.forward",
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ accepted: false, error: "CRM_FORWARD_FAILED" });
        }
    });
    // ────────────────────────────────────────────────────────────────────────
    // POST /internal/waha/messages/text — Send text message via WAHA
    // ────────────────────────────────────────────────────────────────────────
    app.post("/internal/waha/messages/text", {
        schema: {
            body: {
                type: "object",
                required: ["sessionName", "chatId", "text"],
                properties: {
                    sessionName: { type: "string", minLength: 1, maxLength: 120 },
                    chatId: { type: "string", minLength: 10, maxLength: 20 },
                    text: { type: "string", minLength: 1, maxLength: 4000 },
                    idempotencyKey: { type: "string", minLength: 16, maxLength: 160 },
                },
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        ok: { type: "boolean" },
                        messageId: { type: "string" },
                        idempotencyKey: { type: "string" },
                    },
                },
                400: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } },
                502: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } },
            },
        },
    }, async (request, reply) => {
        if (!requireInternalAuth(request, reply, process.env.WHATSAPP_API_INTERNAL_TOKEN ?? ""))
            return;
        let wahaConfig;
        try {
            wahaConfig = getWahaConfig();
        }
        catch {
            return reply.code(503).send({ ok: false, error: "WAHA_INTERNAL_ERROR" });
        }
        const { sessionName, chatId, text, idempotencyKey } = request.body;
        // Validate chatId format (digits only, 10-15 chars)
        if (!/^\d{10,15}$/.test(chatId)) {
            return reply.code(400).send({ ok: false, error: "INVALID_CHAT_ID" });
        }
        const client = new WahaClient(wahaConfig);
        const startedAt = Date.now();
        try {
            // Verify session is connected before sending
            const session = await client.getSession(sessionName);
            if (!session || session.status !== "CONNECTED") {
                request.log.warn({
                    operation: "waha.message.send",
                    session: sessionName,
                    sessionStatus: session?.status ?? "NOT_FOUND",
                });
                return reply.code(400).send({
                    ok: false,
                    error: session ? `SESSION_${session.status}` : "SESSION_NOT_FOUND",
                });
            }
            const result = await client.sendText(sessionName, `${chatId}@c.us`, text);
            const durationMs = Date.now() - startedAt;
            request.log.info({
                operation: "waha.message.send",
                session: sessionName,
                durationMs,
                hasIdempotencyKey: Boolean(idempotencyKey),
            });
            return reply.code(200).send({
                ok: true,
                messageId: result.messageId,
                idempotencyKey: idempotencyKey ?? null,
            });
        }
        catch (error) {
            const durationMs = Date.now() - startedAt;
            request.log.error({
                operation: "waha.message.send",
                session: sessionName,
                durationMs,
                errorCode: error instanceof Error ? error.message : "unknown",
            });
            return reply.code(502).send({ ok: false, error: "WAHA_SEND_FAILED" });
        }
    });
    return app;
}
