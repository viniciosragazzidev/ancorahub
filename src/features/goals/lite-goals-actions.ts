"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { calculateGoalProgress } from "./goals-service";
import { LITE_GOAL_TYPES, liteGoalTargetAllowed, periodBounds, type LiteGoalTarget } from "./lite-goals-policy";

const inputSchema = z.object({
  id: z.string().trim().min(1).max(80).optional().nullable(),
  scope: z.enum(["team", "broker"]),
  scopeId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1, "Dê um nome para a meta.").max(120, "O nome deve ter no máximo 120 caracteres."),
  targetType: z.enum(LITE_GOAL_TYPES, { message: "Escolha o tipo de meta." }),
  targetValue: z.number({ message: "Informe o valor da meta." }).positive("O valor deve ser maior que zero.").max(999999, "Valor muito alto."),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/, "Período inválido."),
});

export type SaveLiteGoalResult = { ok: true; goalId: string } | { ok: false; message: string };

function fail(message: string): SaveLiteGoalResult {
  return { ok: false, message };
}

async function loadTarget(tenantId: string, scope: "team" | "broker", userId: string): Promise<LiteGoalTarget | null> {
  const [row] = await getDatabase().select({
    role: schema.tenantMemberships.role,
    status: schema.tenantMemberships.status,
    branchId: schema.tenantMemberships.branchId,
    supervisorId: schema.tenantMemberships.supervisorId,
  })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.userId, userId),
      eq(schema.tenantMemberships.role, scope === "team" ? "supervisor" : "broker"),
    ))
    .limit(1);
  if (!row) return null;
  return {
    role: row.role === "supervisor" ? "supervisor" : "broker",
    userId,
    status: row.status,
    branchId: row.branchId ?? null,
    supervisorId: row.supervisorId ?? null,
  };
}

/**
 * Cria ou edita uma meta de equipe ou de corretor no Lite. Escopo checado no servidor a cada chamada:
 * supervisor só na própria equipe e nos próprios corretores; gestor só a equipe da própria unidade.
 */
export async function saveLiteGoalAction(input: unknown): Promise<SaveLiteGoalResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira os dados da meta.");
  const context = await getRequiredTenantContext();
  if (!(await isTeamManagementEnabled())) return fail("A gestão de equipes está desligada.");
  const audience = await getLiteAudience(context);
  if (audience !== "supervisor" && audience !== "manager") return fail("Metas de equipe estão disponíveis só no Lite de gestão.");
  const bounds = periodBounds(parsed.data.period);
  if (!bounds) return fail("Período inválido.");

  const target = await loadTarget(context.tenantId, parsed.data.scope, parsed.data.scopeId);
  const allowed = target !== null && liteGoalTargetAllowed({
    audience,
    viewerUserId: context.userId,
    viewerBranchId: context.branchId ?? null,
    scope: parsed.data.scope,
    target,
  });
  if (!allowed) return fail("Este alvo não está no seu escopo.");

  const db = getDatabase();
  const values = {
    name: parsed.data.name,
    targetType: parsed.data.targetType,
    targetValue: String(parsed.data.targetValue),
    period: parsed.data.period,
    startDate: new Date(bounds.startDate),
    endDate: new Date(bounds.endDate),
  };

  let goalId: string;
  if (parsed.data.id) {
    const [existing] = await db.select({ id: schema.goals.id, scope: schema.goals.scope, scopeId: schema.goals.scopeId })
      .from(schema.goals)
      .where(and(eq(schema.goals.tenantId, context.tenantId), eq(schema.goals.id, parsed.data.id)))
      .limit(1);
    if (!existing || existing.scope !== parsed.data.scope || existing.scopeId !== parsed.data.scopeId) return fail("Meta fora do seu escopo.");
    await db.update(schema.goals).set({ ...values, updatedAt: new Date() }).where(eq(schema.goals.id, existing.id));
    goalId = existing.id;
  } else {
    goalId = randomUUID();
    await db.insert(schema.goals).values({
      id: goalId,
      tenantId: context.tenantId,
      scope: parsed.data.scope,
      scopeId: parsed.data.scopeId,
      active: true,
      createdBy: context.userId,
      ...values,
    });
  }

  // O progresso é recalculado no escopo de quem salvou. Se falhar, a meta fica salva com o último progresso guardado.
  await calculateGoalProgress(goalId, context).catch(() => undefined);
  return { ok: true, goalId };
}
