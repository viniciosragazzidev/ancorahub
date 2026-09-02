"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { resolveAccessContext } from "@/shared/auth/access-context";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";
import { getDatabase, schema } from "@/shared/db";

export type BranchActionState = { success?: boolean; error?: string; message?: string };

const branchInput = z.object({
  name: z.string().trim().min(2, "Informe um nome de filial válido.").max(100),
  externalId: z.string().trim().max(80).optional(),
});

const branchIdInput = z.string().trim().min(1, "Filial inválida.");

async function getDirectorContext() {
  const context = await getRequiredTenantContext();
  requireRole(context, "director");
  return context;
}

function actionError(error: unknown): BranchActionState {
  if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
    return { error: "Já existe uma filial com esse identificador." };
  }
  return {
    error: error instanceof Error ? error.message : "Não foi possível concluir a operação.",
  };
}

export async function createBranchAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const parsed = branchInput.safeParse({
    name: formData.get("name"),
    externalId: formData.get("externalId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    await getDatabase().insert(schema.branches).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      name: parsed.data.name,
      status: "active",
    });
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBranchAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const branchId = branchIdInput.safeParse(formData.get("branchId"));
  const parsed = branchInput.safeParse({
    name: formData.get("name"),
    externalId: formData.get("externalId") || undefined,
  });
  if (!branchId.success) return { error: branchId.error.issues[0]?.message ?? "Filial inválida." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    const result = await getDatabase()
      .update(schema.branches)
      .set({ name: parsed.data.name })
      .where(
        and(eq(schema.branches.id, branchId.data), eq(schema.branches.tenantId, context.tenantId)),
      )
      .returning({ id: schema.branches.id });
    if (result.length === 0) return { error: "Filial não encontrada." };
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleBranchAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const branchId = branchIdInput.safeParse(formData.get("branchId"));
  if (!branchId.success) return { error: branchId.error.issues[0]?.message ?? "Filial inválida." };

  try {
    const context = await getDirectorContext();
    const [branch] = await getDatabase()
      .select({ id: schema.branches.id, status: schema.branches.status })
      .from(schema.branches)
      .where(
        and(eq(schema.branches.id, branchId.data), eq(schema.branches.tenantId, context.tenantId)),
      )
      .limit(1);
    if (!branch) return { error: "Filial não encontrada." };
    await getDatabase()
      .update(schema.branches)
      .set({ status: branch.status === "active" ? "inactive" : "active" })
      .where(eq(schema.branches.id, branch.id));
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleAcceptingLeadsAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const branchId = branchIdInput.safeParse(formData.get("branchId"));
  if (!branchId.success) return { error: branchId.error.issues[0]?.message ?? "Filial inválida." };

  try {
    const context = await getDirectorContext();
    const [branch] = await getDatabase()
      .select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads })
      .from(schema.branches)
      .where(
        and(eq(schema.branches.id, branchId.data), eq(schema.branches.tenantId, context.tenantId)),
      )
      .limit(1);
    if (!branch) return { error: "Filial não encontrada." };
    await getDatabase()
      .update(schema.branches)
      .set({ acceptingLeads: !branch.acceptingLeads })
      .where(eq(schema.branches.id, branch.id));
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleAutoDistributeAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const branchId = branchIdInput.safeParse(formData.get("branchId"));
  if (!branchId.success) return { error: branchId.error.issues[0]?.message ?? "Filial inválida." };

  try {
    const accessContext = await resolveAccessContext();
    const db = getDatabase();
    const [branch] = await db
      .select({
        id: schema.branches.id,
        autoDistribute: schema.branches.autoDistribute,
        isDistributionHub: schema.branches.isDistributionHub,
      })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId.data),
          eq(schema.branches.tenantId, accessContext.tenantId),
        ),
      )
      .limit(1);
    if (!branch) return { error: "Filial não encontrada." };
    if (branch.isDistributionHub) {
      return { error: "A Central de redistribuição não participa da distribuição automática." };
    }

    const legacyAllowed =
      accessContext.role === "director" ||
      (accessContext.role === "manager" && accessContext.branchId === branch.id);

    await evaluateShadowAuthorization({
      operationKey: "branches.toggleAutoDistributeAction",
      legacyAllowed,
      context: accessContext,
      capability: "gerenciar_configuracoes_unidade",
      resource: { tenantId: accessContext.tenantId, unitId: branch.id },
    });

    if (
      !AuthorizationService.can(accessContext, "gerenciar_configuracoes_unidade", {
        tenantId: accessContext.tenantId,
        unitId: branch.id,
      })
    ) {
      return { error: "Você só pode alterar a configuração de filiais sob sua gestão." };
    }

    await db
      .update(schema.branches)
      .set({ autoDistribute: !branch.autoDistribute })
      .where(eq(schema.branches.id, branch.id));
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleDistributionHubAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const branchId = branchIdInput.safeParse(formData.get("branchId"));
  if (!branchId.success) return { error: branchId.error.issues[0]?.message ?? "Filial inválida." };

  try {
    const context = await getDirectorContext();
    const db = getDatabase();
    const [branch] = await db
      .select({ id: schema.branches.id, isDistributionHub: schema.branches.isDistributionHub })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId.data), eq(schema.branches.tenantId, context.tenantId)))
      .limit(1);
    if (!branch) return { error: "Filial não encontrada." };

    await db.transaction(async (tx) => {
      if (!branch.isDistributionHub) {
        const [existingHub] = await tx
          .select({ id: schema.branches.id })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.isDistributionHub, true)))
          .limit(1);
        if (existingHub) throw new Error("Já existe uma Central de redistribuição nesta corretora.");
      }
      await tx
        .update(schema.branches)
        .set({
          isDistributionHub: !branch.isDistributionHub,
          ...(branch.isDistributionHub ? {} : { autoDistribute: false }),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.branches.id, branch.id), eq(schema.branches.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "branch",
        entidadeId: branch.id,
        acao: branch.isDistributionHub ? "central_redistribuicao_desativada" : "central_redistribuicao_ativada",
      });
    });
    return { success: true, message: branch.isDistributionHub ? "Central de redistribuição desativada." : "Central de redistribuição ativada. A unidade não participará da distribuição automática." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleBrokerAvailabilityAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const brokerId = branchIdInput.safeParse(formData.get("brokerId"));
  if (!brokerId.success) return { error: "Corretor inválido." };

  try {
    const accessContext = await resolveAccessContext();
    const db = getDatabase();
    const [membership] = await db
      .select({
        id: schema.tenantMemberships.id,
        userId: schema.tenantMemberships.userId,
        branchId: schema.tenantMemberships.branchId,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        role: schema.tenantMemberships.role,
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, accessContext.tenantId),
          eq(schema.tenantMemberships.userId, brokerId.data),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!membership) return { error: "Corretor não encontrado nesta corretora." };

    const legacyAllowed =
      accessContext.role === "director" ||
      (accessContext.role === "manager" &&
        Boolean(accessContext.branchId) &&
        membership.branchId === accessContext.branchId);

    await evaluateShadowAuthorization({
      operationKey: "branches.toggleBrokerAvailabilityAction",
      legacyAllowed,
      context: accessContext,
      capability: "gerenciar_configuracoes_unidade",
      resource: {
        tenantId: accessContext.tenantId,
        unitId: membership.branchId,
      },
    });

    if (
      !AuthorizationService.can(accessContext, "gerenciar_configuracoes_unidade", {
        tenantId: accessContext.tenantId,
        unitId: membership.branchId,
      })
    ) {
      return { error: "Você só pode controlar corretores de filiais sob sua gestão." };
    }

    const nextStatus = membership.availabilityStatus === "available" ? "paused" : "available";
    await db.transaction(async (tx) => {
      await tx
        .update(schema.tenantMemberships)
        .set({ availabilityStatus: nextStatus, updatedAt: new Date() })
        .where(eq(schema.tenantMemberships.id, membership.id));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: accessContext.userId,
        entidade: "tenant_membership",
        entidadeId: membership.id,
        acao:
          nextStatus === "paused" ? "pausou_recebimento_de_leads" : "reativou_recebimento_de_leads",
      });
    });
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function setBrokersAvailabilityAction(
  _previous: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const ids = String(formData.get("brokerIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parsed = z.array(z.string().uuid()).safeParse(ids);
  if (!parsed.success || !parsed.data.length) return { error: "Selecione ao menos um corretor." };
  const target = z.enum(["available", "paused"]).safeParse(formData.get("target"));
  if (!target.success) return { error: "Ação inválida." };

  try {
    const accessContext = await resolveAccessContext();
    const db = getDatabase();
    const memberships = await db
      .select({
        id: schema.tenantMemberships.id,
        branchId: schema.tenantMemberships.branchId,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, accessContext.tenantId),
          inArray(schema.tenantMemberships.userId, parsed.data),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
        ),
      );
    if (!memberships.length) return { error: "Nenhum corretor encontrado nesta corretora." };

    const unauthorized = memberships.some(
      (m) =>
        !AuthorizationService.canAccessUnit(accessContext, m.branchId),
    );
    if (unauthorized) {
      return { error: "Você só pode controlar corretores de filiais sob sua gestão." };
    }

    let updated = 0;
    await db.transaction(async (tx) => {
      for (const membership of memberships) {
        const shouldUpdate =
          target.data === "paused"
            ? membership.availabilityStatus === "available"
            : membership.availabilityStatus === "paused";
        if (!shouldUpdate) continue;
        updated += 1;
        await tx
          .update(schema.tenantMemberships)
          .set({ availabilityStatus: target.data, updatedAt: new Date() })
          .where(eq(schema.tenantMemberships.id, membership.id));
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: accessContext.userId,
          entidade: "tenant_membership",
          entidadeId: membership.id,
          acao:
            target.data === "paused"
              ? "pausou_recebimento_de_leads"
              : "reativou_recebimento_de_leads",
        });
      }
    });
    return {
      success: true,
      message:
        updated > 0
          ? `${updated} corretor(es) atualizado(s).`
          : "Nenhum corretor precisava de alteração.",
    };
  } catch (error) {
    return actionError(error);
  }
}
