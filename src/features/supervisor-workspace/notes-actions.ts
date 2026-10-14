"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { SUPERVISOR_NOTE_KINDS, type SupervisorNote, type SupervisorNoteKind } from "./notes-types";

// user.id is text (not always a UUID): same rule as the rest of the team actions.
const brokerIdSchema = z.string().trim().min(1).max(80);
const addNoteSchema = z.object({
  brokerId: brokerIdSchema,
  kind: z.enum(SUPERVISOR_NOTE_KINDS),
  body: z.string().trim().min(1).max(1000),
});

type TenantAccessContext = Awaited<ReturnType<typeof getRequiredTenantContext>>;

export type AddSupervisorNoteResult =
  | { ok: true; note: SupervisorNote }
  | { ok: false; message: string };

async function canReadBrokerNotes(context: TenantAccessContext, brokerId: string, mode: "read" | "create") {
  if (context.role === "supervisor" && !context.supervisorTeamScope) return false;
  if (context.role === "supervisor" && mode === "read" && (await getLiteAudience(context)) !== "supervisor") return false;
  if (context.role !== "director" && context.role !== "manager" && context.role !== "supervisor") return false;
  if (context.role === "manager" && !context.branchId) return false;
  if (context.role === "supervisor" && (!context.branchId || (mode === "create" && !context.supervisorTeamScope))) return false;

  const conditions = [
    eq(schema.tenantMemberships.tenantId, context.tenantId),
    eq(schema.tenantMemberships.userId, brokerId),
    eq(schema.tenantMemberships.role, "broker"),
  ];

  if (context.role === "manager" || context.role === "supervisor") {
    conditions.push(eq(schema.tenantMemberships.branchId, context.branchId!));
  }
  if (context.role === "supervisor") {
    conditions.push(eq(schema.tenantMemberships.supervisorId, context.userId));
    if (mode === "create") conditions.push(eq(schema.tenantMemberships.status, "active"));
  }

  const db = getDatabase();
  const [membership] = await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(...conditions))
    .limit(1);
  return Boolean(membership);
}

export async function addSupervisorNoteAction(input: unknown): Promise<AddSupervisorNoteResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Escreva um feedback de até 1.000 caracteres." };

  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  const canCreateAsSupervisor = context.role === "supervisor" && context.supervisorTeamScope && audience === "supervisor";
  const canCreateAsManager = context.role === "manager" && audience === "manager";
  if (!canCreateAsSupervisor && !canCreateAsManager) {
    return { ok: false, message: "O feedback não está disponível agora." };
  }
  if (!(await canReadBrokerNotes(context, parsed.data.brokerId, "create"))) {
    return { ok: false, message: "Este corretor não está ativo na sua equipe." };
  }

  const db = getDatabase();
  try {
    const note = await db.transaction(async (tx) => {
      const [created] = await tx.insert(schema.supervisorNotes).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        supervisorId: context.userId,
        brokerId: parsed.data.brokerId,
        kind: parsed.data.kind,
        body: parsed.data.body,
      }).returning({
        id: schema.supervisorNotes.id,
        kind: schema.supervisorNotes.kind,
        body: schema.supervisorNotes.body,
        createdAt: schema.supervisorNotes.createdAt,
      });

      if (!created) throw new Error("O feedback não foi salvo.");
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "supervisor_note",
        entidadeId: created.id,
        acao: "supervisor_note.created",
      });

      return created;
    });

    return {
      ok: true,
      note: {
        id: note.id,
        kind: note.kind as SupervisorNoteKind,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

export async function listBrokerNotes(brokerId: string): Promise<SupervisorNote[]> {
  const parsed = brokerIdSchema.safeParse(brokerId);
  const context = await getRequiredTenantContext();
  if (!parsed.success || !(await canReadBrokerNotes(context, parsed.data, "read"))) return [];
  const db = getDatabase();
  const rows = await db.select({
    id: schema.supervisorNotes.id,
    kind: schema.supervisorNotes.kind,
    body: schema.supervisorNotes.body,
    createdAt: schema.supervisorNotes.createdAt,
  })
    .from(schema.supervisorNotes)
    .where(and(
      eq(schema.supervisorNotes.tenantId, context.tenantId),
      eq(schema.supervisorNotes.brokerId, parsed.data),
      // A supervisor sees only what they wrote (a former supervisor's notes stay with the management).
      context.role === "supervisor" ? eq(schema.supervisorNotes.supervisorId, context.userId) : undefined,
    ))
    .orderBy(desc(schema.supervisorNotes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as SupervisorNoteKind,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }));
}
