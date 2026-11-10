import "server-only";

import { and, count, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";

import { getFeatureFlag, getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSaoPauloDateKey } from "./dated-duty-roster";
import { findRunningDutySchedule } from "./duty-presence-domain";
import {
  ADAPTIVE_WINDOW_DAYS,
  buildPlantaoLoadFactors,
  computeAdaptiveWeight,
  DEFAULT_PLANTAO_PRIORITY_SETTINGS,
  elapsedDutyMinutes,
  normalizePlantaoPrioritySettings,
  PLANTAO_EXPIRY_GUARD_WINDOW_MINUTES,
  plantaoPrioritySettingKey,
  plantaoWeightToScaled,
  resolvePlantaoTypeWeight,
  type PlantaoExpiryStats,
  type PlantaoPriorityDecision,
  type PlantaoPrioritySettings,
  type PlantaoShareStats,
  type PlantaoWeightReason,
} from "./plantao-priority-core";
import { NON_COUNTING_OFFER_STATUS } from "./received-in-day-core";

/**
 * Prioridade por tipo de plantão, lado servidor (decisão 2026-11-10).
 * Lê a configuração e as estatísticas do dia e devolve os fatores de carga que o
 * ranking, a escolha sob trava e a prévia usam (plantao-priority-core.ts).
 * Qualquer erro aqui devolve null: a distribuição segue exatamente como hoje.
 */

/** A flag é lida a cada lead distribuído: 30 s de cache evita 1 consulta por lead (revisão do Vigia, 10/11). */
const flagCache = new TtlCache<boolean>(30_000, 1);

export async function isPlantaoPriorityFlagOn() {
  return flagCache.getOrLoad("flag", async () => (await getFeatureFlag(FEATURE_FLAGS.PLANTAO_PRIORITY).catch(() => "false")) === "true");
}

export async function getPlantaoPrioritySettings(tenantId: string): Promise<PlantaoPrioritySettings> {
  try {
    const stored = await getSystemSetting(plantaoPrioritySettingKey(tenantId));
    return stored ? normalizePlantaoPrioritySettings(JSON.parse(stored)) : DEFAULT_PLANTAO_PRIORITY_SETTINGS;
  } catch {
    return DEFAULT_PLANTAO_PRIORITY_SETTINGS;
  }
}

type TypeStats = {
  /** Ofertas quentes/mornas do dia por tipo, no escopo de plantões consultado. */
  offersByType: Map<string, number>;
  totalOffers: number;
  expiryByType: Map<string, PlantaoExpiryStats>;
};

/** Estatísticas do dia mudam devagar: 60 s de cache por empresa e escopo poupa 2 consultas por lead. */
const statsCache = new TtlCache<TypeStats>(60_000, 200);

async function loadTypeStats(input: {
  tenantId: string;
  scheduleIds: readonly string[] | null;
  typeIds: readonly string[];
  temps: readonly string[];
  dutySince: Date;
  now: Date;
}): Promise<TypeStats> {
  const key = [input.tenantId, input.dutySince.toISOString(), [...(input.scheduleIds ?? ["*"])].sort().join(","), [...input.typeIds].sort().join(","), input.temps.join(",")].join("|");
  return statsCache.getOrLoad(key, async () => {
    const db = getDatabase();
    const expirySince = new Date(input.now.getTime() - PLANTAO_EXPIRY_GUARD_WINDOW_MINUTES * 60_000);
    const [shareRows, expiryRows] = await Promise.all([
      // Fatia do dia: ofertas de leads quentes/mornos por plantão (tipo vem do plantão).
      db.select({ typeId: schema.unitDutySchedules.typeId, total: count(schema.leadOffers.id) })
        .from(schema.leadOffers)
        .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, input.tenantId)))
        .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leadOffers.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, input.tenantId)))
        .where(and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          input.scheduleIds ? inArray(schema.leadOffers.dutyScheduleId, [...input.scheduleIds]) : isNotNull(schema.leadOffers.dutyScheduleId),
          gte(schema.leadOffers.offeredAt, input.dutySince),
          ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS),
          inArray(schema.leads.qualificationStatus, [...input.temps]),
        ))
        .groupBy(schema.unitDutySchedules.typeId),
      // Expiração nas últimas 2 h, por tipo (todos os plantões do tipo): só ofertas já resolvidas.
      input.typeIds.length
        ? db.select({
          typeId: schema.unitDutySchedules.typeId,
          resolved: count(schema.leadOffers.id),
          expired: sql<number>`count(*) filter (where ${schema.leadOffers.status} = 'EXPIRED')`.mapWith(Number),
        })
          .from(schema.leadOffers)
          .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leadOffers.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, input.tenantId)))
          .where(and(
            eq(schema.leadOffers.tenantId, input.tenantId),
            inArray(schema.unitDutySchedules.typeId, [...input.typeIds]),
            gte(schema.leadOffers.offeredAt, expirySince),
            ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS),
            or(lte(schema.leadOffers.expiresAt, input.now), inArray(schema.leadOffers.status, ["ACCEPTED", "DECLINED", "EXPIRED", "LOST"])),
          ))
          .groupBy(schema.unitDutySchedules.typeId)
        : Promise.resolve([] as Array<{ typeId: string | null; resolved: number; expired: number }>),
    ]);
    const offersByType = new Map<string, number>();
    let totalOffers = 0;
    for (const row of shareRows) {
      const total = Number(row.total);
      totalOffers += total;
      if (row.typeId) offersByType.set(row.typeId, (offersByType.get(row.typeId) ?? 0) + total);
    }
    const expiryByType = new Map<string, PlantaoExpiryStats>();
    for (const row of expiryRows) if (row.typeId) expiryByType.set(row.typeId, { resolved: Number(row.resolved), expired: Number(row.expired) });
    return { offersByType, totalOffers, expiryByType };
  });
}

/**
 * Peso adaptativo do dia (desligado por padrão). Recalcula no máximo 1x por dia
 * e grava o resultado em `computed` da própria configuração. Falha = mantém o anterior.
 */
async function ensureAdaptiveWeights(tenantId: string, settings: PlantaoPrioritySettings, now: Date): Promise<PlantaoPrioritySettings> {
  const today = getSaoPauloDateKey(now);
  const stale = Object.entries(settings.types).filter(([typeId, config]) => config.adaptive && settings.computed[typeId]?.date !== today);
  if (!stale.length) return settings;
  try {
    const since = new Date(now.getTime() - ADAPTIVE_WINDOW_DAYS * 24 * 60 * 60_000);
    const rows = await getDatabase().select({
      typeId: schema.unitDutySchedules.typeId,
      leads: count(schema.leads.id),
      sales: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`.mapWith(Number),
    })
      .from(schema.leads)
      .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leads.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, tenantId)))
      .where(and(eq(schema.leads.tenantId, tenantId), gte(schema.leads.assignedAt, since)))
      .groupBy(schema.unitDutySchedules.typeId);
    const globalLeads = rows.reduce((total, row) => total + Number(row.leads), 0);
    const globalSales = rows.reduce((total, row) => total + Number(row.sales), 0);
    const computed = { ...settings.computed };
    for (const [typeId, config] of stale) {
      const row = rows.find((item) => item.typeId === typeId);
      const result = computeAdaptiveWeight({
        sales: Number(row?.sales ?? 0),
        leads: Number(row?.leads ?? 0),
        globalSales,
        globalLeads,
        previous: settings.computed[typeId]?.w ?? config.base,
        cap: settings.cap,
      });
      computed[typeId] = { date: today, w: result.w, sales: Number(row?.sales ?? 0), leads: Number(row?.leads ?? 0), reason: result.reason };
    }
    // Relê a configuração atual para não sobrescrever uma alteração do diretor feita no meio do caminho.
    const latest = await getPlantaoPrioritySettings(tenantId);
    const next = { ...latest, computed: { ...latest.computed, ...computed } };
    await setSystemSetting(plantaoPrioritySettingKey(tenantId), JSON.stringify(next));
    return next;
  } catch (error) {
    console.error("[plantao-priority] adaptive.failed", { tenantId, error: error instanceof Error ? error.name : "unknown_error" });
    return settings;
  }
}

function adaptiveWeightOf(settings: PlantaoPrioritySettings, typeId: string) {
  return settings.types[typeId]?.adaptive ? settings.computed[typeId]?.w ?? null : null;
}

/**
 * Decisão da prioridade para uma escolha de corretor. null quando a flag está
 * desligada, o modo é off, não há plantão no escopo ou algo falhou.
 */
export async function resolvePlantaoPriority(input: {
  tenantId: string;
  /** qualification_status do lead (hot/warm/cold...). */
  temperature: string | null;
  /** Plantão de cada corretor escalado nesta escolha (todos, antes do intervalo entre ofertas). */
  scheduleIdByBroker: ReadonlyMap<string, string>;
  /** Corretores que entram na comparação (os mesmos passados ao ranking). */
  brokerIds: readonly string[];
  dutySince: Date;
  /** A contagem de recebidos é por plantão (fila exclusiva): só aí o nivelamento por horas faz sentido. */
  countsPerSchedule: boolean;
  now?: Date;
}): Promise<PlantaoPriorityDecision | null> {
  try {
    if (!input.brokerIds.length || !input.scheduleIdByBroker.size) return null;
    if (!(await isPlantaoPriorityFlagOn())) return null;
    let settings = await getPlantaoPrioritySettings(input.tenantId);
    const mode = settings.mode;
    if (mode === "off") return null;
    const now = input.now ?? new Date();
    const scheduleIds = [...new Set(input.scheduleIdByBroker.values())];
    const schedules = await getDatabase().select({
      id: schema.unitDutySchedules.id,
      typeId: schema.unitDutySchedules.typeId,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      timezone: schema.unitDutySchedules.timezone,
      status: schema.unitDutySchedules.status,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
    }).from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, input.tenantId), inArray(schema.unitDutySchedules.id, scheduleIds)));
    const typeIdBySchedule: Record<string, string | null> = Object.fromEntries(schedules.map((schedule) => [schedule.id, schedule.typeId ?? null]));
    const weightedTypeIds = [...new Set(schedules.flatMap((schedule) => schedule.typeId && settings.types[schedule.typeId] && (settings.types[schedule.typeId].base > 1 || settings.types[schedule.typeId].adaptive) ? [schedule.typeId] : []))];

    const hotOrWarm = Boolean(input.temperature && input.temperature !== "cold" && (settings.temps as readonly string[]).includes(input.temperature));
    if (hotOrWarm && weightedTypeIds.some((typeId) => settings.types[typeId]?.adaptive)) settings = await ensureAdaptiveWeights(input.tenantId, settings, now);
    const stats = hotOrWarm && weightedTypeIds.length
      ? await loadTypeStats({ tenantId: input.tenantId, scheduleIds, typeIds: weightedTypeIds, temps: settings.temps, dutySince: input.dutySince, now })
      : null;

    // Fatia justa = escalados do tipo ÷ escalados ativos (todos os plantões desta escolha).
    const brokersByType = new Map<string, number>();
    for (const scheduleId of input.scheduleIdByBroker.values()) {
      const typeId = typeIdBySchedule[scheduleId];
      if (typeId) brokersByType.set(typeId, (brokersByType.get(typeId) ?? 0) + 1);
    }
    const totalBrokers = input.scheduleIdByBroker.size;

    const weightBySchedule: Record<string, number> = {};
    const reasonBySchedule: Record<string, PlantaoWeightReason> = {};
    for (const scheduleId of scheduleIds) {
      const typeId = typeIdBySchedule[scheduleId];
      const config = typeId ? settings.types[typeId] : undefined;
      const share: PlantaoShareStats | null = stats && typeId
        ? { typeOffers: stats.offersByType.get(typeId) ?? 0, totalOffers: stats.totalOffers, typeBrokers: brokersByType.get(typeId) ?? 0, totalBrokers }
        : null;
      const result = resolvePlantaoTypeWeight({
        base: config?.base ?? 1,
        adaptiveWeight: typeId ? adaptiveWeightOf(settings, typeId) : null,
        cap: settings.cap,
        temperature: input.temperature,
        temps: settings.temps,
        shareCap: settings.shareCap,
        share,
        expiry: stats && typeId ? stats.expiryByType.get(typeId) ?? null : null,
      });
      weightBySchedule[scheduleId] = result.w;
      reasonBySchedule[scheduleId] = result.reason;
    }

    // Rajada da tarde: nivela por recebidos ÷ minutos cumpridos do plantão de cada corretor.
    let elapsedMinutesBySchedule: Record<string, number> | null = null;
    if (settings.levelByHours && input.countsPerSchedule) {
      elapsedMinutesBySchedule = {};
      for (const schedule of schedules) {
        const running = findRunningDutySchedule([schedule], now);
        if (running) elapsedMinutesBySchedule[schedule.id] = elapsedDutyMinutes(running.window.startsAt, input.dutySince, now);
      }
    }
    const scheduleIdByBroker = Object.fromEntries(input.scheduleIdByBroker);
    const factorByBroker = buildPlantaoLoadFactors({
      brokerIds: input.brokerIds,
      scheduleIdByBroker,
      weightScaledBySchedule: Object.fromEntries(Object.entries(weightBySchedule).map(([id, w]) => [id, plantaoWeightToScaled(w, settings.cap)])),
      elapsedMinutesBySchedule,
    });
    const hoursLeveling = Boolean(elapsedMinutesBySchedule && input.brokerIds.every((id) => {
      const scheduleId = scheduleIdByBroker[id];
      return scheduleId && elapsedMinutesBySchedule![scheduleId];
    }));
    return { mode, factorByBroker, scheduleIdByBroker, weightBySchedule, reasonBySchedule, typeIdBySchedule, hoursLeveling, temperature: input.temperature };
  } catch (error) {
    console.error("[plantao-priority] resolve.failed", { tenantId: input.tenantId, error: error instanceof Error ? error.name : "unknown_error" });
    return null;
  }
}

export type PlantaoPriorityTypeOverview = {
  typeId: string;
  name: string;
  base: number;
  adaptive: boolean;
  /** Peso que um lead quente receberia agora (proteções aplicadas). */
  effectiveWeight: number;
  reason: PlantaoWeightReason;
  computed: PlantaoPrioritySettings["computed"][string] | null;
};

export type PlantaoPriorityOverview = {
  flagOn: boolean;
  settings: PlantaoPrioritySettings;
  types: PlantaoPriorityTypeOverview[];
};

/**
 * Painel do diretor: peso efetivo de hoje por tipo, com as proteções (teto de
 * fatia na empresa toda, expiração em 2 h). Somente leitura.
 */
export async function getPlantaoPriorityOverview(tenantId: string, dutySince: Date, now = new Date()): Promise<PlantaoPriorityOverview> {
  const [flagOn, settings] = await Promise.all([isPlantaoPriorityFlagOn(), getPlantaoPrioritySettings(tenantId)]);
  const db = getDatabase();
  const typeRows = await db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name })
    .from(schema.dutyScheduleTypes)
    .where(and(eq(schema.dutyScheduleTypes.tenantId, tenantId), eq(schema.dutyScheduleTypes.status, "active")))
    .orderBy(schema.dutyScheduleTypes.name);
  const weightedTypeIds = typeRows.flatMap((type) => settings.types[type.id] && (settings.types[type.id].base > 1 || settings.types[type.id].adaptive) ? [type.id] : []);
  let stats: TypeStats | null = null;
  const brokersByType = new Map<string, number>();
  let totalBrokers = 0;
  try {
    stats = weightedTypeIds.length
      ? await loadTypeStats({ tenantId, scheduleIds: null, typeIds: weightedTypeIds, temps: settings.temps, dutySince, now })
      : null;
    if (stats) {
      // Escalados ativos agora, por tipo (aproximação da fatia justa para o painel).
      const local = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
      const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[local.find((part) => part.type === "weekday")?.value ?? "Sun"] ?? 0;
      const hour = local.find((part) => part.type === "hour")?.value ?? "00";
      const time = `${hour === "24" ? "00" : hour}:${local.find((part) => part.type === "minute")?.value ?? "00"}`;
      const rosterRows = await db.select({ typeId: schema.unitDutySchedules.typeId, brokers: sql<number>`count(distinct ${schema.dutyRosterAssignments.brokerId})`.mapWith(Number) })
        .from(schema.dutyRosterAssignments)
        .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, tenantId)))
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, tenantId),
          eq(schema.dutyRosterAssignments.status, "active"),
          eq(schema.dutyRosterAssignments.dayOfWeek, weekday),
          lte(schema.dutyRosterAssignments.startsAt, time),
          sql`${schema.dutyRosterAssignments.endsAt} > ${time}`,
          sql`${schema.dutyRosterAssignments.pausedAt} is null`,
          eq(schema.unitDutySchedules.status, "active"),
        ))
        .groupBy(schema.unitDutySchedules.typeId);
      for (const row of rosterRows) {
        totalBrokers += Number(row.brokers);
        if (row.typeId) brokersByType.set(row.typeId, Number(row.brokers));
      }
    }
  } catch (error) {
    console.error("[plantao-priority] overview.failed", { tenantId, error: error instanceof Error ? error.name : "unknown_error" });
  }
  const types = typeRows.map((type) => {
    const config = settings.types[type.id];
    const result = resolvePlantaoTypeWeight({
      base: config?.base ?? 1,
      adaptiveWeight: adaptiveWeightOf(settings, type.id),
      cap: settings.cap,
      temperature: "hot",
      temps: settings.temps,
      shareCap: settings.shareCap,
      share: stats ? { typeOffers: stats.offersByType.get(type.id) ?? 0, totalOffers: stats.totalOffers, typeBrokers: brokersByType.get(type.id) ?? 0, totalBrokers } : null,
      expiry: stats?.expiryByType.get(type.id) ?? null,
    });
    return {
      typeId: type.id,
      name: type.name,
      base: config?.base ?? 1,
      adaptive: config?.adaptive ?? false,
      effectiveWeight: result.w,
      reason: result.reason,
      computed: settings.computed[type.id] ?? null,
    };
  });
  return { flagOn, settings, types };
}
