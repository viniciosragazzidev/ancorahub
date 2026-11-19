import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { CALL_ANCORA_DEMO_CONTACTS, type CallAncoraContact } from "./contacts";

export const CALL_ANCORA_PAIR_TTL_MS = 2 * 60_000;
export const CALL_ANCORA_SESSION_TTL_MS = 4 * 60 * 60_000;
export const CALL_ANCORA_NEXT_DELAY_MS = 3_000;

export type CallStatus = "ready" | "dialing" | "ringing" | "active" | "ended";
export type CallOutcome = "interested" | "not_interested";
export type PairingResult =
  | { ok: true; deviceToken: string; snapshot: CallAncoraSnapshot }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

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
  countdown: { remainingSeconds: number; paused: boolean } | null;
  updatedAt: string;
};

type Scope = { tenantId: string; brokerId: string };
type Session = Scope & {
  id: string;
  brokerFirstName: string;
  createdAt: number;
  lastActivityAt: number;
  pairedAt: number | null;
  deviceTokenHash: string | null;
  contactIndex: number;
  callStatus: CallStatus;
  callStartedAt: number | null;
  interests: CallAncoraContact[];
  completed: number;
  flagBypass: boolean;
  countdownEndsAt: number | null;
  countdownPaused: boolean;
  countdownRemainingMs: number | null;
};

type PairingTicket = { sessionKey: string; expiresAt: number; used: boolean };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const scopeKey = ({ tenantId, brokerId }: Scope) => `${tenantId}\u0000${brokerId}`;
const firstName = (value: string) => value.trim().split(/\s+/)[0] || "Corretor";

export class CallAncoraSessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly pairingTickets = new Map<string, PairingTicket>();
  private readonly deviceSessions = new Map<string, string>();

  constructor(private readonly now: () => number = Date.now) {}

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
      contactIndex: 0,
      callStatus: "ready",
      callStartedAt: null,
      interests: [],
      completed: 0,
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
    const key = this.deviceSessions.get(hashToken(deviceToken));
    if (!key) return null;
    const session = this.liveSession(key);
    if (!session || session.deviceTokenHash !== hashToken(deviceToken)) return null;
    session.lastActivityAt = this.now();
    this.advanceIfCountdownEnded(session);
    return this.snapshot(session);
  }

  deviceCanUseWhenFlagDisabled(deviceToken: string): boolean {
    this.prune();
    const key = this.deviceSessions.get(hashToken(deviceToken));
    const session = key ? this.liveSession(key) : null;
    return Boolean(session && session.deviceTokenHash === hashToken(deviceToken) && session.flagBypass);
  }

  updateCallStatus(deviceToken: string, nextStatus: CallStatus): CallAncoraSnapshot | null {
    const key = this.deviceSessions.get(hashToken(deviceToken));
    const session = key ? this.liveSession(key) : null;
    if (!session || session.deviceTokenHash !== hashToken(deviceToken) || session.pairedAt === null) return null;

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

  classify(scope: Scope, outcome: CallOutcome): CallAncoraSnapshot | null {
    const session = this.liveSession(scopeKey(scope));
    if (!session || session.pairedAt === null || session.callStatus !== "ended") return null;
    const contact = CALL_ANCORA_DEMO_CONTACTS[session.contactIndex];
    if (!contact) return null;
    if (outcome === "interested" && !session.interests.some((item) => item.id === contact.id)) session.interests.push(contact);
    session.completed += 1;
    session.countdownEndsAt = this.now() + CALL_ANCORA_NEXT_DELAY_MS;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
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
    session.countdownEndsAt = null;
    session.countdownPaused = false;
    session.countdownRemainingMs = null;
    session.contactIndex += 1;
    session.callStatus = session.contactIndex < CALL_ANCORA_DEMO_CONTACTS.length ? "ready" : "ended";
    session.callStartedAt = null;
    session.lastActivityAt = this.now();
  }

  private snapshot(session: Session): CallAncoraSnapshot {
    const now = this.now();
    const current = CALL_ANCORA_DEMO_CONTACTS[session.contactIndex] ?? null;
    const next = CALL_ANCORA_DEMO_CONTACTS[session.contactIndex + 1] ?? null;
    return {
      sessionId: session.id,
      brokerFirstName: session.brokerFirstName,
      status: session.pairedAt === null ? "waiting_pairing" : current ? "active" : "ended",
      pairedAt: session.pairedAt === null ? null : new Date(session.pairedAt).toISOString(),
      current,
      next,
      callStatus: session.callStatus,
      callStartedAt: session.callStartedAt === null ? null : new Date(session.callStartedAt).toISOString(),
      callElapsedSeconds: session.callStartedAt === null ? 0 : Math.max(0, Math.floor((now - session.callStartedAt) / 1000)),
      interests: session.interests.map((item) => ({ ...item })),
      completed: session.completed,
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
