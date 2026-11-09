import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { lockMonthlyDutyPlans, removeDatedRosterAssignmentFromMonthlyPlans } from "@/features/lead-distribution/monthly-duty-plan-assignments";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import { selectAssignmentsToRelease } from "./roster-release";

/** A refusal whose message is safe to show to the broker. */
export class BrokerUnitChangeError extends Error {}

export type BrokerUnitChangeResult = {
  branchName: string;
  changed: boolean;
  releasedAssignments: number;
};

type Actor = { tenantId: string; userId: string; role: string };

/**
 * The broker moves to another active unit of the same company (DEC-170).
 * Identity and tenant come from the trusted server context. In one transaction:
 * membership and broker profile move together, the old supervisor link is cleared
 * and the broker's open plantão slots in the old unit are closed (also out of the
 * monthly escala). Leads, role, job title and availability stay as they are.
 */
export async function changeOwnBranch(actor: Actor, branchId: string, now = new Date()): Promise<BrokerUnitChangeResult> {
  if (actor.role !== "broker") throw new BrokerUnitChangeError("Só o corretor pode trocar a própria unidade por aqui.");
  const db = getDatabase();

  const [target] = await db.select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(and(
      eq(schema.branches.id, branchId),
      eq(schema.branches.tenantId, actor.tenantId),
      eq(schema.branches.status, "active"),
    ))
    .limit(1);
  if (!target) throw new BrokerUnitChangeError("Escolha uma unidade ativa da sua corretora.");

  const [membership] = await db.select({
    id: schema.tenantMemberships.id,
    branchId: schema.tenantMemberships.branchId,
    supervisorId: schema.tenantMemberships.supervisorId,
  })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, actor.tenantId),
      eq(schema.tenantMemberships.userId, actor.userId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .limit(1);
  if (!membership) throw new BrokerUnitChangeError("Não encontramos seu cadastro ativo de corretor.");
  if (membership.branchId === target.id) return { branchName: target.name, changed: false, releasedAssignments: 0 };
  const fromBranchId = membership.branchId;
  if (!fromBranchId) throw new BrokerUnitChangeError("Seu cadastro está sem unidade. Peça à gestão para corrigir.");

  const [fromBranch] = await db.select({ name: schema.branches.name })
    .from(schema.branches)
    .where(and(eq(schema.branches.id, fromBranchId), eq(schema.branches.tenantId, actor.tenantId)))
    .limit(1);

  const releasedAssignments = await db.transaction(async (tx) => {
    // Same lock as the escala editors, so the monthly plan JSON and the slots change together.
    await lockMonthlyDutyPlans(tx, actor.tenantId);

    const [moved] = await tx.update(schema.tenantMemberships).set({ branchId: target.id, supervisorId: null, updatedAt: now })
      .where(and(
        eq(schema.tenantMemberships.id, membership.id),
        eq(schema.tenantMemberships.tenantId, actor.tenantId),
        eq(schema.tenantMemberships.userId, actor.userId),
        eq(schema.tenantMemberships.branchId, fromBranchId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
      ))
      .returning({ id: schema.tenantMemberships.id });
    if (!moved) throw new BrokerUnitChangeError("Sua unidade mudou em outra tela. Atualize a página e tente de novo.");

    const [profile] = await tx.update(schema.brokerProfiles).set({ branchId: target.id, updatedAt: now })
      .where(and(eq(schema.brokerProfiles.tenantId, actor.tenantId), eq(schema.brokerProfiles.userId, actor.userId)))
      .returning({ id: schema.brokerProfiles.id });
    if (!profile) throw new BrokerUnitChangeError("Não encontramos seu perfil de corretor. Nada foi alterado.");

    // Slots of plantões that belong to the old unit; company-wide plantões (no unit) stay.
    const slots = await tx.select({
      id: schema.dutyRosterAssignments.id,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      dutyDate: schema.dutyRosterAssignments.dutyDate,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      timezone: schema.unitDutySchedules.timezone,
    })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, actor.tenantId),
        eq(schema.dutyRosterAssignments.brokerId, actor.userId),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.unitDutySchedules.branchId, fromBranchId),
      ));
    const released = selectAssignmentsToRelease(slots, now);
    for (const slot of released) {
      if (slot.dutyDate) {
        await removeDatedRosterAssignmentFromMonthlyPlans(tx, {
          tenantId: actor.tenantId,
          scheduleId: slot.scheduleId,
          brokerId: actor.userId,
          dutyDate: slot.dutyDate,
          rosterAssignmentId: slot.id,
          now,
        });
      }
    }
    if (released.length) {
      await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: actor.userId, updatedAt: now })
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, actor.tenantId),
          eq(schema.dutyRosterAssignments.brokerId, actor.userId),
          eq(schema.dutyRosterAssignments.status, "active"),
          inArray(schema.dutyRosterAssignments.id, released.map((slot) => slot.id)),
        ));
      await tx.insert(schema.auditLogs).values(released.map((slot) => ({
        id: randomUUID(), userId: actor.userId, entidade: "duty_roster_assignment", entidadeId: slot.id,
        acao: "duty_roster_assignment.removed_by_unit_change",
        metadata: { fromBranchId, toBranchId: target.id },
      })));
    }

    if (membership.supervisorId) {
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: actor.userId, entidade: "supervisor_team", entidadeId: membership.supervisorId,
        acao: "corretor_saiu_da_equipe_ao_mudar_unidade",
        metadata: { brokerMembershipId: membership.id, fromBranchId, toBranchId: target.id },
      });
    }
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: actor.userId, entidade: "tenant_membership", entidadeId: membership.id,
      acao: "alterou_unidade_propria",
      metadata: {
        fromBranchId, fromBranchName: fromBranch?.name ?? null,
        toBranchId: target.id, toBranchName: target.name,
        releasedAssignmentIds: released.map((slot) => slot.id),
        supervisorRemoved: Boolean(membership.supervisorId),
      },
    });
    return released.length;
  });

  await notifyUnitManagers({ actor, fromBranchId, fromBranchName: fromBranch?.name ?? "outra unidade", toBranchId: target.id, toBranchName: target.name, releasedAssignments, now })
    .catch(() => undefined);
  return { branchName: target.name, changed: true, releasedAssignments };
}

async function notifyUnitManagers(input: {
  actor: Actor;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  releasedAssignments: number;
  now: Date;
}) {
  const db = getDatabase();
  const [[broker], managers] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, input.actor.userId)).limit(1),
    db.select({ userId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, input.actor.tenantId),
        eq(schema.tenantMemberships.role, "manager"),
        eq(schema.tenantMemberships.status, "active"),
        inArray(schema.tenantMemberships.branchId, [input.fromBranchId, input.toBranchId]),
      )),
  ]);
  const name = broker?.name ?? "Um corretor";
  const slots = input.releasedAssignments === 1 ? "1 vaga de plantão foi encerrada" : `${input.releasedAssignments} vagas de plantão foram encerradas`;
  await Promise.all(managers.map((manager) => {
    const leaving = manager.branchId === input.fromBranchId;
    return publishNotification({
      capability: "broker_unit_change",
      tenantId: input.actor.tenantId,
      recipientUserId: manager.userId,
      type: "broker_unit_change",
      title: leaving ? `${name} saiu da unidade ${input.fromBranchName}` : `${name} entrou na unidade ${input.toBranchName}`,
      message: leaving
        ? `Foi para ${input.toBranchName}.${input.releasedAssignments ? ` ${slots} na sua escala.` : ""} Os leads continuam com ${name}.`
        : `Veio de ${input.fromBranchName}. Já pode entrar nos plantões da sua unidade.`,
      url: leaving ? "/plantoes" : "/equipe",
      tag: `broker-unit-${input.actor.userId}`,
      idempotencyKey: `broker-unit-change:${input.actor.userId}:${input.now.getTime()}:${manager.userId}`,
    });
  }));
}
