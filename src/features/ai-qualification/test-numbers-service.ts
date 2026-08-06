import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

function sanitizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

export const autoResetModeValues = ["never", "before_each_message", "before_each_session", "manual"] as const;
export type AutoResetMode = (typeof autoResetModeValues)[number];

export const addTestNumberSchema = z.object({
  phoneNumber: z.string().trim().min(8).max(25),
  label: z.string().trim().min(2).max(100),
  autoResetMode: z.enum(autoResetModeValues).default("before_each_session"),
  isolatedFromMetrics: z.boolean().default(true),
  isolatedFromQueues: z.boolean().default(true),
  allowTestCommands: z.boolean().default(true),
});

export type AddTestNumberInput = z.infer<typeof addTestNumberSchema>;

export async function getTenantTestNumbers(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.aiQualificationTestNumbers)
    .where(eq(schema.aiQualificationTestNumbers.tenantId, tenantId));
}

export async function addTestNumber(
  tenantId: string,
  actorUserId: string,
  input: AddTestNumberInput
) {
  const data = addTestNumberSchema.parse(input);
  const sanitized = sanitizePhone(data.phoneNumber);
  const db = getDatabase();
  const now = new Date();

  const [created] = await db
    .insert(schema.aiQualificationTestNumbers)
    .values({
      id: randomUUID(),
      tenantId,
      phoneNumber: sanitized,
      label: data.label,
      ownerUserId: actorUserId,
      active: true,
      autoResetMode: data.autoResetMode,
      isolatedFromMetrics: data.isolatedFromMetrics,
      isolatedFromQueues: data.isolatedFromQueues,
      allowTestCommands: data.allowTestCommands,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.aiQualificationTestNumbers.tenantId,
        schema.aiQualificationTestNumbers.phoneNumber,
      ],
      set: {
        label: data.label,
        ownerUserId: actorUserId,
        active: true,
        autoResetMode: data.autoResetMode,
        isolatedFromMetrics: data.isolatedFromMetrics,
        isolatedFromQueues: data.isolatedFromQueues,
        allowTestCommands: data.allowTestCommands,
        updatedAt: now,
      },
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_test_number",
    entidadeId: created.id,
    acao: "test_number.added",
  });

  return created;
}

export async function removeTestNumber(tenantId: string, actorUserId: string, id: string) {
  const db = getDatabase();
  const [deleted] = await db
    .delete(schema.aiQualificationTestNumbers)
    .where(
      and(
        eq(schema.aiQualificationTestNumbers.id, id),
        eq(schema.aiQualificationTestNumbers.tenantId, tenantId)
      )
    )
    .returning({ id: schema.aiQualificationTestNumbers.id });

  if (deleted) {
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorUserId,
      entidade: "ai_qualification_test_number",
      entidadeId: id,
      acao: "test_number.removed",
    });
  }

  return Boolean(deleted);
}

export async function isAuthorizedTestNumber(
  tenantId: string,
  phoneNumber: string
): Promise<boolean> {
  const sanitized = sanitizePhone(phoneNumber);
  const db = getDatabase();
  const [match] = await db
    .select({ id: schema.aiQualificationTestNumbers.id })
    .from(schema.aiQualificationTestNumbers)
    .where(
      and(
        eq(schema.aiQualificationTestNumbers.tenantId, tenantId),
        eq(schema.aiQualificationTestNumbers.phoneNumber, sanitized),
        eq(schema.aiQualificationTestNumbers.active, true)
      )
    )
    .limit(1);

  return Boolean(match);
}
