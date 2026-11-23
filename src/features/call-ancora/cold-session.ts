import "server-only";

import { COLD_PAGE_SIZE, coldReservations, fetchColdCandidates, isColdLeadStillFree } from "./cold-base";
import { getRecoverySettings } from "@/features/lead-recovery/settings";

/** Fila "Sem resposta" da recuperação (fase 4): ligada e com a conferência jurídica registrada. */
async function recoveryQueueOn(tenantId: string) {
  const recovery = await getRecoverySettings(tenantId).catch(() => null);
  return Boolean(recovery?.enabled && recovery.callQueue && recovery.legalReviewedAt);
}
import { CALL_ANCORA_LEAD_TAKEN_MESSAGE, recordColdOutcome } from "./cold-outcome";
import { countCallAncoraContactsToday, readCallAncoraSettings } from "./settings";
import { isWindowOpenFor } from "./settings-rules";
import { callAncoraSessionStore, type CallAncoraSnapshot } from "./session-store";

type Scope = { tenantId: string; brokerId: string };

/** Última busca no banco por sessão: no máximo uma a cada 5 s quando a fila está vazia. */
const lastFetchAt = new Map<string, number>();
const FETCH_THROTTLE_MS = 5_000;

/**
 * Mantém a fila de frios da sessão com atual + próximo reservados, respeita a janela de
 * ligações e solta as reservas que a sessão não usa mais. Leitura apenas no banco.
 */
export async function syncColdQueue(scope: Scope, now = new Date()) {
  const need = callAncoraSessionStore.coldQueueNeeds(scope);
  if (!need) return;
  const settings = await readCallAncoraSettings(scope.tenantId);
  const windowOpen = isWindowOpenFor(settings, now);
  callAncoraSessionStore.setCallingWindow(scope, windowOpen);
  coldReservations.releaseSession(scope.tenantId, need.sessionKey, need.heldIds);
  coldReservations.renew(scope.tenantId, need.sessionKey, need.heldIds);
  if (need.want <= 0 || !windowOpen) return;

  const last = lastFetchAt.get(need.sessionKey) ?? 0;
  if (now.getTime() - last < FETCH_THROTTLE_MS) return;
  lastFetchAt.set(need.sessionKey, now.getTime());

  // Limites da tela do diretor: contatos por corretor e créditos diários da empresa.
  const [mine, company] = await Promise.all([
    countCallAncoraContactsToday(scope.tenantId, scope.brokerId, now),
    settings.tenantDailyCredits > 0 ? countCallAncoraContactsToday(scope.tenantId, null, now) : Promise.resolve(0),
  ]);
  if (mine >= settings.dailyContactsPerBroker) {
    callAncoraSessionStore.setLimitNotice(scope, `Você chegou ao limite de ${settings.dailyContactsPerBroker} contatos de hoje.`);
    return;
  }
  if (settings.tenantDailyCredits > 0 && company >= settings.tenantDailyCredits) {
    callAncoraSessionStore.setLimitNotice(scope, "Os créditos de ligações da empresa acabaram por hoje.");
    return;
  }
  const allowed = Math.min(need.want, settings.dailyContactsPerBroker - mine, settings.tenantDailyCredits > 0 ? settings.tenantDailyCredits - company : need.want);

  const exclude = [...need.allIds, ...coldReservations.heldByOthers(scope.tenantId, need.sessionKey)];
  const candidates = await fetchColdCandidates({
    tenantId: scope.tenantId,
    excludeLeadIds: exclude,
    limit: COLD_PAGE_SIZE,
    now,
    rules: {
      maxAgeDays: settings.leadPeriodMaxAgeDays,
      minAgeDays: settings.leadPeriodMinAgeDays,
      leadsFromDate: settings.leadsFromDate,
      maxAttempts: settings.maxAttemptsPerLead,
      cooldownMs: settings.attemptCooldownHours * 60 * 60_000,
    },
    recoveryQueueFirst: await recoveryQueueOn(scope.tenantId),
  });
  const picked = [];
  for (const contact of candidates) {
    if (picked.length >= allowed) break;
    if (coldReservations.tryReserve(scope.tenantId, need.sessionKey, contact.id, contact.phone)) picked.push(contact);
  }
  if (picked.length) callAncoraSessionStore.appendColdContacts(scope, picked);
}

/** Última conferência no banco do frio atual (por lead): no máximo a cada 3 s. */
const verifiedAt = new Map<string, number>();
const VERIFY_EVERY_MS = 3_000;

/**
 * Antes de entregar o número ao celular: confere no banco se o frio atual ainda está livre
 * (a liberação das 9h ou a requalificação podem ter atribuído). Se não estiver, pula.
 */
export async function verifyColdCurrent(scope: Scope, now = new Date()) {
  for (let guard = 0; guard < 3; guard += 1) {
    const snapshot = callAncoraSessionStore.getForBroker(scope);
    const contact = snapshot?.current;
    if (!snapshot || !contact || contact.source !== "cold_base" || snapshot.callStatus !== "ready") return;
    const key = `${scope.tenantId}:${contact.id}`;
    if (now.getTime() - (verifiedAt.get(key) ?? 0) < VERIFY_EVERY_MS) return;
    const free = await isColdLeadStillFree(scope.tenantId, contact.id);
    verifiedAt.set(key, now.getTime());
    if (free) return;
    coldReservations.release(scope.tenantId, contact.id);
    callAncoraSessionStore.dropCurrentCold(scope, contact.id, CALL_ANCORA_LEAD_TAKEN_MESSAGE);
    await syncColdQueue(scope, now);
  }
}

/**
 * Depois de uma ação que pode ter classificado o contato (web ou "Não atendeu"/caixa postal
 * automáticos do app): grava o resultado no lead quando ele é da base de frios.
 */
export async function persistClassification(scope: Scope, before: CallAncoraSnapshot | null, after: CallAncoraSnapshot | null) {
  const contact = before?.current;
  const outcome = after?.lastOutcome;
  if (!contact || !outcome || contact.source !== "cold_base" || outcome.contactId !== contact.id) return;
  const previous = before?.lastOutcome?.contactId === contact.id ? before.lastOutcome : null;
  if (previous && previous.outcome === outcome.outcome && previous.auto === outcome.auto) return;
  try {
    const result = await recordColdOutcome({
      tenantId: scope.tenantId,
      brokerId: scope.brokerId,
      leadId: contact.id,
      outcome: outcome.outcome,
      auto: outcome.auto,
      correction: Boolean(previous),
      lastCall: after?.lastCall ?? null,
    });
    callAncoraSessionStore.setNotice(scope, result.conflict ?? (result.assigned ? "Lead enviado para a sua carteira." : null));
  } catch (error) {
    console.error("[call-ancora] falha ao gravar o resultado do frio", error instanceof Error ? error.message : "erro inesperado");
    callAncoraSessionStore.setNotice(scope, "Não consegui gravar o resultado no lead. Avise o suporte.");
  } finally {
    coldReservations.release(scope.tenantId, contact.id);
  }
}
