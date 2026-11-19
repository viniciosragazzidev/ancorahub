import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { CallAncoraContact } from "./contacts";
import { emptyColdBaseQueueSource, type CallAncoraQueueSource } from "./queue-source";
import { maskPhone, type CallAncoraTestEntry } from "./test-list";

export const CALL_ANCORA_PAIR_TTL_MS = 2 * 60_000;
export const CALL_ANCORA_SESSION_TTL_MS = 4 * 60 * 60_000;
export const CALL_ANCORA_NEXT_DELAY_MS = 3_000;
/** Sem notícia do app há mais que isto: "Celular sem sinal com o AncoraHub" e a fila não avança. */
export const CALL_ANCORA_PHONE_STALE_MS = 6_000;

export type CallStatus = "ready" | "dialing" | "ringing" | "active" | "ended";
export type CallOutcome = "interested" | "not_interested" | "no_answer" | "voicemail";
/** Resultados que o app (ou o servidor) pode decidir sozinho, por tempo. */
export type CallAutoOutcome = "no_answer" | "voicemail";
export type DeviceCallEvent = "dialing" | "active" | "disconnected";
export type DeviceControlAction = "pause" | "resume" | "skip" | "end";
/** Estado da sessão: o servidor é a fonte única. */
export type CallAncoraRunState = "running" | "paused" | "ended";
/** Pedido da web para o celular desligar a ligação atual. */
export type CallAncoraHangupRequest = "voicemail" | "hangup";
export type PairingResult =
  | { ok: true; deviceToken: string; snapshot: CallAncoraSnapshot }
  | { ok: false; reason: "invalid" | "expired" | "reused" };
export type DeviceEventResult =
  | { ok: true; snapshot: CallAncoraSnapshot }
  | { ok: false; reason: "unauthorized" | "conflict" | "not_dialable" | "paused" | "version_mismatch" };

/** Como a última ligação real terminou (relatado pelo app Android). */
export type CallAncoraLastCall = {
  causeCode: number | null;
  causeLabel: string | null;
  reachedActive: boolean;
  talkSeconds: number;
  /** Classificação automática: "no_answer" (não chegou a ACTIVE ou tempo de toque esgotado) ou "voicemail" (provável caixa postal). */
  autoOutcome: CallAutoOutcome | null;
  /** Regra que decidiu (ex.: ring_timeout, quick_active, late_active, manual, server_no_active). */
  rule: string | null;
  /** ms entre DISCANDO e ACTIVE no celular, para calibrar as regras. */
  dialToActiveMs: number | null;
};

export type CallAncoraPhoneStatus = {
  lastSeenAt: string;
  staleSeconds: number;
  /** false quando o app está sem falar com o servidor há mais de 6 s. */
  reachable: boolean;
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
  queueSource: "cold_base" | "test_list";
  autoDialEnabled: boolean;
  /** A ligação terminou e espera Com interesse / Sem interesse na web. */
  awaitingClassification: boolean;
  /** Estado da sessão (fonte única) e versão que só cresce. */
  runState: CallAncoraRunState;
  pausedBy: "web" | "phone" | null;
  version: number;
  /** Atalho: a sessão está pausada (pela web ou pelo celular). */
  devicePaused: boolean;
  /** Último contato do app Android; null quando o app nunca falou com esta sessão. */
  phone: CallAncoraPhoneStatus | null;
  lastCall: CallAncoraLastCall | null;
  /** Como o contato atual foi classificado (pode ser corrigido durante a contagem). */
  lastOutcome: { contactId: string; outcome: CallOutcome; auto: boolean } | null;
  /** A web pediu para o celular desligar a ligação atual. */
  hangupRequested: boolean;
  hangupRequest: CallAncoraHangupRequest | null;
  countdown: { remainingSeconds: number; paused: boolean } | null;
  updatedAt: string;
};

/** O que o app Android recebe. Número só aparece quando o contato é discável. */
export type CallAncoraDeviceState = {
  sessionId: string;
  brokerFirstName: string;
  status: CallAncoraSnapshot["status"];
  runState: CallAncoraRunState;
  pausedBy: "web" | "phone" | null;
  version: number;
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
  /** Pedido da web: "voicemail" (desligar como caixa postal) ou "hangup" (só desligar). */
  hangupRequest: CallAncoraHangupRequest | null;
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
  queueSource: "cold_base" | "test_list";
  contactIndex: number;
  callStatus: CallStatus;
  callStartedAt: number | null;
  classified: boolean;
  lastCall: CallAncoraLastCall | null;
  lastOutcome: CallAncoraSnapshot["lastOutcome"];
  hangupRequest: CallAncoraHangupRequest | null;
  interests: CallAncoraContact[];
  completed: number;
  autoDialEnabled: boolean;
  runState: CallAncoraRunState;
  pausedBy: "web" | "phone" | null;
  version: number;
  appLastSeenAt: number | null;
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
    runState: snapshot.runState,
    pausedBy: snapshot.pausedBy,
    version: snapshot.version,
    callStatus: snapshot.callStatus,
    autoDialEnabled: snapshot.autoDialEnabled,
    paused: snapshot.runState === "paused",
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
    hangupRequest: snapshot.hangupRequest,
  };
}

export class CallAncoraSessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly pairingTickets = new Map<string, PairingTicket>();
  private readonly deviceSessions = new Map<string, string>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    /** Fila inicial de cada sessão: a base de frios (vazia até ser ligada). */
    private readonly queueSource: CallAncoraQueueSource = emptyColdBaseQueueSource,
  ) {}

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
      queue: this.queueSource.initialQueue(scope).map((contact) => ({ ...contact })),
      queueSource: "cold_base",
      contactIndex: 0,
      callStatus: "ready",
      callStartedAt: null,
      classified: false,
      lastCall: null,
      lastOutcome: null,
      hangupRequest: null,
      interests: [],
      completed: 0,
      autoDialEnabled: false,
      runState: "running",
      pausedBy: null,
      version: 1,
      appLastSeenAt: null,
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
    if (!session || session.runState === "ended") return { ok: false, reason: "expired" };

    ticket.used = true;
    const deviceToken = randomBytes(32).toString("base64url");
    // Um celular por sessão: o token anterior, se houver, deixa de valer.
    if (session.deviceTokenHash) this.deviceSessions.delete(session.deviceTokenHash);
    session.deviceTokenHash = hashToken(deviceToken);
    session.pairedAt = this.now();
    this.bump(session);
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

  /** O app Android deu sinal de vida (cada leitura de estado, evento ou comando). */
  deviceHeartbeat(deviceToken: string): boolean {
    const session = this.deviceSession(deviceToken);
    if (!session) return false;
    session.appLastSeenAt = this.now();
    return true;
  }

  deviceCanUseWhenFlagDisabled(deviceToken: string): boolean {
    this.prune();
    const session = this.deviceSession(deviceToken);
    return Boolean(session?.flagBypass);
  }

  /** Estados informados pela página do celular no navegador. */
  updateCallStatus(deviceToken: string, nextStatus: CallStatus): CallAncoraSnapshot | null {
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null || session.runState === "ended") return null;

    const allowed: Record<CallStatus, CallStatus[]> = {
      ready: ["dialing"],
      dialing: ["ringing"],
      ringing: ["active"],
      active: ["ended"],
      ended: [],
    };
    if (!allowed[session.callStatus].includes(nextStatus)) return null;
    session.callStatus = nextStatus;
    if (nextStatus === "active") session.callStartedAt = this.now();
    this.bump(session);
    return this.snapshot(session);
  }

  /**
   * Evento de ligação REAL vindo do app Android. Só vale para o contato atual e só se ele
   * for discável (lista de teste). "dialing" exige sessão rodando e, se vier, a mesma versão
   * que o app conferiu antes de discar. Repetir o mesmo evento não muda nada.
   */
  reportDeviceEvent(
    deviceToken: string,
    input: {
      contactId: string;
      event: DeviceCallEvent;
      causeCode?: number | null;
      causeLabel?: string | null;
      /** Decisão do app por tempo (ou manual): desligou sozinho como não atendida ou caixa postal. */
      autoOutcome?: CallAutoOutcome | null;
      rule?: string | null;
      dialToActiveMs?: number | null;
      /** Versão do estado que o app conferiu antes de discar. */
      version?: number | null;
    },
  ): DeviceEventResult {
    this.prune();
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null) return { ok: false, reason: "unauthorized" };
    session.appLastSeenAt = this.now();
    this.advanceIfCountdownEnded(session);
    const contact = session.queue[session.contactIndex];
    if (!contact || contact.id !== input.contactId) return { ok: false, reason: "conflict" };
    if (contact.dialable !== true) return { ok: false, reason: "not_dialable" };

    const now = this.now();
    const status = session.callStatus;
    if (input.event === "dialing") {
      if (status === "dialing") return { ok: true, snapshot: this.snapshot(session) };
      if (session.runState !== "running") return { ok: false, reason: "paused" };
      if (typeof input.version === "number" && input.version !== session.version) return { ok: false, reason: "version_mismatch" };
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
      // Decisão do app (caixa postal / tempo de toque) ou, sem ACTIVE, "Não atendeu".
      const autoOutcome: CallAutoOutcome | null = input.autoOutcome ?? (reachedActive ? null : "no_answer");
      const rule = input.autoOutcome ? input.rule?.slice(0, 40) ?? "app" : reachedActive ? null : "server_no_active";
      session.callStatus = "ended";
      session.hangupRequest = null;
      session.lastCall = {
        causeCode: typeof input.causeCode === "number" ? input.causeCode : null,
        causeLabel: input.causeLabel?.slice(0, 80) ?? null,
        reachedActive,
        talkSeconds: reachedActive ? Math.max(0, Math.floor((now - (session.callStartedAt ?? now)) / 1000)) : 0,
        autoOutcome,
        rule,
        dialToActiveMs: typeof input.dialToActiveMs === "number" ? input.dialToActiveMs : null,
      };
      // Classificação automática sem esperar a web (pode ser corrigida durante a contagem).
      if (autoOutcome) this.finishContact(session, autoOutcome, true);
    }
    this.bump(session);
    return { ok: true, snapshot: this.snapshot(session) };
  }

  /** Pausar, retomar, pular ou encerrar, pedidos pelo celular. */
  deviceControl(deviceToken: string, action: DeviceControlAction): CallAncoraSnapshot | null {
    const session = this.deviceSession(deviceToken);
    if (!session || session.pairedAt === null || session.runState === "ended") return null;
    session.appLastSeenAt = this.now();
    if (action === "pause") {
      this.pauseRun(session, "phone");
    } else if (action === "resume") {
      this.resumeRun(session);
    } else if (action === "end") {
      this.endRun(session);
    } else {
      if (session.callStatus !== "ready" || !session.queue[session.contactIndex]) return null;
      this.advanceToNextContact(session);
    }
    this.bump(session);
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  /** Web: "Pausar". A ligação em andamento continua; nenhuma nova começa. */
  pauseRunForBroker(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.runState === "ended") return null;
    this.pauseRun(session, "web");
    this.bump(session);
    return this.snapshot(session);
  }

  resumeRunForBroker(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.runState === "ended") return null;
    this.resumeRun(session);
    this.bump(session);
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  /** Web: "Encerrar sessão". Encerra dos dois lados e derruba o token do celular. */
  endRunForBroker(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.runState === "ended") return null;
    this.endRun(session);
    this.bump(session);
    return this.snapshot(session);
  }

  classify(scope: Scope, outcome: CallOutcome): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.pairedAt === null || session.runState === "ended") return null;
    if (session.callStatus !== "ended" || session.classified) return null;
    const contact = session.queue[session.contactIndex];
    if (!contact) return null;
    this.finishContact(session, outcome, false);
    this.bump(session);
    return this.snapshot(session);
  }

  /**
   * Corrige a classificação do contato que acabou de terminar, enquanto a contagem para o
   * próximo ainda não acabou (ex.: o app marcou "Caixa postal" e era "Sem interesse").
   */
  reclassify(scope: Scope, outcome: CallOutcome): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || !session.classified || session.runState === "ended") return null;
    const inCountdown = session.countdownEndsAt !== null || session.countdownPaused;
    const contact = session.queue[session.contactIndex];
    if (!inCountdown || !contact || session.lastOutcome?.contactId !== contact.id) return null;
    session.interests = session.interests.filter((item) => item.id !== contact.id);
    if (outcome === "interested") session.interests.push(contact);
    session.lastOutcome = { contactId: contact.id, outcome, auto: false };
    this.bump(session);
    return this.snapshot(session);
  }

  /** Web: pede ao celular para desligar a ligação atual ("voicemail" também classifica). */
  requestHangup(scope: Scope, kind: CallAncoraHangupRequest): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.pairedAt === null || session.runState === "ended") return null;
    const contact = session.queue[session.contactIndex];
    if (!contact?.dialable) return null;
    if (session.callStatus !== "dialing" && session.callStatus !== "ringing" && session.callStatus !== "active") return null;
    session.hangupRequest = kind;
    this.bump(session);
    return this.snapshot(session);
  }

  requestVoicemailHangup(scope: Scope): CallAncoraSnapshot | null {
    return this.requestHangup(scope, "voicemail");
  }

  /**
   * Troca a fila da sessão pela "Lista de teste (ligação real)". Só para sessões de
   * admin/dev (flagBypass) e fora de ligação. Estes são os únicos contatos discáveis.
   */
  setTestList(scope: Scope, entries: CallAncoraTestEntry[]): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || !session.flagBypass || entries.length === 0 || session.runState === "ended") return null;
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
    session.lastOutcome = null;
    session.hangupRequest = null;
    session.interests = [];
    session.completed = 0;
    session.countdownEndsAt = null;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
    this.bump(session);
    return this.snapshot(session);
  }

  setAutoDialEnabled(scope: Scope, enabled: boolean): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session) return null;
    session.autoDialEnabled = enabled;
    if (!enabled && (session.countdownEndsAt !== null || session.countdownPaused)) {
      this.advanceToNextContact(session);
    }
    this.bump(session);
    return this.snapshot(session);
  }

  /** Pausa a contagem na web (também pausa a sessão: o celular não disca). */
  pauseCountdown(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.countdownEndsAt === null || session.countdownPaused) return null;
    this.pauseRun(session, "web");
    this.bump(session);
    return this.snapshot(session);
  }

  resumeCountdown(scope: Scope): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || !session.countdownPaused) return null;
    this.resumeRun(session);
    this.bump(session);
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  private pauseRun(session: Session, by: "web" | "phone") {
    session.runState = "paused";
    session.pausedBy = by;
    if (session.countdownEndsAt !== null) {
      session.countdownRemainingMs = Math.max(0, session.countdownEndsAt - this.now());
      session.countdownEndsAt = null;
      session.countdownPaused = true;
    }
  }

  private resumeRun(session: Session) {
    session.runState = "running";
    session.pausedBy = null;
    if (session.countdownPaused) {
      session.countdownEndsAt = this.now() + (session.countdownRemainingMs ?? 0);
      session.countdownRemainingMs = null;
      session.countdownPaused = false;
    }
  }

  private endRun(session: Session) {
    session.runState = "ended";
    session.pausedBy = null;
    session.countdownEndsAt = null;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
    session.hangupRequest = null;
    if (session.deviceTokenHash) this.deviceSessions.delete(session.deviceTokenHash);
    session.deviceTokenHash = null;
  }

  private bump(session: Session) {
    session.version += 1;
    session.lastActivityAt = this.now();
  }

  private appStale(session: Session) {
    return session.appLastSeenAt !== null && this.now() - session.appLastSeenAt > CALL_ANCORA_PHONE_STALE_MS;
  }

  private deviceSession(deviceToken: string): Session | null {
    if (!deviceToken) return null;
    const tokenHash = hashToken(deviceToken);
    const key = this.deviceSessions.get(tokenHash);
    const session = key ? this.liveSession(key) : null;
    if (!session || session.deviceTokenHash !== tokenHash) return null;
    return session;
  }

  /** Fecha o contato atual (classificado na web ou automático) e segue a fila. */
  private finishContact(session: Session, outcome: CallOutcome, auto: boolean) {
    const contact = session.queue[session.contactIndex];
    if (contact && outcome === "interested" && !session.interests.some((item) => item.id === contact.id)) {
      session.interests.push(contact);
    }
    session.lastOutcome = contact ? { contactId: contact.id, outcome, auto } : null;
    session.hangupRequest = null;
    session.classified = true;
    session.completed += 1;
    if (session.autoDialEnabled) {
      if (session.runState === "paused") {
        session.countdownRemainingMs = CALL_ANCORA_NEXT_DELAY_MS;
        session.countdownEndsAt = null;
        session.countdownPaused = true;
      } else {
        session.countdownEndsAt = this.now() + CALL_ANCORA_NEXT_DELAY_MS;
        session.countdownPaused = false;
        session.countdownRemainingMs = null;
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
    if (session.runState !== "running") return;
    // App sem dar sinal: a fila espera o celular voltar.
    if (this.appStale(session)) return;
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
    session.hangupRequest = null;
    this.bump(session);
  }

  private snapshot(session: Session): CallAncoraSnapshot {
    const now = this.now();
    const ended = session.runState === "ended";
    const current = ended ? null : session.queue[session.contactIndex] ?? null;
    const next = ended ? null : session.queue[session.contactIndex + 1] ?? null;
    const staleMs = session.appLastSeenAt === null ? null : Math.max(0, now - session.appLastSeenAt);
    return {
      sessionId: session.id,
      brokerFirstName: session.brokerFirstName,
      // Fila vazia continua "active" (esperando frios); "ended" quando encerrada ou quando a fila acabou.
      status: ended ? "ended" : session.pairedAt === null ? "waiting_pairing" : current || session.queue.length === 0 ? "active" : "ended",
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
      runState: session.runState,
      pausedBy: session.pausedBy,
      version: session.version,
      devicePaused: session.runState === "paused",
      phone: staleMs === null || session.appLastSeenAt === null
        ? null
        : { lastSeenAt: new Date(session.appLastSeenAt).toISOString(), staleSeconds: Math.floor(staleMs / 1000), reachable: staleMs <= CALL_ANCORA_PHONE_STALE_MS },
      lastCall: session.lastCall ? { ...session.lastCall } : null,
      lastOutcome: session.lastOutcome ? { ...session.lastOutcome } : null,
      hangupRequested: session.hangupRequest !== null,
      hangupRequest: session.hangupRequest,
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
