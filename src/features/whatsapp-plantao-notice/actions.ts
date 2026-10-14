"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const noticeActionSchema = z.enum(["closed", "connect_clicked"]);

export async function recordWhatsAppPlantaoNoticeAction(input: string) {
  const action = noticeActionSchema.parse(input);
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") throw new Error("Ação disponível apenas para corretores.");

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "whatsapp_plantao_notice",
    entidadeId: context.tenantId,
    acao: `whatsapp_plantao_notice.${action}`,
  });
}
