import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";

import { getWhatsAppReviewConfig } from "./config.js";
import { MetaGraphError, MetaGraphTimeoutError } from "./integrations/whatsapp/client.js";
import { sendTestMessage } from "./integrations/whatsapp/service.js";

type SendBody = { to: string; message: string };

function secureEquals(left: string | string[] | undefined, right: string) {
  if (!left || Array.isArray(left)) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildApp() {
  const app = Fastify({
    logger: {
      redact: ["req.headers.x-corretop-internal-token", "req.body.to", "req.body.message"],
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: SendBody }>("/api/integrations/whatsapp/send-test-message", {
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
    try { config = getWhatsAppReviewConfig(); } catch (error) {
      request.log.error({ err: error }, "whatsapp_review_configuration_error");
      return reply.code(503).send({ success: false, error: { code: "SERVICE_NOT_CONFIGURED", message: "O serviço de revisão não está configurado." } });
    }

    if (!secureEquals(request.headers["x-corretop-internal-token"], config.internalToken)) {
      return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Não autorizado." } });
    }

    try {
      const result = await sendTestMessage(config, request.body);
      request.log.info({ messageId: result.messageId }, "whatsapp_review_message_sent");
      return reply.code(201).send({ success: true, data: result });
    } catch (error) {
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

  return app;
}
