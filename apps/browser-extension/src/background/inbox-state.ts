export const INBOX_STATE_KEY = "ancorahubInboxV2";
export const INBOX_POLL_ALARM = "ancorahub-inbox-poll";
export const INBOX_RETRY_ALARM = "ancorahub-inbox-retry";
export const INBOX_OFFER_WARNING_ALARM = "ancorahub-offer-minute";
export const INBOX_PORT_NAME = "ancorahub-inbox-watch";
export const INBOX_POLL_MS = 20_000;
export const INBOX_ALARM_MINUTES = 1;
export const OFFERS_REFRESH_MS = 60_000;
export const LAST_MINUTE_MS = 60_000;

export const INBOX_NOTIFICATION_TYPES = [
  "agent.lead_assigned",
  "lead_reassigned",
  "lead_client_returned",
  "task_overdue",
  "lead_feedback_overdue",
  "lead_feedback_reminder",
  "lead_warning_10m",
  "lead_lost",
  "lead_reopened",
] as const;

const allowedTypes = new Set<string>(INBOX_NOTIFICATION_TYPES);
const MAX_PROCESSED = 500;
const MAX_WARNED = 500;

export type InboxItem = { id: string; type: string; leadId: string | null; createdAt: string };
export type ActiveOffer = { id: string; expiresAt: string };
export type InboxState = {
  generation: string;
  cursor: string | null;
  processedIds: string[];
  activeOffers: ActiveOffer[];
  warnedOfferIds: string[];
  lastOffersSyncAt: number;
  retryAfterAt: number;
};

export function emptyInboxState(generation: string): InboxState {
  return { generation, cursor: null, processedIds: [], activeOffers: [], warnedOfferIds: [], lastOffersSyncAt: 0, retryAfterAt: 0 };
}

function stringArray(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length <= 300).slice(-limit) : [];
}

export function readInboxState(value: unknown, generation: string): InboxState {
  if (!value || typeof value !== "object") return emptyInboxState(generation);
  const saved = value as Partial<InboxState>;
  if (saved.generation !== generation) return emptyInboxState(generation);
  const activeOffers = Array.isArray(saved.activeOffers)
    ? saved.activeOffers.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const offer = item as Partial<ActiveOffer>;
      return typeof offer.id === "string" && typeof offer.expiresAt === "string" && Number.isFinite(Date.parse(offer.expiresAt))
        ? [{ id: offer.id, expiresAt: offer.expiresAt }] : [];
    }).slice(-200)
    : [];
  return {
    generation,
    cursor: typeof saved.cursor === "string" && saved.cursor.length <= 1024 ? saved.cursor : null,
    processedIds: stringArray(saved.processedIds, MAX_PROCESSED),
    activeOffers,
    warnedOfferIds: stringArray(saved.warnedOfferIds, MAX_WARNED),
    lastOffersSyncAt: typeof saved.lastOffersSyncAt === "number" ? saved.lastOffersSyncAt : 0,
    retryAfterAt: typeof saved.retryAfterAt === "number" ? saved.retryAfterAt : 0,
  };
}

const itemKey = (item: InboxItem) => `${item.type}:${item.id}`;

function inboxItem(value: unknown): InboxItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const validType = item.type === "lead_offer_pending" || (typeof item.type === "string" && allowedTypes.has(item.type));
  if (typeof item.id !== "string" || item.id.length > 256 || !validType
    || (item.leadId !== null && typeof item.leadId !== "string")
    || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) return null;
  return { id: item.id, type: item.type as string, leadId: item.leadId as string | null, createdAt: item.createdAt };
}

export function reconcileInboxResponse(state: InboxState, generation: string, body: unknown) {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.cursor !== "string" || payload.cursor.length > 1024 || !Array.isArray(payload.items)) return null;
  const items = payload.items.map(inboxItem).filter((item): item is InboxItem => item !== null);
  const sameGeneration = state.generation === generation;
  const base = sameGeneration ? state : emptyInboxState(generation);
  const processed = new Set(base.processedIds);
  const notices: InboxItem[] = [];
  const offerEvents: InboxItem[] = [];
  const nextProcessed = [...base.processedIds];
  for (const item of items) {
    if (item.type === "lead_offer_pending") {
      offerEvents.push(item);
      continue;
    }
    const key = itemKey(item);
    if (processed.has(key)) continue;
    processed.add(key);
    nextProcessed.push(key);
    if (sameGeneration) notices.push(item);
  }
  return {
    state: { ...base, cursor: payload.cursor, processedIds: nextProcessed.slice(-MAX_PROCESSED) },
    notices,
    offerEvents,
  };
}

export function reconcileActiveOffers(state: InboxState, offers: unknown, now: number) {
  if (!Array.isArray(offers)) return null;
  const nextOffers = offers.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const offer = value as Record<string, unknown>;
    if (typeof offer.id !== "string" || typeof offer.expiresAt !== "string") return [];
    const expiresAt = Date.parse(offer.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now ? [{ id: offer.id, expiresAt: new Date(expiresAt).toISOString() }] : [];
  }).slice(0, 200);
  const previousIds = new Set(state.activeOffers.map((offer) => offer.id));
  const currentIds = new Set(nextOffers.map((offer) => offer.id));
  const newOffers = nextOffers.filter((offer) => !previousIds.has(offer.id));
  const removedIds = state.activeOffers.filter((offer) => !currentIds.has(offer.id)).map((offer) => offer.id);
  const warned = new Set(state.warnedOfferIds);
  const lastMinute = nextOffers.filter((offer) => {
    const remaining = Date.parse(offer.expiresAt) - now;
    if (remaining <= 0 || remaining > LAST_MINUTE_MS || warned.has(offer.id)) return false;
    warned.add(offer.id);
    return true;
  });
  return {
    state: {
      ...state,
      activeOffers: nextOffers,
      warnedOfferIds: [...warned].slice(-MAX_WARNED),
      lastOffersSyncAt: now,
    },
    newOffers,
    removedIds,
    lastMinute,
  };
}

export function retryAfterTimestamp(retryAfterSeconds: number | undefined, now: number) {
  const seconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds! > 0 ? retryAfterSeconds! : 60;
  const maxSeconds = Math.max(1, Math.floor((8_640_000_000_000_000 - now) / 1000));
  return now + Math.min(seconds, maxSeconds) * 1000;
}

export function parseRetryAfter(value: string | null, now: number) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const at = Date.parse(value);
  return Number.isFinite(at) && at > now ? Math.ceil((at - now) / 1000) : undefined;
}

export function handleInboxNotModified(state: InboxState, now: number) {
  return { state, refreshOffers: now - state.lastOffersSyncAt >= OFFERS_REFRESH_MS };
}

export function inboxHeartbeatDue(lastPulseAt: number, now: number) {
  return now - lastPulseAt >= INBOX_POLL_MS - 1000;
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function notificationId(item: { id: string; type: string }) {
  return `ancora-${item.type}-${shortHash(item.id)}`;
}

export function offerIdFromNotification(state: InboxState, id: string) {
  const type = id.startsWith("ancora-offer_last_minute-") ? "offer_last_minute"
    : id.startsWith("ancora-lead_offer_pending-") ? "lead_offer_pending" : null;
  if (!type) return undefined;
  return state.activeOffers.find((offer) => notificationId({ id: offer.id, type }) === id)?.id;
}

export function notificationCopy(type: string) {
  if (type === "lead_offer_pending") return { title: "Nova oferta", message: "Abra o WhatsApp para conferir a oferta pendente." };
  if (type === "offer_last_minute") return { title: "Oferta perto do vencimento", message: "Uma oferta expira em menos de 1 minuto. Abra o WhatsApp para revisar." };
  const message: Record<string, string> = {
    "agent.lead_assigned": "Há um novo lead atribuído a você.",
    lead_reassigned: "Um lead foi atualizado no CRM.",
    lead_client_returned: "Um cliente respondeu.",
    task_overdue: "Você tem uma tarefa vencida.",
    lead_feedback_overdue: "Um retorno precisa da sua atenção.",
    lead_feedback_reminder: "Há um retorno para revisar.",
    lead_warning_10m: "Um prazo de atendimento está próximo.",
    lead_lost: "Um lead mudou de etapa.",
    lead_reopened: "Um lead foi reaberto.",
  };
  return { title: "Atualização do CRM", message: message[type] ?? "Há uma atualização para você no CRM." };
}

export function contentNoticeType(type: string): "offer" | "last-minute" | "update" {
  if (type === "lead_offer_pending") return "offer";
  if (type === "offer_last_minute") return "last-minute";
  return "update";
}
