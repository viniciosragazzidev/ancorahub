import { z } from "zod";

/**
 * Eventos de telemetria aceitos da extensão. Lista fechada: o nome vira ação de auditoria
 * (`extension.telemetry.<evento>`), então texto livre do cliente não entra no log.
 * Nenhum cliente chama esta rota ainda; ao ligar a interface, o evento novo entra aqui.
 */
export const EXTENSION_TELEMETRY_EVENTS = [
  "connect.started",
  "connect.succeeded",
  "connect.failed",
  "panel.render_failed",
  "session.expired",
] as const;

export const extensionTelemetryEventSchema = z.enum(EXTENSION_TELEMETRY_EVENTS);
