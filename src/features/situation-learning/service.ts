import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { BUILTIN_SITUATIONS } from "@/features/attendance-situations/catalog";
import { loadTenantSituations } from "@/features/attendance-situations/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import {
  BROKER_ANSWER_WINDOW_HOURS,
  CLUSTER_BATCH_SIZE,
  DAILY_AI_CALL_LIMIT,
  LEARNING_RETENTION_DAYS,
  LONE_QUESTION_WINDOW_DAYS,
  NOTIFY_AT_OCCURRENCES,
  acceptSuggestedReply,
  buildClusteringPrompt,
  canAutoActivate,
  coveragePercent,
  learningKey,
  mergeSuggestionPhrases,
  parseClusteringResponse,
  scrubPersonalData,
  type ClusterGroup,
  type KnownSituation,
} from "./learning";

const LEARNING_PURPOSE = "situation_learning";
const DAY_MS = 24 * 60 * 60 * 1000;

export function autoActivateSettingKey(tenantId: string) {
  return `situation_learning_auto_activate_${tenantId}`;
}

/** The model chosen for the suggestions (Super-admin → IA), tried first on OpenRouter; empty = the router's default chain. */
export const LEARNING_MODEL_SETTING = "ai_learning_model";

/**
 * L1: one question asked in the middle of the qualification, with the
 * situation that covered it (null = none did) and the AI's answer. Personal
 * data is removed first. Never throws: learning never breaks the attendance.
 */
export async function recordLearningEvent(input: {
  tenantId: string;
  conversationId?: string | null;
  leadId?: string | null;
  question: string;
  matchedSituationKey?: string | null;
  aiAnswer?: string | null;
  channel?: string | null;
  communicationChannelId?: string | null;
}) {
  try {
    const question = scrubPersonalData(input.question);
    const normalized = learningKey(question);
    if (normalized.length < 3) return;
    await getDatabase().insert(schema.situationLearningEvents).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId ?? null,
      leadId: input.leadId ?? null,
      question,
      normalizedQuestion: normalized,
      matchedSituationKey: input.matchedSituationKey ?? null,
      aiAnswer: input.aiAnswer ? scrubPersonalData(input.aiAnswer) : null,
      channel: input.channel ?? null,
      communicationChannelId: input.communicationChannelId ?? null,
      // A covered question is never grouped: it already has a situation.
      clusteredAt: input.matchedSituationKey ? new Date() : null,
    });
  } catch (error) {
    console.warn("[situation-learning] record_failed", { tenantId: input.tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
  }
}

/** Situations the model can point a group of questions to: the system's and the tenant's own (enabled). */
async function knownSituations(tenantId: string): Promise<KnownSituation[]> {
  const tenant = await loadTenantSituations(tenantId);
  const builtins = BUILTIN_SITUATIONS.map((builtin) => {
    const row = tenant.find((item) => item.kind === "builtin" && item.key === builtin.key);
    return { key: builtin.key, title: builtin.label, phrases: [...builtin.examples, ...(row?.examplePhrases ?? [])] };
  });
  const customs = tenant.filter((item) => item.kind === "custom" && item.enabled).map((item) => ({ key: item.key, title: item.title ?? "Situação", phrases: item.examplePhrases }));
  return [...builtins, ...customs];
}

/** L4: the first message a person sent to the lead after an uncovered question becomes that question's broker answer. */
async function attachBrokerAnswers(now: Date) {
  const db = getDatabase();
  const events = await db.select({
    id: schema.situationLearningEvents.id,
    tenantId: schema.situationLearningEvents.tenantId,
    leadId: schema.situationLearningEvents.leadId,
    suggestionId: schema.situationLearningEvents.suggestionId,
    createdAt: schema.situationLearningEvents.createdAt,
  }).from(schema.situationLearningEvents).where(and(
    isNull(schema.situationLearningEvents.matchedSituationKey),
    isNull(schema.situationLearningEvents.brokerAnswer),
    isNotNull(schema.situationLearningEvents.leadId),
    gt(schema.situationLearningEvents.createdAt, new Date(now.getTime() - BROKER_ANSWER_WINDOW_HOURS * 60 * 60 * 1000)),
    lt(schema.situationLearningEvents.createdAt, new Date(now.getTime() - 5 * 60 * 1000)),
  )).limit(200);
  let attached = 0;
  for (const event of events) {
    const [reply] = await db.select({ body: schema.whatsappMessages.body, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(and(
        eq(schema.whatsappMessages.tenantId, event.tenantId),
        eq(schema.whatsappMessages.leadId, event.leadId!),
        inArray(schema.whatsappMessages.direction, ["outgoing", "outbound"]),
        sql`coalesce(${schema.whatsappMessages.senderRole}, 'user') not in ('assistant', 'system')`,
        gt(schema.whatsappMessages.sentAt, event.createdAt),
        lt(schema.whatsappMessages.sentAt, new Date(event.createdAt.getTime() + BROKER_ANSWER_WINDOW_HOURS * 60 * 60 * 1000)),
      ))
      .orderBy(asc(schema.whatsappMessages.sentAt))
      .limit(1);
    const answer = reply ? scrubPersonalData(reply.body) : "";
    if (!reply || answer.length < 10 || /^\[[^\]]+\]$/.test(answer)) continue;
    await db.update(schema.situationLearningEvents).set({ brokerAnswer: answer, brokerAnsweredAt: reply.sentAt }).where(eq(schema.situationLearningEvents.id, event.id));
    attached += 1;
    // Already grouped: the broker's answer enters the suggestion as a candidate reply.
    const safe = acceptSuggestedReply(answer);
    if (event.suggestionId && safe) {
      const [suggestion] = await db.select({ responses: schema.situationSuggestions.responses, status: schema.situationSuggestions.status })
        .from(schema.situationSuggestions).where(eq(schema.situationSuggestions.id, event.suggestionId)).limit(1);
      if (suggestion?.status === "pending" && !suggestion.responses.includes(safe)) {
        await db.update(schema.situationSuggestions).set({ responses: [safe, ...suggestion.responses].slice(0, 4), fromBroker: true, updatedAt: now }).where(eq(schema.situationSuggestions.id, event.suggestionId));
      }
    }
  }
  return attached;
}

type RouterData = { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } };

/** Asks the model to group the questions; null when there is no provider, the daily limit was reached or the call failed. */
async function clusterWithAi(tenantId: string, prompt: { system: string; user: string }) {
  const [{ createAiRouter }, { logAiUsage, countAiCallsToday }] = await Promise.all([
    import("@/features/ai-agent/model-router"),
    import("@/features/ai-agent/ai-usage-log"),
  ]);
  if (await countAiCallsToday(tenantId, LEARNING_PURPOSE) >= DAILY_AI_CALL_LIMIT) return { skipped: "daily_limit" as const };
  const router = await createAiRouter(tenantId);
  if (!router.providers.length) return { skipped: "no_provider" as const };
  const chosenModel = (await getSystemSetting(LEARNING_MODEL_SETTING).catch(() => null))?.trim();
  const startedAt = Date.now();
  try {
    const result = await router.call({
      messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
      temperature: 0.2,
      maxTokens: 2_500,
      responseFormat: { type: "json_object" },
      timeoutMs: 45_000,
      ...(chosenModel ? { prefer: { provider: "openrouter" as const, model: chosenModel } } : {}),
    });
    const data = await result.response.json() as RouterData;
    await logAiUsage({ tenantId, purpose: LEARNING_PURPOSE, model: result.model, startedAt, usage: data.usage, success: true });
    return { content: data.choices?.[0]?.message?.content ?? "", model: result.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { errText?: string } | null)?.errText ?? "unknown_error");
    await logAiUsage({ tenantId, purpose: LEARNING_PURPOSE, model: chosenModel || "router", startedAt, success: false, error: message });
    return { skipped: "ai_failed" as const };
  }
}

/** Recounts a suggestion from its questions (occurrences, first/last asked, examples, phrases). */
async function refreshSuggestion(suggestionId: string, now: Date) {
  const db = getDatabase();
  const events = await db.select({ question: schema.situationLearningEvents.question, createdAt: schema.situationLearningEvents.createdAt })
    .from(schema.situationLearningEvents)
    .where(eq(schema.situationLearningEvents.suggestionId, suggestionId))
    .orderBy(desc(schema.situationLearningEvents.createdAt));
  const [suggestion] = await db.select({ phrases: schema.situationSuggestions.phrases }).from(schema.situationSuggestions).where(eq(schema.situationSuggestions.id, suggestionId)).limit(1);
  if (!suggestion) return;
  const examples = mergeSuggestionPhrases([], events.map((event) => event.question), 8);
  await db.update(schema.situationSuggestions).set({
    occurrences: events.length,
    examples,
    phrases: mergeSuggestionPhrases(suggestion.phrases, examples),
    firstAskedAt: events.at(-1)?.createdAt ?? null,
    lastAskedAt: events[0]?.createdAt ?? null,
    updatedAt: now,
  }).where(eq(schema.situationSuggestions.id, suggestionId));
}

async function applyGroups(tenantId: string, groups: ClusterGroup[], model: string, now: Date) {
  const db = getDatabase();
  const touched = new Set<string>();
  const titleOf = new Map((await knownSituations(tenantId)).map((situation) => [situation.key, situation.title]));
  for (const group of groups) {
    let suggestionId: string | null = null;
    if (group.target === "suggestion") {
      suggestionId = group.suggestionId;
    } else if (group.target === "existing") {
      // Same doubt as an existing situation: one open "teach these phrases" suggestion per situation.
      const [open] = await db.select({ id: schema.situationSuggestions.id }).from(schema.situationSuggestions).where(and(
        eq(schema.situationSuggestions.tenantId, tenantId),
        eq(schema.situationSuggestions.status, "pending"),
        eq(schema.situationSuggestions.kind, "merge"),
        eq(schema.situationSuggestions.targetSituationKey, group.situationKey),
      )).limit(1);
      suggestionId = open?.id ?? randomUUID();
      if (!open) {
        await db.insert(schema.situationSuggestions).values({
          id: suggestionId, tenantId, kind: "merge", targetSituationKey: group.situationKey,
          title: titleOf.get(group.situationKey) ?? "Situação existente", modelUsed: model, createdAt: now, updatedAt: now,
        });
      }
    } else {
      suggestionId = randomUUID();
      await db.insert(schema.situationSuggestions).values({
        id: suggestionId, tenantId, kind: "new", title: group.title, phrases: group.phrases,
        responses: group.responses, action: group.action, modelUsed: model, createdAt: now, updatedAt: now,
      });
    }
    await db.update(schema.situationLearningEvents).set({ suggestionId }).where(and(
      eq(schema.situationLearningEvents.tenantId, tenantId),
      inArray(schema.situationLearningEvents.id, group.questionIds),
    ));
    touched.add(suggestionId);
  }
  for (const id of touched) await refreshSuggestion(id, now);
  return [...touched];
}

/** In-app notice (and push) to the tenant's directors when a suggestion is asked often. */
async function notifyDirectors(tenantId: string, suggestionIds: string[], now: Date) {
  if (!suggestionIds.length) return 0;
  const db = getDatabase();
  const due = await db.select({ id: schema.situationSuggestions.id, title: schema.situationSuggestions.title, occurrences: schema.situationSuggestions.occurrences, kind: schema.situationSuggestions.kind })
    .from(schema.situationSuggestions).where(and(
      inArray(schema.situationSuggestions.id, suggestionIds),
      eq(schema.situationSuggestions.status, "pending"),
      isNull(schema.situationSuggestions.notifiedAt),
      gte(schema.situationSuggestions.occurrences, NOTIFY_AT_OCCURRENCES),
    ));
  if (!due.length) return 0;
  const directors = await db.select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(
    eq(schema.tenantMemberships.tenantId, tenantId),
    eq(schema.tenantMemberships.role, "director"),
    eq(schema.tenantMemberships.status, "active"),
  ));
  const { sendNotificationToUser } = await import("@/features/notifications/send-push-helper");
  for (const suggestion of due) {
    const title = "Nova sugestão de situação";
    const message = suggestion.kind === "merge"
      ? `Clientes perguntaram ${suggestion.occurrences} vezes algo que parece "${suggestion.title}" com outras palavras. Revise as frases sugeridas.`
      : `Clientes perguntaram ${suggestion.occurrences} vezes: "${suggestion.title}". A IA sugeriu uma resposta para revisar.`;
    for (const director of directors) {
      await db.insert(schema.notifications).values({
        id: randomUUID(), tenantId, recipientUserId: director.userId, type: "situation_suggestion", title, message,
        idempotencyKey: `situation-suggestion:${suggestion.id}:${director.userId}`,
      }).onConflictDoNothing();
      void sendNotificationToUser(director.userId, { title, body: message, url: "/atendimento/situacoes?view=sugestoes", tag: `situation-suggestion-${suggestion.id}` }).catch(() => undefined);
    }
    await db.update(schema.situationSuggestions).set({ notifiedAt: now }).where(eq(schema.situationSuggestions.id, suggestion.id));
  }
  return due.length;
}

/** L5: activates the suggestions that meet every condition, when the tenant turned automatic activation on. */
async function autoActivate(tenantId: string, suggestionIds: string[], now: Date) {
  if (!suggestionIds.length) return 0;
  if ((await getSystemSetting(autoActivateSettingKey(tenantId)).catch(() => null)) !== "true") return 0;
  const db = getDatabase();
  const candidates = await db.select().from(schema.situationSuggestions).where(and(
    inArray(schema.situationSuggestions.id, suggestionIds),
    eq(schema.situationSuggestions.status, "pending"),
  ));
  let activated = 0;
  for (const suggestion of candidates) {
    if (!canAutoActivate({ enabled: true, kind: suggestion.kind, action: suggestion.action, occurrences: suggestion.occurrences, responses: suggestion.responses })) continue;
    const key = `custom:${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(schema.attendanceSituations).values({
        id: randomUUID(), tenantId, situationKey: key, kind: "custom", title: suggestion.title.slice(0, 80),
        examplePhrases: suggestion.phrases.slice(0, 30), response: acceptSuggestedReply(suggestion.responses[0])!,
        action: "continue", enabled: true, origin: "auto", createdAt: now, updatedAt: now,
      });
      await tx.update(schema.situationSuggestions).set({ status: "auto_activated", resolvedSituationKey: key, resolvedAt: now, updatedAt: now }).where(eq(schema.situationSuggestions.id, suggestion.id));
    });
    activated += 1;
  }
  return activated;
}

/** One tenant: groups its uncovered questions when there is enough new material. */
async function learnForTenant(tenantId: string, now: Date) {
  const db = getDatabase();
  const fresh = await db.select({ id: schema.situationLearningEvents.id, text: schema.situationLearningEvents.question, brokerAnswer: schema.situationLearningEvents.brokerAnswer, createdAt: schema.situationLearningEvents.createdAt })
    .from(schema.situationLearningEvents)
    .where(and(eq(schema.situationLearningEvents.tenantId, tenantId), isNull(schema.situationLearningEvents.matchedSituationKey), isNull(schema.situationLearningEvents.clusteredAt)))
    .orderBy(asc(schema.situationLearningEvents.createdAt))
    .limit(CLUSTER_BATCH_SIZE);
  if (!fresh.length) return { tenantId, skipped: "nothing_new" };
  // Worth a call: a few new questions, or one waiting for 6 hours.
  if (fresh.length < 3 && now.getTime() - fresh[0]!.createdAt.getTime() < 6 * 60 * 60 * 1000) return { tenantId, skipped: "waiting_for_more" };
  const lone = await db.select({ id: schema.situationLearningEvents.id, text: schema.situationLearningEvents.question, brokerAnswer: schema.situationLearningEvents.brokerAnswer })
    .from(schema.situationLearningEvents)
    .where(and(
      eq(schema.situationLearningEvents.tenantId, tenantId),
      isNull(schema.situationLearningEvents.matchedSituationKey),
      isNotNull(schema.situationLearningEvents.clusteredAt),
      isNull(schema.situationLearningEvents.suggestionId),
      gt(schema.situationLearningEvents.createdAt, new Date(now.getTime() - LONE_QUESTION_WINDOW_DAYS * DAY_MS)),
    ))
    .orderBy(desc(schema.situationLearningEvents.createdAt))
    .limit(CLUSTER_BATCH_SIZE);
  const situations = await knownSituations(tenantId);
  const pending = await db.select({ id: schema.situationSuggestions.id, title: schema.situationSuggestions.title, examples: schema.situationSuggestions.examples })
    .from(schema.situationSuggestions)
    .where(and(eq(schema.situationSuggestions.tenantId, tenantId), eq(schema.situationSuggestions.status, "pending"), eq(schema.situationSuggestions.kind, "new")))
    .orderBy(desc(schema.situationSuggestions.lastAskedAt))
    .limit(30);
  // Short ids keep the prompt small; they map back to the real ones.
  const questions = [...fresh, ...lone].map((event, index) => ({ id: `q${index + 1}`, realId: event.id, text: event.text, brokerAnswer: event.brokerAnswer }));
  const suggestions = pending.map((suggestion, index) => ({ id: `s${index + 1}`, realId: suggestion.id, title: suggestion.title, examples: suggestion.examples }));
  const prompt = buildClusteringPrompt({ questions, situations, suggestions });
  const ai = await clusterWithAi(tenantId, prompt);
  if ("skipped" in ai) return { tenantId, skipped: ai.skipped };
  const groups = parseClusteringResponse(ai.content, {
    questionIds: questions.map((question) => question.id),
    situationKeys: situations.map((situation) => situation.key),
    suggestionIds: suggestions.map((suggestion) => suggestion.id),
  }).map((group) => {
    const questionIds = group.questionIds.map((id) => questions.find((question) => question.id === id)!.realId);
    return group.target === "suggestion"
      ? { ...group, questionIds, suggestionId: suggestions.find((suggestion) => suggestion.id === group.suggestionId)!.realId }
      : { ...group, questionIds };
  });
  const touched = await applyGroups(tenantId, groups, ai.model, now);
  await db.update(schema.situationLearningEvents).set({ clusteredAt: now }).where(inArray(schema.situationLearningEvents.id, fresh.map((event) => event.id)));
  const notified = await notifyDirectors(tenantId, touched, now);
  const activated = await autoActivate(tenantId, touched, now);
  return { tenantId, questions: questions.length, groups: groups.length, suggestions: touched.length, notified, activated };
}

/**
 * The scheduled job (Coolify, every 30 minutes): deletes old questions,
 * attaches broker answers and groups the uncovered questions of each tenant.
 */
export async function runSituationLearningJob(now = new Date()) {
  const db = getDatabase();
  const purged = await db.delete(schema.situationLearningEvents)
    .where(lt(schema.situationLearningEvents.createdAt, new Date(now.getTime() - LEARNING_RETENTION_DAYS * DAY_MS)))
    .returning({ id: schema.situationLearningEvents.id });
  const brokerAnswers = await attachBrokerAnswers(now);
  const tenants = await db.selectDistinct({ tenantId: schema.situationLearningEvents.tenantId })
    .from(schema.situationLearningEvents)
    .where(and(isNull(schema.situationLearningEvents.matchedSituationKey), isNull(schema.situationLearningEvents.clusteredAt)));
  const results = [];
  for (const { tenantId } of tenants) {
    try {
      results.push(await learnForTenant(tenantId, now));
    } catch (error) {
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
      console.error("[situation-learning] tenant_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown", cause: cause?.slice(0, 200) ?? null });
      results.push({ tenantId, skipped: "error" });
    }
  }
  return { purged: purged.length, brokerAnswers, tenants: results };
}

export type SuggestionRow = {
  id: string;
  kind: "new" | "merge";
  targetSituationKey: string | null;
  targetTitle: string | null;
  title: string;
  phrases: string[];
  responses: string[];
  action: "continue" | "transfer";
  occurrences: number;
  examples: string[];
  lastAskedAt: string | null;
  fromBroker: boolean;
};

/** L3/L5 data for Atendimento → Situações: open suggestions, coverage and the automatic activation switch. */
export async function getLearningOverview(tenantId: string) {
  const db = getDatabase();
  const since = new Date(Date.now() - 30 * DAY_MS);
  try {
    const [rows, [counts], autoSetting, situations] = await Promise.all([
      db.select().from(schema.situationSuggestions)
        .where(and(eq(schema.situationSuggestions.tenantId, tenantId), eq(schema.situationSuggestions.status, "pending"), gt(schema.situationSuggestions.occurrences, 0)))
        .orderBy(desc(schema.situationSuggestions.occurrences), desc(schema.situationSuggestions.lastAskedAt)),
      db.select({
        total: sql<number>`count(*)::int`,
        covered: sql<number>`count(${schema.situationLearningEvents.matchedSituationKey})::int`,
      }).from(schema.situationLearningEvents).where(and(eq(schema.situationLearningEvents.tenantId, tenantId), gte(schema.situationLearningEvents.createdAt, since))),
      getSystemSetting(autoActivateSettingKey(tenantId)).catch(() => null),
      knownSituations(tenantId),
    ]);
    const titleOf = new Map(situations.map((situation) => [situation.key, situation.title]));
    const suggestions: SuggestionRow[] = rows.map((row) => ({
      id: row.id, kind: row.kind, targetSituationKey: row.targetSituationKey,
      targetTitle: row.targetSituationKey ? titleOf.get(row.targetSituationKey) ?? null : null,
      title: row.title, phrases: row.phrases, responses: row.responses, action: row.action,
      occurrences: row.occurrences, examples: row.examples, lastAskedAt: row.lastAskedAt?.toISOString() ?? null, fromBroker: row.fromBroker,
    }));
    return {
      suggestions,
      coverage: { percent: coveragePercent({ covered: counts?.covered ?? 0, total: counts?.total ?? 0 }), covered: counts?.covered ?? 0, total: counts?.total ?? 0 },
      autoActivate: autoSetting === "true",
    };
  } catch (error) {
    console.warn("[situation-learning] overview_failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return { suggestions: [] as SuggestionRow[], coverage: { percent: null, covered: 0, total: 0 }, autoActivate: false };
  }
}

/** Keys of the situations activated by the AI, for their badge and the undo. */
export async function autoActivatedKeys(tenantId: string) {
  try {
    const rows = await getDatabase().select({ key: schema.attendanceSituations.situationKey }).from(schema.attendanceSituations)
      .where(and(eq(schema.attendanceSituations.tenantId, tenantId), eq(schema.attendanceSituations.origin, "auto")));
    return rows.map((row) => row.key);
  } catch {
    return [];
  }
}

