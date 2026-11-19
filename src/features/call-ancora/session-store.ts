import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { CALL_ANCORA_DEMO_CONTACTS, type CallAncoraContact } from "./contacts";
import { maskPhone, type CallAncoraTestEntry } from "./test-list";

export const CALL_ANCORA_PAIR_TTL_MS = 2 * 60_000;
export const CALL_ANCORA_SESSION_TTL_MS = 4 * 60 * 60_000;
export const CALL_ANCORA_NEXT_DELAY_MS = 3_000;

export type CallStatus = "ready" | "dialing" | "ringing" | "active" | "ended";
export type CallOutcome = "interested" | "not_interested";
export type DeviceCallEvent = "dialing" | "active" | "disconnected";
export type DeviceControlAction = "pause" | "resume" | "skip";
export type PairingResult =
  | { ok: true; deviceToken: string; snapshot: CallAncoraSnapshot }
  | { ok: false; reason: "invalid" | "expired" | "reused" };
export type DeviceEventResult =
  | { ok: true; snapshot: CallAncoraSnapshot }
  | { ok: false; reason: "unauthorized" | "conflict" | "not_dialable" };

/** Como a última ligação real terminou (relatado pelo app Android). */
export type CallAncoraLastCall = {
  causeCode: number | null;
  causeLabel: string | null;
  reachedActive: boolean;
  talkSeconds: number;
  /** "no_answer" quando o servidor classificou sozinho (nunca chegou a ACTIVE). */
  autoOutcome: "no_answer" | null;
};

export type CallAncoraSnapshot = {
  sessionId: string;
  brokerFirstName: string;
  status: "waiting_pairing" | "active" | "ended";
  pairedAt: string | null;
  current: CallAncoraContact | null;
  next: CallAncoraContact | null;
  callStatus: CallStatus;
  callStartedAt: string | null;
  callElapsedSeconds: number;
  interests: CallAncoraContact[];
  completed: number;
  total: number;
  queueSource: "demo" | "test_list";
  autoDialEnabled: boolean;
  /** A ligação terminou e espera Com interesse / Sem interesse na web. */
  awaitingClassification: boolean;
  /** O celular pausou a sessão (não disca até retomar). */
  devicePaused: boolean;
  lastCall: CallAncoraLastCall | null;
  countdown: { remainingSeconds: number; paused: boolean } | null;
  updatedAt: string;
};

/** O que o app Android recebe. Número só aparece quando o contato é discável. */
export type CallAncoraDeviceState = {
  sessionId: string;
  brokerFirstName: string;
  status: CallAncoraSnapshot["status"];
  callStatus: CallStatus;
  autoDialEnabled: boolean;
  paused: boolean;
  awaitingClassification: boolean;
  countdown: CallAncoraSnapshot["countdown"];
  completed: number;
  total: number;
  current: { id: string; name: string; dialable: boolean; phone: string | null } | null;
  next: { id: string; name: string; phoneMasked: string | null } | null;
  lastCall: CallAncoraLastCall | null;
};

type Scope = { tenantId: string; brokerId: string };
type Session = Scope & {
  id: string;
  brokerFirstName: string;
  createdAt: number;
  lastActivityAt: number;
  pairedAt: number | null;
  deviceTokenHash: string | null;
  queue: CallAncoraContact[];
  queueSource: "demo" | "test_list";
  contactIndex: number;
  callStatus: CallStatus;
  callStartedAt: number | null;
  classified: boolean;
  lastCall: CallAncoraLastCall | null;
  interests: CallAncoraContact[];
  completed: number;
  autoDialEnabled: boolean;
  devicePaused: boolean;
  flagBypass: boolean;
  countdownEndsAt: number | null;
  countdownPaused: boolean;
  countdownRemainingMs: number | null;
};

type PairingTicket = { sessionKey: string; expiresAt: number; used: boolean };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const scopeKey = ({ tenantId, brokerId }: Scope) => `${tenantId}\u0000${brokerId}`;
const firstName = (value: string) => value.trim().split(/\s+/)[0] || "Corretor";

/** Converte o snapshot da web no estado do app: sem número de contato não discável. */
export function toDeviceState(snapshot: CallAncoraSnapshot): CallAncoraDeviceState {
  const current = snapshot.current;
  const next = snapshot.next;
  return {
    sessionId: snapshot.sessionId,
    brokerFirstName: snapshot.brokerFirstName,
    status: snapshot.status,
    callStatus: snapshot.callStatus,
    autoDialEnabled: snapshot.autoDialEnabled,
    paused: snapshot.devicePaused,
    awaitingClassification: snapshot.awaitingClassification,
    countdown: snapshot.countdown,
    completed: snapshot.completed,
    total: snapshot.total,
    current: current
      ? { id: current.id, name: current.name, dialable: current.dialable === true, phone: current.dialable === true ? current.phone : null }
      : null,
    next: next
      ? { id: next.id, name: next.name, phoneMasked: next.dialable === true ? maskPhone(next.phone) : null }
      : null,
    lastCall: snapshot.lastCall,
  };
}

export class CallAncoraSessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly pairingTickets = new Map<string, PairingTicket>();
  private readonly deviceSessions = new Map<string, string>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  create(scope: Scope, brokerName: string, options: { flagBypass?: boolean } = {}) {
    this.prune();
    const key = scopeKey(scope);
    this.removeSession(key);
    const now = this.now();
    const session: Session = {
      ...scope,
      id: randomBytes(12).toString("hex"),
      brokerFirstName: firstName(brokerName),
      createdAt: now,
      lastActivityAt: now,
      pairedAt: null,
      deviceTokenHash: null,
      queue: CALL_ANCORA_DEMO_CONTACTS.map((contact) => ({ ...contact })),
      queueSource: "demo",
      contactIndex: 0,
      callStatus: "ready",
      callStartedAt: null,
      classified: false,
      lastCall: null,
      interests: [],
      completed: 0,
      autoDialEnabled: false,
      devicePaused: false,
      flagBypass: options.flagBypass ?? false,
      countdownEndsAt: null,
      countdownPaused: false,
      countdownRemainingMs: null,
    };
    this.sessions.set(key, session);

    const pairingToken = randomBytes(32).toString("base64url");
    this.pairingTickets.set(hashToken(pairingToken), {
      sessionKey: key,
      expiresAt: now + CALL_ANCORA_PAIR_TTL_MS,
      used: false,
    });
    return { pairingToken, snapshot: this.snapshot(session) };
  }

  pair(pairingToken: string): PairingResult {
    this.prune();
    const ticket = this.pairingTickets.get(hashToken(pairingToken));
    if (!ticket) return { ok: false, reason: "invalid" };
    if (ticket.used) return { ok: false, reason: "reused" };
    if (this.now() >= ticket.expiresAt) return { ok: false, reason: "expired" };
    const session = this.liveSession(ticket.sessionKey);
    if (!session) return { ok: false, reason: "expired" };

    ticket.used = true;
    const deviceToken = randomBytes(32).toString("base64url");
    // Um celular por sessão: o token anterior, se houver, deixa de valer.
    if (session.deviceTokenHash) this.deviceSessions.delete(session.deviceTokenHash);
    session.deviceTokenHash = hashToken(deviceToken);
    session.pairedAt = this.now();
    session.lastActivityAt = this.now();
    this.deviceSessions.set(session.deviceTokenHash, ticket.sessionKey);
    return { ok: true, deviceToken, snapshot: this.snapshot(session) };
  }

  pairingCanUseWhenFlagDisabled(pairingToken: string): boolean {
    this.prune();
    const ticket = this.pairingTickets.get(hashToken(pairingToken));
    if (!ticket || ticket.used || this.now() >= ticket.expiresAt) return false;
    const session = this.liveSession(ticket.sessionKey);
    return Boolean(session?.flagBypass);
  }

  getForBroker(scope: Scope): CallAncoraSnapshot | null {
    this.prune();
    const session = this.liveSession(scopeKey(scope));
    if (!session) return null;
    session.lastActivityAt = this.now();
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  getForDevice(deviceToken: string): CallAncoraSnapshot | null {
    this.prune();
    const session = this.deviceSession(deviceToken);
    if (!session) return null;
    session.lastActivityAt = this.now();
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  deviceCanUseWhenFlagDisabled(deviceToken: string): boolean {
    this.prune();
    const session = this.deviceSession(deviceToken);
    return Boolean(session?.flagBypass);
  }

  /** Simulação da página web do celular (sem ligação real). */
  updateCallStatus(deviceToken: string, nextStatus: CallStatus): CallAncoraSnapshot | null {
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null) return null;

    const allowed: Record<CallStatus, CallStatus[]> = {
      ready: ["dialing"],
      dialing: ["ringing"],
      ringing: ["active"],
      active: ["ended"],
      ended: [],
    };
    if (!allowed[session.callStatus].includes(nextStatus)) return null;
    session.callStatus = nextStatus;
    const now = this.now();
    session.lastActivityAt = now;
    if (nextStatus === "active") session.callStartedAt = now;
    return this.snapshot(session);
  }

  /**
   * Evento de ligação REAL vindo do app Android. Só vale para o contato atual e só se ele
   * for discável (lista de teste). Repetir o mesmo evento não muda nada.
   */
  reportDeviceEvent(
    deviceToken: string,
    input: { contactId: string; event: DeviceCallEvent; causeCode?: number | null; causeLabel?: string | null },
  ): DeviceEventResult {
    this.prune();
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null) return { ok: false, reason: "unauthorized" };
    this.advanceIfCountdownEnded(session);
    const contact = session.queue[session.contactIndex];
    if (!contact || contact.id !== input.contactId) return { ok: false, reason: "conflict" };
    if (contact.dialable !== true) return { ok: false, reason: "not_dialable" };

    const now = this.now();
    const status = session.callStatus;
    if (input.event === "dialing") {
      if (status === "dialing") return { ok: true, snapshot: this.snapshot(session) };
      if (status !== "ready" || session.countdownEndsAt !== null || session.countdownPaused) return { ok: false, reason: "conflict" };
      session.callStatus = "dialing";
      session.callStartedAt = null;
      session.lastCall = null;
    } else if (input.event === "active") {
      if (status === "active") return { ok: true, snapshot: this.snapshot(session) };
      if (status !== "dialing" && status !== "ringing") return { ok: false, reason: "conflict" };
      session.callStatus = "active";
      session.callStartedAt = now;
    } else {
      if (status === "ended") return { ok: true, snapshot: this.snapshot(session) };
      if (status !== "dialing" && status !== "ringing" && status !== "active") return { ok: false, reason: "conflict" };
      const reachedActive = session.callStartedAt !== null;
      session.callStatus = "ended";
      session.lastCall = {
        causeCode: typeof input.causeCode === "number" ? input.causeCode : null,
        causeLabel: input.causeLabel?.slice(0, 80) ?? null,
        reachedActive,
        talkSeconds: reachedActive ? Math.max(0, Math.floor((now - (session.callStartedAt ?? now)) / 1000)) : 0,
        autoOutcome: reachedActive ? null : "no_answer",
      };
      // Nunca chegou a ACTIVE: "Não atendeu" sem esperar a web.
      if (!reachedActive) this.finishContact(session, null);
    }
    session.lastActivityAt = now;
    return { ok: true, snapshot: this.snapshot(session) };
  }

  /** Pausar, retomar ou pular, pedidos pelo celular. */
  deviceControl(deviceToken: string, action: DeviceControlAction): CallAncoraSnapshot | null {
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null) return null;
    if (action === "pause") {
      session.devicePaused = true;
      if (session.countdownEndsAt !== null) {
        session.countdownRemainingMs = Math.max(0, session.countdownEndsAt - this.now());
        session.countdownEndsAt = null;
        session.countdownPaused = true;
      }
    } else if (action === "resume") {
      session.devicePaused = false;
      if (session.countdownPaused) {
        session.countdownEndsAt = this.now() + (session.countdownRemainingMs ?? 0);
        session.countdownRemainingMs = null;
        session.countdownPaused = false;
      }
    } else {
      if (session.callStatus !== "ready" || !session.queue[session.contactIndex]) return null;
      this.advanceToNextContact(session);
    }
    session.lastActivityAt = this.now();
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  classify(scope: Scope, outcome: CallOutcome): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.pairedAt === null || session.callStatus !== "ended" || session.classified) return null;
    const contact = session.queue[session.contactIndex];
    if (!contact) return null;
    this.finishContact(session, outcome);
    session.lastActivityAt = this.now();
    return this.snapshot(session);
  }

  /**
   * Troca a fila da sessão pela "Lista de teste (ligação real)". Só para sessões de
   * admin/dev (flagBypass) e fora de ligação. Estes são os únicos contatos discáveis.
   */
  setTestList(scope: Scope, entries: CallAncoraTestEntry[]): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || !session.flagBypass || entries.length === 0) return null;
    if (session.callStatus === "dialing" || session.callStatus === "ringing" || session.callStatus === "active") return null;
    const batch = randomBytes(4).toString("hex");
    session.queue = entries.map((entry, index) => ({
      id: `teste-${batch}-${index + 1}`,
      name: entry.name,
      phone: entry.phone,
      source: "test_list",
      dialable: true,
    }));
    session.queueSource = "test_list";
    session.contactIndex = 0;
    session.callStatus = "ready";
    session.callStartedAt = null;
    session.classified = false;
    session.lastCall = null;
    session.interests = [];
    session.completed = 0;
    session.countdownEndsAt = null;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
    session.lastActivityAt = this.now();
    return this.snapshot(session);
  }

  setAutoDialEnabled(scope: Scope, enabled: boolean): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session) return null;
    session.autoDialEnabled = enabled;
    if (!enabled && (session.countdownEndsAt !== null || session.countdownPaused)) {
      this.advanceToNextContact(session);
    }
    session.lastActivityAt = this.now();
    return this.snapshot(session);
  }

  pauseCountdown(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.countdownEndsAt === null || session.countdownPaused) return null;
    session.countdownRemainingMs = Math.max(0, session.countdownEndsAt - this.now());
    session.countdownEndsAt = null;
    session.countdownPaused = true;
    session.lastActivityAt = this.now();
    return this.snapshot(session);
  }

  resumeCountdown(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || !session.countdownPaused) return null;
    session.countdownEndsAt = this.now() + (session.countdownRemainingMs ?? 0);
    session.countdownRemainingMs = null;
    session.countdownPaused = false;
    session.lastActivityAt = this.now();
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  private deviceSession(deviceToken: string): Session | null {
    if (!deviceToken) return null;
    const tokenHash = hashToken(deviceToken);
    const key = this.deviceSessions.get(tokenHash);
    const session = key ? this.liveSession(key) : null;
    if (!session || session.deviceTokenHash !== tokenHash) return null;
    return session;
  }

  /** Fecha o contato atual (classificado na web ou "Não atendeu" automático) e segue a fila. */
  private finishContact(session: Session, outcome: CallOutcome | null) {
    const contact = session.queue[session.contactIndex];
    if (contact && outcome === "interested" && !session.interests.some((item) => item.id === contact.id)) {
      session.interests.push(contact);
    }
    session.classified = true;
    session.completed += 1;
    if (session.autoDialEnabled) {
      session.countdownEndsAt = this.now() + CALL_ANCORA_NEXT_DELAY_MS;
      session.countdownPaused = false;
      session.countdownRemainingMs = null;
      if (session.devicePaused) {
        session.countdownRemainingMs = CALL_ANCORA_NEXT_DELAY_MS;
        session.countdownEndsAt = null;
        session.countdownPaused = true;
      }
    } else {
      this.advanceToNextContact(session);
    }
  }

  private liveSession(key: string): Session | null {
    const session = this.sessions.get(key);
    if (!session) return null;
    if (this.now() - session.lastActivityAt >= CALL_ANCORA_SESSION_TTL_MS) {
      this.removeSession(key);
      return null;
    }
    this.advanceIfCountdownEnded(session);
    return session;
  }

  private prune() {
    const now = this.now();
    for (const [key, session] of this.sessions) {
      if (now - session.lastActivityAt >= CALL_ANCORA_SESSION_TTL_MS) this.removeSession(key);
    }
    for (const [tokenHash, ticket] of this.pairingTickets) {
      if (now >= ticket.expiresAt + 10 * 60_000) this.pairingTickets.delete(tokenHash);
    }
  }

  private advanceIfCountdownEnded(session: Session) {
    if (session.countdownEndsAt === null || this.now() < session.countdownEndsAt) return;
    this.advanceToNextContact(session);
  }

  private advanceToNextContact(session: Session) {
    session.countdownEndsAt = null;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
    session.contactIndex += 1;
    session.callStatus = session.contactIndex < session.queue.length ? "ready" : "ended";
    session.callStartedAt = null;
    session.classified = false;
    session.lastActivityAt = this.now();
  }

  private snapshot(session: Session): CallAncoraSnapshot {
    const now = this.now();
    const current = session.queue[session.contactIndex] ?? null;
    const next = session.queue[session.contactIndex + 1] ?? null;
    return {
      sessionId: session.id,
      brokerFirstName: session.brokerFirstName,
      status: session.pairedAt === null ? "waiting_pairing" : current ? "active" : "ended",
      pairedAt: session.pairedAt === null ? null : new Date(session.pairedAt).toISOString(),
      current: current ? { ...current } : null,
      next: next ? { ...next } : null,
      callStatus: session.callStatus,
      callStartedAt: session.callStartedAt === null ? null : new Date(session.callStartedAt).toISOString(),
      callElapsedSeconds: session.callStartedAt === null ? 0 : Math.max(0, Math.floor((now - session.callStartedAt) / 1000)),
      interests: session.interests.map((item) => ({ ...item })),
      completed: session.completed,
      total: session.queue.length,
      queueSource: session.queueSource,
      autoDialEnabled: session.autoDialEnabled,
      awaitingClassification: Boolean(current) && session.callStatus === "ended" && !session.classified,
      devicePaused: session.devicePaused,
      lastCall: session.lastCall ? { ...session.lastCall } : null,
      countdown: session.countdownEndsAt !== null || session.countdownPaused
        ? { remainingSeconds: Math.ceil((session.countdownPaused ? session.countdownRemainingMs ?? 0 : (session.countdownEndsAt ?? now) - now) / 1000), paused: session.countdownPaused }
        : null,
      updatedAt: new Date(session.lastActivityAt).toISOString(),
    };
  }

  private removeSession(key: string) {
    const existing = this.sessions.get(key);
    if (existing?.deviceTokenHash) this.deviceSessions.delete(existing.deviceTokenHash);
    this.sessions.delete(key);
    for (const [tokenHash, ticket] of this.pairingTickets) {
      if (ticket.sessionKey === key) this.pairingTickets.delete(tokenHash);
    }
  }
}

const globalStore = globalThis as typeof globalThis & { __callAncoraStore?: CallAncoraSessionStore };
export const callAncoraSessionStore = globalStore.__callAncoraStore ??= new CallAncoraSessionStore();
