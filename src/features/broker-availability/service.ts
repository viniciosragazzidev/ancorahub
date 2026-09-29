import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { isBrokerAvailabilityTableMissing, type BrokerAvailabilityWindowInput } from "./contracts";
import { shouldRequireBrokerAvailabilityOnboarding } from "./service-helpers";

export const BROKER_AVAILABILITY_ONBOARDING_TOUR = "broker-availability-onboarding";
export const BROKER_AVAILABILITY_ONBOARDING_VERSION = 1;

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");

export const availabilityWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startsAt: timeSchema,
  endsAt: timeSchema,
});

export const brokerAvailabilityScheduleSchema = z.object({
  windows: z.array(availabilityWindowSchema).min(1, "Escolha ao menos um período para receber leads."),
});

export { WEEKDAY_LABELS, type BrokerAvailabilityWindowInput } from "./contracts";

function assertNoOverlaps(windows: BrokerAvailabilityWindowInput[]) {
  const byDay = new Map<number, BrokerAvailabilityWindowInput[]>();
  for (const window of windows) {
    if (window.startsAt >= window.endsAt) {
      throw new Error("O horário de término deve ser posterior ao horário inicial.");
    }
    byDay.set(window.dayOfWeek, [...(byDay.get(window.dayOfWeek) ?? []), window]);
  }

  for (const dayWindows of byDay.values()) {
    const ordered = [...dayWindows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index - 1]!.endsAt > ordered[index]!.startsAt) {
        throw new Error("Os horários de um mesmo dia não podem se sobrepor.");
      }
    }
  }
}

function assertBroker(context: TenantContext) {
  if (context.role !== "broker") {
    throw new Error("Somente corretores podem configurar a própria agenda.");
  }
}

export async function isBrokerAvailabilityOnboardingEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.BROKER_AVAILABILITY_ONBOARDING)) !== "false";
}

export async function getBrokerAvailabilityProfile(contextInput?: TenantContext) {
  const context = contextInput ?? (await getRequiredTenantContext());
  assertBroker(context);
  const db = getDatabase();
  try {
    const [windows, progress, membership] = await Promise.all([
      db
        .select({ dayOfWeek: schema.brokerAvailabilityWindows.dayOfWeek, startsAt: schema.brokerAvailabilityWindows.startsAt, endsAt: schema.brokerAvailabilityWindows.endsAt })
        .from(schema.brokerAvailabilityWindows)
        .where(and(eq(schema.brokerAvailabilityWindows.tenantId, context.tenantId), eq(schema.brokerAvailabilityWindows.brokerId, context.userId)))
        .orderBy(asc(schema.brokerAvailabilityWindows.dayOfWeek), asc(schema.brokerAvailabilityWindows.startsAt)),
      db
        .select({ status: schema.userOnboardingProgress.status, currentStep: schema.userOnboardingProgress.currentStep, completedAt: schema.userOnboardingProgress.completedAt })
        .from(schema.userOnboardingProgress)
        .where(and(
          eq(schema.userOnboardingProgress.tenantId, context.tenantId),
          eq(schema.userOnboardingProgress.userId, context.userId),
          eq(schema.userOnboardingProgress.tourKey, BROKER_AVAILABILITY_ONBOARDING_TOUR),
          eq(schema.userOnboardingProgress.version, BROKER_AVAILABILITY_ONBOARDING_VERSION),
        ))
        .limit(1),
      db
        .select({ availabilityStatus: schema.tenantMemberships.availabilityStatus })
        .from(schema.tenantMemberships)
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId)))
        .limit(1),
    ]);

    return {
      windows,
      availabilityStatus: membership[0]?.availabilityStatus ?? "offline",
      onboarding: progress[0] ?? null,
      availabilitySchemaReady: true,
    };
  } catch (error) {
    if (!isBrokerAvailabilityTableMissing(error)) throw error;
    return {
      windows: [],
      availabilityStatus: "offline" as const,
      onboarding: null,
      availabilitySchemaReady: false,
    };
  }
}

export async function needsBrokerAvailabilityOnboarding(contextInput?: TenantContext) {
  const context = contextInput ?? (await getRequiredTenantContext());
  if (context.role !== "broker" || !(await isBrokerAvailabilityOnboardingEnabled())) return false;
  const profile = await getBrokerAvailabilityProfile(context);
  if (!profile.availabilitySchemaReady) return false;
  return shouldRequireBrokerAvailabilityOnboarding(profile.onboarding?.status);
}

export async function saveOwnBrokerAvailability(input: unknown) {
  const context = await getRequiredTenantContext();
  assertBroker(context);
  const parsed = brokerAvailabilityScheduleSchema.parse(input);
  assertNoOverlaps(parsed.windows);

  const now = new Date();
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.delete(schema.brokerAvailabilityWindows).where(and(
      eq(schema.brokerAvailabilityWindows.tenantId, context.tenantId),
      eq(schema.brokerAvailabilityWindows.brokerId, context.userId),
    ));
    await tx.insert(schema.brokerAvailabilityWindows).values(parsed.windows.map((window) => ({
      id: randomUUID(),
      tenantId: context.tenantId,
      brokerId: context.userId,
      dayOfWeek: window.dayOfWeek,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      createdAt: now,
      updatedAt: now,
    })));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "broker_availability_schedule",
      entidadeId: context.userId,
      acao: "updated",
      createdAt: now,
    });
  });

  return { windows: parsed.windows };
}

export async function completeBrokerAvailabilityOnboarding() {
  const context = await getRequiredTenantContext();
  assertBroker(context);
  if (!(await isBrokerAvailabilityOnboardingEnabled())) return { enabled: false };

  const db = getDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(schema.userOnboardingProgress).values({
      id: randomUUID(), tenantId: context.tenantId, userId: context.userId,
      tourKey: BROKER_AVAILABILITY_ONBOARDING_TOUR, version: BROKER_AVAILABILITY_ONBOARDING_VERSION,
      status: "completed", currentStep: 2, startedAt: now, completedAt: now, lastViewedAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.userOnboardingProgress.tenantId, schema.userOnboardingProgress.userId, schema.userOnboardingProgress.tourKey, schema.userOnboardingProgress.version],
      set: { status: "completed", currentStep: 2, completedAt: now, lastViewedAt: now, updatedAt: now },
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "broker_availability_onboarding", entidadeId: context.userId,
      acao: "completed", createdAt: now,
    });
  });
  return { enabled: true };
}

/**
 * A disponibilidade é uma recomendação configurável, não um bloqueio de acesso.
 * Registrar o descarte evita que o modal volte a interromper a operação do corretor.
 */
export async function skipBrokerAvailabilityOnboarding() {
  const context = await getRequiredTenantContext();
  assertBroker(context);
  if (!(await isBrokerAvailabilityOnboardingEnabled())) return { enabled: false };

  const now = new Date();
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.insert(schema.userOnboardingProgress).values({
      id: randomUUID(), tenantId: context.tenantId, userId: context.userId,
      tourKey: BROKER_AVAILABILITY_ONBOARDING_TOUR, version: BROKER_AVAILABILITY_ONBOARDING_VERSION,
      status: "skipped", currentStep: 0, skippedAt: now, lastViewedAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.userOnboardingProgress.tenantId, schema.userOnboardingProgress.userId, schema.userOnboardingProgress.tourKey, schema.userOnboardingProgress.version],
      set: { status: "skipped", currentStep: 0, skippedAt: now, lastViewedAt: now, updatedAt: now },
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "broker_availability_onboarding", entidadeId: context.userId,
      acao: "skipped", createdAt: now,
    });
  });
  return { enabled: true };
}
