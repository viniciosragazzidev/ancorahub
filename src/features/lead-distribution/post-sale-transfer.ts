import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * DEC-133 (isenção Pós Venda): leads ligados à fila "Pós Venda" — como origem
 * OU como destino — não têm bloqueios de negócio na transferência manual entre
 * unidades e corretores (rota de campanha, disponibilidade/pausa do corretor,
 * estado do atendimento e unidade sem aceitar leads). Permanecem as
 * salvaguardas de identidade: membro ativo no tenant e conta ativa, escopo de
 * tenant e autorização do ator. Cada transferência isenta é auditada.
 *
 * A fila é reconhecida pelo nome (decisão do usuário em 2026-10-06: a fila já
 * existe com o nome "Pós Venda"), normalizado sem acentos, caixa ou hífens —
 * não há valor de negócio fixado a um id de fila.
 */
const POST_SALE_QUEUE_NAME_NORMALIZED = "pos venda";

/** Acentos, hífens/underscores e espaços extras viram um único espaço; caixa é ignorada. */
export function normalizeQueueName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isPostSaleQueueName(value: string | null | undefined): boolean {
  return normalizeQueueName(value) === POST_SALE_QUEUE_NAME_NORMALIZED;
}

/** Nome atual da fila no tenant; inativa também conta (o lead pode estar parado nela). */
export async function getQueueName(tenantId: string, queueId: string | null | undefined): Promise<string | null> {
  if (!queueId) return null;
  const [queue] = await getDatabase()
    .select({ name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.id, queueId)))
    .limit(1);
  return queue?.name ?? null;
}

/** Nome da fila padrão ativa da unidade SEM criar fila (peek); null se não existir. */
export async function findBranchDefaultQueueName(tenantId: string, branchId: string): Promise<string | null> {
  const [queue] = await getDatabase()
    .select({ name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(
      eq(schema.leadQueues.tenantId, tenantId),
      eq(schema.leadQueues.branchId, branchId),
      eq(schema.leadQueues.isDefault, true),
      eq(schema.leadQueues.status, "active"),
    ))
    .orderBy(asc(schema.leadQueues.createdAt))
    .limit(1);
  return queue?.name ?? null;
}

/**
 * A transferência é isenta quando a fila de origem do lead OU a fila de
 * destino é a Pós Venda (decisão do usuário em 2026-10-06). Retorna o nome da
 * fila que gerou a isenção (origem tem precedência) ou null quando não há
 * isenção — o nome alimenta a auditoria.
 */
export async function findPostSaleExemptionQueueName(input: {
  tenantId: string;
  originQueueId?: string | null;
  targetQueueId?: string | null;
}): Promise<string | null> {
  const [originName, targetName] = await Promise.all([
    getQueueName(input.tenantId, input.originQueueId),
    getQueueName(input.tenantId, input.targetQueueId),
  ]);
  if (isPostSaleQueueName(originName)) return originName;
  if (isPostSaleQueueName(targetName)) return targetName;
  return null;
}

export async function isPostSaleTransferExempt(input: {
  tenantId: string;
  originQueueId?: string | null;
  targetQueueId?: string | null;
}): Promise<boolean> {
  return (await findPostSaleExemptionQueueName(input)) !== null;
}

/**
 * Ação de auditoria da transferência isenta; a fila que gerou a isenção entra
 * na ação porque `audit_logs` não tem coluna de detalhes.
 */
export function postSaleTransferAuditAction(queueName: string | null | undefined): string {
  const name = queueName?.trim();
  return `lead.post_sale_transfer${name ? `:${name}` : ""}`.slice(0, 200);
}
