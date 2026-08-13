import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

export const temperatureClassValues = [
  "hot",
  "warm",
  "cold",
  "unqualified",
  "no_response",
  "requested_human",
] as const;

export const destinationTypeValues = [
  "general_queue",
  "unit_queue",
  "product_queue",
  "operator_queue",
  "campaign_queue",
  "specific_team",
  "specific_broker",
  "current_duty",
  "manager",
  "specialized_service",
  "existing_portfolio",
  "return_to_origin",
  "no_distribution",
  "close",
  "nurture",
] as const;

export const destinationRuleSchema = z.object({
  id: z.string().optional(),
  temperatureClass: z.enum(temperatureClassValues),
  destinationType: z.enum(destinationTypeValues),
  destinationTargetId: z.string().optional(),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  slaMinutes: z.number().int().min(1).max(1440).default(15),
  fallbackDestinationType: z.enum(destinationTypeValues).default("manager"),
  criteriaConditions: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().default(0),
});

export type DestinationRuleInput = z.infer<typeof destinationRuleSchema>;

export const brokerEligibilitySchema = z.object({
  userId: z.string(),
  allowedLeadTypes: z.array(z.string()).default(["hot", "warm", "cold"]),
  specialties: z.array(z.string()).default(["individual", "familiar", "empresarial", "pme"]),
  operators: z.array(z.string()).default(["unimed", "hapvida"]),
  maxSimultaneousCapacity: z.number().int().min(1).max(100).default(15),
  dailyLimit: z.number().int().min(1).max(200).default(40),
  participatesInDuty: z.boolean().default(true),
  receivesOffHours: z.boolean().default(false),
  active: z.boolean().default(true),
  paused: z.boolean().default(false),
});

export type BrokerEligibilityInput = z.infer<typeof brokerEligibilitySchema>;

export async function getDestinationRules(tenantId: string) {
  const db = getDatabase();

  try {
    const existing = await db
      .select()
      .from(schema.aiQualificationDestinationRules)
      .where(eq(schema.aiQualificationDestinationRules.tenantId, tenantId))
      .orderBy(asc(schema.aiQualificationDestinationRules.sortOrder));

    if (existing.length > 0) {
      return existing;
    }

    // Seed default destination rules
    const now = new Date();
    const defaultRules = [
      {
        id: randomUUID(),
        tenantId,
        temperatureClass: "hot",
        destinationType: "current_duty",
        priority: "high",
        slaMinutes: 2,
        fallbackDestinationType: "manager",
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        tenantId,
        temperatureClass: "warm",
        destinationType: "general_queue",
        priority: "normal",
        slaMinutes: 15,
        fallbackDestinationType: "manager",
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        tenantId,
        temperatureClass: "cold",
        destinationType: "nurture",
        priority: "low",
        slaMinutes: 120,
        fallbackDestinationType: "no_distribution",
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        tenantId,
        temperatureClass: "unqualified",
        destinationType: "close",
        priority: "low",
        slaMinutes: 0,
        fallbackDestinationType: "no_distribution",
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.insert(schema.aiQualificationDestinationRules).values(defaultRules).onConflictDoNothing();

    return await db
      .select()
      .from(schema.aiQualificationDestinationRules)
      .where(eq(schema.aiQualificationDestinationRules.tenantId, tenantId))
      .orderBy(asc(schema.aiQualificationDestinationRules.sortOrder));
  } catch (err) {
    console.error("[destination-service] Error querying destination rules:", err);
    return [
      {
        id: "default-dest-1",
        tenantId,
        temperatureClass: "hot",
        destinationType: "current_duty",
        destinationTargetId: null,
        priority: "high",
        slaMinutes: 2,
        fallbackDestinationType: "manager",
        criteriaConditions: null,
        sortOrder: 1,
      },
      {
        id: "default-dest-2",
        tenantId,
        temperatureClass: "warm",
        destinationType: "general_queue",
        destinationTargetId: null,
        priority: "normal",
        slaMinutes: 15,
        fallbackDestinationType: "manager",
        criteriaConditions: null,
        sortOrder: 2,
      },
    ];
  }
}

export async function saveDestinationRule(
  tenantId: string,
  actorUserId: string,
  input: DestinationRuleInput
) {
  const data = destinationRuleSchema.parse(input);
  const db = getDatabase();
  const now = new Date();
  const ruleId = data.id ?? randomUUID();

  await db
    .insert(schema.aiQualificationDestinationRules)
    .values({
      id: ruleId,
      tenantId,
      temperatureClass: data.temperatureClass,
      destinationType: data.destinationType,
      destinationTargetId: data.destinationTargetId,
      priority: data.priority,
      slaMinutes: data.slaMinutes,
      fallbackDestinationType: data.fallbackDestinationType,
      criteriaConditions: data.criteriaConditions,
      sortOrder: data.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.aiQualificationDestinationRules.id],
      set: {
        temperatureClass: data.temperatureClass,
        destinationType: data.destinationType,
        destinationTargetId: data.destinationTargetId,
        priority: data.priority,
        slaMinutes: data.slaMinutes,
        fallbackDestinationType: data.fallbackDestinationType,
        criteriaConditions: data.criteriaConditions,
        sortOrder: data.sortOrder,
        updatedAt: now,
      },
    });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_destination_rule",
    entidadeId: ruleId,
    acao: `destination_rule.updated:${data.temperatureClass}`,
  });

  return getDestinationRules(tenantId);
}

export async function getBrokerEligibilityProfiles(tenantId: string) {
  const db = getDatabase();
  try {
    const profiles = await db
      .select({
        id: schema.brokerEligibilityProfiles.id,
        tenantId: schema.brokerEligibilityProfiles.tenantId,
        userId: schema.brokerEligibilityProfiles.userId,
        userName: schema.user.name,
        userEmail: schema.user.email,
        allowedLeadTypes: schema.brokerEligibilityProfiles.allowedLeadTypes,
        specialties: schema.brokerEligibilityProfiles.specialties,
        operators: schema.brokerEligibilityProfiles.operators,
        maxSimultaneousCapacity: schema.brokerEligibilityProfiles.maxSimultaneousCapacity,
        dailyLimit: schema.brokerEligibilityProfiles.dailyLimit,
        participatesInDuty: schema.brokerEligibilityProfiles.participatesInDuty,
        receivesOffHours: schema.brokerEligibilityProfiles.receivesOffHours,
        active: schema.brokerEligibilityProfiles.active,
        paused: schema.brokerEligibilityProfiles.paused,
      })
      .from(schema.brokerEligibilityProfiles)
      .innerJoin(schema.user, eq(schema.brokerEligibilityProfiles.userId, schema.user.id))
      .where(eq(schema.brokerEligibilityProfiles.tenantId, tenantId));

    return profiles;
  } catch (err) {
    console.error("[destination-service] Error querying broker eligibility profiles:", err);
    return [];
  }
}

export async function saveBrokerEligibilityProfile(
  tenantId: string,
  actorUserId: string,
  input: BrokerEligibilityInput
) {
  const data = brokerEligibilitySchema.parse(input);
  const db = getDatabase();
  const now = new Date();

  await db
    .insert(schema.brokerEligibilityProfiles)
    .values({
      id: randomUUID(),
      tenantId,
      userId: data.userId,
      allowedLeadTypes: data.allowedLeadTypes,
      specialties: data.specialties,
      operators: data.operators,
      maxSimultaneousCapacity: data.maxSimultaneousCapacity,
      dailyLimit: data.dailyLimit,
      participatesInDuty: data.participatesInDuty,
      receivesOffHours: data.receivesOffHours,
      active: data.active,
      paused: data.paused,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.brokerEligibilityProfiles.tenantId,
        schema.brokerEligibilityProfiles.userId,
      ],
      set: {
        allowedLeadTypes: data.allowedLeadTypes,
        specialties: data.specialties,
        operators: data.operators,
        maxSimultaneousCapacity: data.maxSimultaneousCapacity,
        dailyLimit: data.dailyLimit,
        participatesInDuty: data.participatesInDuty,
        receivesOffHours: data.receivesOffHours,
        active: data.active,
        paused: data.paused,
        updatedAt: now,
      },
    });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "broker_eligibility_profile",
    entidadeId: `${tenantId}:${data.userId}`,
    acao: `broker_eligibility.updated:${data.userId}`,
  });

  return getBrokerEligibilityProfiles(tenantId);
}

export type QualificationResolvedDestination = {
  temperatureClass: string;
  destinationType: string;
  destinationTargetId: string | null;
  priority: "high" | "normal" | "low";
  slaMinutes: number;
  fallbackDestinationType: string;
};

export async function resolveQualificationDestination(input: {
  tenantId: string;
  classification: "hot" | "warm" | "cold" | "not_qualified" | "pending";
  score: number;
}): Promise<QualificationResolvedDestination> {
  let matched: {
    temperatureClass: string;
    destinationType: string;
    destinationTargetId?: string | null;
    priority: string;
    slaMinutes?: number | null;
    fallbackDestinationType?: string | null;
  } | undefined;

  try {
    const rules = await getDestinationRules(input.tenantId);
    const targetClass = input.classification === "not_qualified" ? "unqualified" : input.classification;
    matched = rules.find((rule) => rule.temperatureClass === targetClass) ?? rules[0];
  } catch (err) {
    console.warn("[resolveQualificationDestination] DB query skipped in unit environment, using fallback rules.");
  }

  if (matched) {
    return {
      temperatureClass: matched.temperatureClass,
      destinationType: matched.destinationType,
      destinationTargetId: matched.destinationTargetId ?? null,
      priority: (["high", "normal", "low"].includes(matched.priority) ? matched.priority : "normal") as "high" | "normal" | "low",
      slaMinutes: matched.slaMinutes ?? 15,
      fallbackDestinationType: matched.fallbackDestinationType ?? "manager",
    };
  }

  // Fallbacks padrão se nenhuma regra existir
  if (input.classification === "hot") {
    return {
      temperatureClass: "hot",
      destinationType: "current_duty",
      destinationTargetId: null,
      priority: "high",
      slaMinutes: 2,
      fallbackDestinationType: "manager",
    };
  }

  if (input.classification === "warm") {
    return {
      temperatureClass: "warm",
      destinationType: "general_queue",
      destinationTargetId: null,
      priority: "normal",
      slaMinutes: 15,
      fallbackDestinationType: "manager",
    };
  }

  return {
    temperatureClass: input.classification === "not_qualified" ? "unqualified" : "cold",
    destinationType: input.classification === "not_qualified" ? "close" : "nurture",
    destinationTargetId: null,
    priority: "low",
    slaMinutes: 120,
    fallbackDestinationType: "no_distribution",
  };
}

