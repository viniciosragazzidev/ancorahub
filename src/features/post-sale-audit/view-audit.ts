import { createHash } from "node:crypto";

/** Janela de dedupe das auditorias de visualização do pós-venda (Vigia, 09/11): uma por hora. */
export const POST_SALE_VIEW_AUDIT_WINDOW_MS = 3_600_000;

/**
 * Id determinístico da auditoria de "visualizou": mesma empresa, usuário, entidade, ação e hora
 * cheia geram o mesmo id. O insert usa `onConflictDoNothing`, então abrir a tela várias vezes na
 * mesma hora grava uma linha só, sem consulta extra e sem corrida. O rastro continua: cada hora em
 * que a pessoa viu (inclusive as mensagens, que têm dado pessoal) fica registrada.
 */
export function postSaleViewAuditId(input: { tenantId: string; userId: string; entity: string; entityId: string; action: string; now: Date }) {
  const bucket = Math.floor(input.now.getTime() / POST_SALE_VIEW_AUDIT_WINDOW_MS);
  const digest = createHash("sha256").update([input.tenantId, input.userId, input.entity, input.entityId, input.action, bucket].join("\u0000")).digest("hex");
  return `post-sale-view-${digest.slice(0, 40)}`;
}
