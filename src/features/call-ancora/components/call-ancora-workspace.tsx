"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Clock3, Headphones, Heart, Pause, Phone, PhoneCall, PhoneOff, Play, Radio, ScanLine, Smartphone, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { LiteActionButton, type LiteActionOutcome } from "@/components/lite/controls/action-button";
import { LiteMenu } from "@/components/lite/controls/menu";
import { motionTokens } from "@/components/arc/motion-tokens";
import { LiteAttention, LiteNumber } from "@/components/lite/motion";
import { reducedFade } from "@/components/lite/motion/shared";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import type { CallAncoraContact } from "../contacts";
import { CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE, isCallAncoraMobileSessionEndedStatus } from "../mobile-session";
import type { CallAncoraSnapshot, CallOutcome, CallStatus } from "../session-store";
import { Beat, CallAvatar, ConnectedMoment, NameReveal, EnterInOrder, ExpiryBar, PairingQr, QueueTrack, SlideSwap, SwapText } from "./call-ancora-motion";

const POLL_MS = 1_200;

/** Só para o laboratório (/dev/laboratorio): contatos do roteiro simulado, nunca discáveis. */
const LAB_CONTACTS: readonly CallAncoraContact[] = [
  { id: "lab-01", name: "Marina Duarte", phone: "(00) 0000-0001", source: "cold_base", dialable: false },
  { id: "lab-02", name: "Rafael Nogueira", phone: "(00) 0000-0002", source: "cold_base", dialable: false },
  { id: "lab-03", name: "Camila Freitas", phone: "(00) 0000-0003", source: "cold_base", dialable: false },
];
const PAIR_TTL_SECONDS = 120;
/** Quanto o momento "Celular conectado" fica na tela antes da sessão abrir. */
const CONNECTED_MOMENT_MS = motionTokens.duration.celebrate * 1_000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

function labSnapshot(firstName: string): CallAncoraSnapshot {
  return {
    sessionId: "laboratorio",
    brokerFirstName: firstName,
    status: "active",
    pairedAt: new Date().toISOString(),
    current: LAB_CONTACTS[0],
    next: LAB_CONTACTS[1],
    callStatus: "ready",
    callStartedAt: null,
    callElapsedSeconds: 0,
    interests: [],
    completed: 0,
    total: LAB_CONTACTS.length,
    queueSource: "cold_base",
    autoDialEnabled: true,
    callsStarted: false,
    awaitingClassification: false,
    devicePaused: false,
    lastCall: null,
    lastOutcome: null,
    hangupRequested: false,
    hangupRequest: null,
    runState: "running",
    pausedBy: null,
    version: 1,
    phone: null,
    callingWindowOpen: true,
    notice: null,
    countdown: null,
    updatedAt: new Date().toISOString(),
  };
}

function labPairingSnapshot(firstName: string): CallAncoraSnapshot {
  return { ...labSnapshot(firstName), status: "waiting_pairing", pairedAt: null };
}

function advanceLabSession(session: CallAncoraSnapshot): CallAncoraSnapshot {
  const index = session.completed;
  return {
    ...session,
    current: LAB_CONTACTS[index] ?? null,
    next: LAB_CONTACTS[index + 1] ?? null,
    status: index < LAB_CONTACTS.length ? "active" : "ended",
    callStatus: index < LAB_CONTACTS.length ? "ready" : "ended",
    callStartedAt: null,
    callElapsedSeconds: 0,
    awaitingClassification: false,
    countdown: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Laboratório: o 2º contato não atende, para mostrar que só ligação atendida pede feedback. */
const LAB_UNANSWERED_ID = "lab-02";

function statusLabel(status: CallStatus) {
  return ({ ready: "Pronta para ligar", dialing: "Discando", ringing: "Chamando", active: "Em ligação", ended: "Ligação encerrada" })[status];
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  interested: "Com interesse",
  not_interested: "Sem interesse",
  no_answer: "Não atendeu",
  voicemail: "Caixa postal",
  wrong_number: "Número errado",
};

/** Como a última ligação real terminou, em português, a partir do relato do app Android. */
function lastCallSummary(lastCall: CallAncoraSnapshot["lastCall"]) {
  if (!lastCall) return null;
  const cause = lastCall.causeLabel ? ` · ${lastCall.causeLabel}` : "";
  if (lastCall.autoOutcome === "voicemail") {
    return lastCall.rule === "manual" || lastCall.rule === "manual_web" ? "Caixa postal · desligada" : "Provável caixa postal · o celular desligou sozinho";
  }
  if (lastCall.autoOutcome === "no_answer") {
    return lastCall.rule === "ring_timeout" ? "Não atendeu · tempo de toque esgotado, o celular desligou" : `Não atendeu${cause}`;
  }
  return `Encerrada${cause} · ${clock(lastCall.talkSeconds)} em ligação`;
}

export function CallAncoraWorkspace({ brokerFirstName, canUseTestList = false, settingsSlot = null }: { brokerFirstName: string; canUseTestList?: boolean; settingsSlot?: ReactNode }) {
  const lab = useDevLab();
  const isLab = Boolean(lab);
  const fire = useFeedback();
  const reduceMotion = !useMotionAllowed();
  const [session, setSession] = useState<CallAncoraSnapshot | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [connectedMoment, setConnectedMoment] = useState(false);
  const previousStatus = useRef<CallAncoraSnapshot["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [testListText, setTestListText] = useState("");
  /** A primeira resposta do servidor chegou: até lá mostra o esqueleto, não a tela de início. */
  const [loaded, setLoaded] = useState(false);
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const pollInFlight = useRef(false);
  const autoStartedLabContact = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isLab) return;
    let cancelled = false;
    const load = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const response = await fetch("/api/call-ancora/session", { cache: "no-store" });
        // Durante um deploy o servidor devolve uma página HTML: mantém a sessão na tela e tenta de novo.
        const payload = await response.json().catch(() => null) as { session?: CallAncoraSnapshot | null; error?: string } | null;
        if (!payload) throw new Error("Reconectando ao servidor…");
        if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a sessão.");
        if (!cancelled) {
          setSession(payload.session ?? null);
          setError(null);
          setLoaded(true);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "A sessão não respondeu. Tente atualizar.");
      } finally {
        pollInFlight.current = false;
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isLab]);

  // Pareamento confirmado pelo servidor (o celular leu o QR): nível 1, uma vez por sessão.
  useEffect(() => {
    const status = session?.status ?? null;
    const paired = previousStatus.current === "waiting_pairing" && status === "active";
    previousStatus.current = status;
    if (!paired) return;
    fire("confirm");
    setConnectedMoment(true);
    const timer = window.setTimeout(() => setConnectedMoment(false), CONNECTED_MOMENT_MS);
    return () => window.clearTimeout(timer);
  }, [fire, session?.status]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setQrValue(null);
    setConnectedMoment(false);
    if (isLab) {
      setSession(labPairingSnapshot(brokerFirstName));
      setQrValue(new URL(`/call-ancora/celular?t=laboratorio-${Date.now()}`, window.location.origin).toString());
      setPairingExpiresAt(Date.now() + PAIR_TTL_SECONDS * 1_000);
      setNow(Date.now());
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/call-ancora/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const payload = await response.json() as { pairingToken?: string; pairExpiresAt?: number; snapshot?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.pairingToken || !payload.snapshot) throw new Error(payload.error || "Não foi possível iniciar a sessão.");
      const url = new URL("/call-ancora/celular", window.location.origin);
      url.searchParams.set("t", payload.pairingToken);
      setQrValue(url.toString());
      setSession(payload.snapshot);
      setPairingExpiresAt(payload.pairExpiresAt ?? Date.now() + PAIR_TTL_SECONDS * 1_000);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [brokerFirstName, isLab]);

  const classify = useCallback(async (outcome: CallOutcome): Promise<LiteActionOutcome> => {
    if (!session || session.callStatus !== "ended") return { ok: false, message: "A ligação ainda não terminou." };
    setBusy(true);
    setError(null);
    if (isLab) {
      setSession((current) => {
        if (!current) return current;
        const classified = {
          ...current,
          awaitingClassification: false,
          lastOutcome: current.current ? { contactId: current.current.id, outcome, auto: false } : current.lastOutcome,
          completed: current.completed + 1,
          interests: outcome === "interested" && current.current && !current.interests.some((item) => item.id === current.current?.id) ? [...current.interests, current.current] : current.interests,
          countdown: current.autoDialEnabled ? { remainingSeconds: 3, paused: false } : null,
        };
        return current.autoDialEnabled ? classified : advanceLabSession(classified);
      });
      setBusy(false);
      return { ok: true };
    }
    try {
      const response = await fetch("/api/call-ancora/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", outcome }) });
      const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "A classificação não foi registrada.");
      setSession(payload.session);
      return { ok: true };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "A classificação não foi registrada.";
      setError(`${message} A ligação continua registrada. Escolha o resultado de novo.`);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }, [isLab, session]);

  /** Ações simples da sessão (corrigir classificação, pedir para o celular desligar). */
  const sendAction = useCallback(async (body: Record<string, unknown>, failure: string) => {
    if (isLab) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/call-ancora/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || failure);
      setSession(payload.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : failure);
    } finally {
      setBusy(false);
    }
  }, [isLab]);

  /**
   * Começar, pausar e retomar as ligações pela tela (LiteActionButton): o sucesso só aparece
   * depois que o servidor confirma. No laboratório, a sessão simulada muda na hora.
   */
  const runAction = useCallback(async (action: "start-calls" | "run-pause" | "run-resume", failure: string): Promise<LiteActionOutcome> => {
    if (isLab) {
      await delay(350);
      setSession((current) => {
        if (!current) return current;
        const countdown = current.countdown ? { ...current.countdown, paused: action === "run-pause" } : null;
        if (action === "run-pause") return { ...current, runState: "paused", pausedBy: "web", devicePaused: true, countdown };
        return { ...current, runState: "running", pausedBy: null, devicePaused: false, countdown, callsStarted: true };
      });
      return { ok: true };
    }
    setError(null);
    try {
      const response = await fetch("/api/call-ancora/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json().catch(() => null) as { session?: CallAncoraSnapshot; error?: string } | null;
      if (!response.ok || !payload?.session) throw new Error(payload?.error || failure);
      setSession(payload.session);
      return { ok: true };
    } catch (reason) {
      return { ok: false, message: reason instanceof Error ? reason.message : failure };
    }
  }, [isLab]);

  const applyTestList = useCallback(async () => {
    if (!session || isLab) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/call-ancora/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-list", text: testListText }),
      });
      const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "Não consegui usar a lista de teste.");
      setSession(payload.session);
      setTestListText("");
      fire("confirm");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui usar a lista de teste.");
    } finally {
      setBusy(false);
    }
  }, [fire, isLab, session, testListText]);

  useEffect(() => {
    if (!isLab || !session?.countdown || session.countdown.paused || session.countdown.remainingSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setSession((current) => {
        if (!current?.countdown || current.countdown.paused) return current;
        if (current.countdown.remainingSeconds > 1) return { ...current, countdown: { ...current.countdown, remainingSeconds: current.countdown.remainingSeconds - 1 } };
        return advanceLabSession(current);
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [isLab, session?.countdown, session?.countdown?.paused, session?.countdown?.remainingSeconds, session?.completed]);

  const simulateLabCall = useCallback(async () => {
    if (!session || session.callStatus !== "ready" || simulating) return;
    setSimulating(true);
    const move = (callStatus: CallStatus) => setSession((current) => current ? { ...current, callStatus, callStartedAt: callStatus === "active" ? new Date().toISOString() : current.callStartedAt, callElapsedSeconds: 0, updatedAt: new Date().toISOString() } : current);
    move("dialing"); await delay(700);
    move("ringing");
    if (session.current?.id === LAB_UNANSWERED_ID) {
      // Não atendeu: o celular desliga sozinho, a fila segue sem pedir feedback.
      await delay(2_200);
      setSession((current) => current?.current ? {
        ...current,
        callStatus: "ended",
        completed: current.completed + 1,
        awaitingClassification: false,
        lastCall: { causeCode: null, causeLabel: null, reachedActive: false, talkSeconds: 0, autoOutcome: "no_answer", rule: "ring_timeout", dialToActiveMs: null, sim: null },
        lastOutcome: { contactId: current.current.id, outcome: "no_answer", auto: true },
        countdown: { remainingSeconds: 3, paused: current.runState === "paused" },
        updatedAt: new Date().toISOString(),
      } : current);
      setSimulating(false);
      return;
    }
    await delay(900);
    move("active"); await delay(4_000);
    setSession((current) => current ? {
      ...current,
      callStatus: "ended",
      awaitingClassification: true,
      lastCall: { causeCode: null, causeLabel: null, reachedActive: true, talkSeconds: 4, autoOutcome: null, rule: null, dialToActiveMs: 1_600, sim: null },
      updatedAt: new Date().toISOString(),
    } : current);
    setSimulating(false);
  }, [session, simulating]);

  useEffect(() => {
    if (!isLab || !session?.callsStarted || session.runState !== "running" || session.callStatus !== "ready" || session.countdown || !session.current || simulating) return;
    const contactKey = `${session.sessionId}:${session.current.id}`;
    if (autoStartedLabContact.current === contactKey) return;
    autoStartedLabContact.current = contactKey;
    void simulateLabCall();
  }, [isLab, session, simulating, simulateLabCall]);

  const simulateLabPairing = useCallback(() => {
    if (!isLab) return;
    setSession((current) => current?.status === "waiting_pairing" ? { ...labSnapshot(brokerFirstName), pairedAt: new Date().toISOString() } : current);
  }, [brokerFirstName, isLab]);

  const countdownExpired = Boolean(session?.countdown && !session.countdown.paused && session.countdown.remainingSeconds <= 0);
  const pairExpired = pairingExpiresAt !== null && now >= pairingExpiresAt;
  const pairSecondsLeft = Math.max(0, Math.ceil(((pairingExpiresAt ?? now) - now) / 1000));
  const totalContacts = session?.total ?? LAB_CONTACTS.length;
  const realQueue = session?.queueSource === "test_list";
  const lastCallText = lastCallSummary(session?.lastCall ?? null);
  const currentOutcome = session?.lastOutcome && session.current && session.lastOutcome.contactId === session.current.id ? session.lastOutcome : null;
  const realCallInProgress = Boolean(session?.current?.dialable) && (session?.callStatus === "dialing" || session?.callStatus === "ringing" || session?.callStatus === "active");
  const calling = session?.callStatus === "dialing" || session?.callStatus === "ringing";

  const phoneReachable = !session?.phone || session.phone.reachable;
  const paused = session?.runState === "paused";
  const interestCount = session?.interests.length ?? 0;
  const callsStarted = session?.callsStarted === true;
  const canStart = Boolean(session && session.status === "active" && !callsStarted && session.current && (session.current.dialable || isLab));
  const sessionMenu = session && session.status === "active" && !isLab ? [
    ...(canUseTestList ? [{ id: "test-list", label: testToolsOpen ? "Fechar lista de teste" : "Lista de teste (ligação real)", onSelect: () => setTestToolsOpen((open) => !open) }] : []),
    { id: "end", label: "Encerrar sessão", tone: "danger" as const, onSelect: () => void sendAction({ action: "end" }, "Não consegui encerrar a sessão.") },
  ] : null;

  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <div className="w-full">
        {settingsSlot}
        {error ? <p className="mx-auto mb-5 max-w-2xl rounded-(--radius-panel) border border-(--danger)/25 bg-(--danger)/5 px-4 py-3 text-sm text-(--foreground)" role="alert">{error}</p> : null}

        {!session && !loaded && !isLab ? (
          <section className="mx-auto max-w-2xl rounded-(--radius-surface) border border-(--border) bg-(--surface) p-6 md:p-8" aria-label="Carregando a sessão do Call Âncora">
            <Skeleton label="Carregando a sessão" lines={3} avatar />
          </section>
        ) : !session ? (
          <section className="mx-auto flex min-h-[min(58vh,560px)] max-w-3xl flex-col items-center justify-center rounded-(--radius-surface) border border-(--border) bg-(--surface) px-6 py-12 text-center md:px-12">
            <Beat className="mb-7">
              <LiteAttention pulseKey="intro" className="rounded-full">
                <span className="grid size-20 place-items-center rounded-full bg-(--accent-subtle) text-(--accent-strong)"><Headphones className="size-9" aria-hidden="true" /></span>
              </LiteAttention>
            </Beat>
            <Beat at="text">
              <h2 className="text-3xl font-medium tracking-tight text-(--foreground) md:text-4xl">Uma conversa de cada vez.</h2>
            </Beat>
            <Beat at="number">
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-(--text-secondary)">Conecte o celular do Call Âncora. Aqui você vê com quem está falando, o próximo da fila e quem teve interesse.</p>
            </Beat>
            <Beat at="after" className="flex flex-col items-center">
              <Button className="mt-8 min-h-14 min-w-52 rounded-full px-10 text-base" size="lg" loading={busy} onClick={() => void start()}>
                <PhoneCall className="size-5" aria-hidden="true" /> Iniciar
              </Button>
            </Beat>
          </section>
        ) : session.status === "waiting_pairing" ? (
          <section className="mx-auto grid max-w-4xl items-center gap-8 rounded-(--radius-surface) border border-(--border) bg-(--surface) p-6 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <Beat><span className="inline-flex size-12 items-center justify-center rounded-full bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-6" aria-hidden="true" /></span></Beat>
              <Beat at="text">
                <h2 className="mt-5 text-2xl font-medium text-(--foreground)">Conecte o celular</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-(--text-secondary)">Abra o app Call Âncora no celular e leia este QR. Ele vale por dois minutos e só pode ser usado uma vez.</p>
              </Beat>
              <Beat at="number" className="mt-6 max-w-xs">
                <p className="mb-2 flex items-center gap-2 text-sm text-(--text-secondary)" aria-live="off"><Clock3 className="size-4" aria-hidden="true" /> <span className="tabular-nums">{pairExpired ? "QR vencido" : `Expira em ${pairSecondsLeft} s`}</span></p>
                <ExpiryBar ratio={pairExpired ? 0 : pairSecondsLeft / PAIR_TTL_SECONDS} />
              </Beat>
              <Beat at="after" className="mt-6 flex flex-wrap gap-3">
                <Button className="min-h-11 rounded-full" variant={pairExpired ? "primary" : "secondary"} onClick={() => void start()} loading={busy}>{pairExpired ? "Gerar outro QR" : "Gerar novo QR"}</Button>
                {isLab ? <Button className="min-h-11 rounded-full" variant="secondary" disabled={pairExpired} onClick={simulateLabPairing}><ScanLine className="size-4" aria-hidden="true" /> Simular leitura do QR</Button> : null}
              </Beat>
            </div>
            <div className="relative">
              {qrValue ? <PairingQr value={qrValue} expired={pairExpired} label="QR code de pareamento do Call Âncora" /> : <div className="grid size-64 place-items-center text-sm text-(--text-muted)">Preparando QR…</div>}
              {pairExpired ? <span className="absolute inset-0 grid place-items-center"><span className="rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-medium text-(--foreground)">QR vencido</span></span> : null}
            </div>
          </section>
        ) : connectedMoment ? (
          <ConnectedMoment brokerFirstName={session.brokerFirstName} />
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            {/* Barra da sessão: o celular, a posição na fila e as ações raras no menu. */}
            <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
              {session.status === "active" ? (
                <motion.span
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium ${phoneReachable ? "border-(--success)/20 bg-(--success)/10 text-(--success)" : "border-(--warning)/25 bg-(--warning)/10 text-(--warning)"}`}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: motionTokens.scale.popIn, y: -motionTokens.distance.xs }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={reduceMotion ? reducedFade : motionTokens.spring.snappy}
                >
                  <Radio className="size-4" aria-hidden="true" /> <span>{phoneReachable ? "Celular conectado" : `Celular sem sinal há ${session.phone?.staleSeconds ?? 0} s`}</span>
                </motion.span>
              ) : <span />}
              <div className="flex items-center gap-3">
                {session.current && session.status !== "ended" ? <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-(--text-muted)">Contato <LiteNumber value={Math.max(1, Math.min(session.countdown ? session.completed : session.completed + 1, totalContacts))} /> de {totalContacts}</span> : null}
                {callsStarted && session.status === "active" ? (
                  <LiteActionButton
                    key={paused ? "resume" : "pause"}
                    size="sm"
                    tone="secondary"
                    icon={paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                    busyLabel={paused ? "Retomando…" : "Pausando…"}
                    doneLabel={paused ? "Retomada" : "Pausada"}
                    keeps={paused ? "A sessão continua pausada." : "As ligações continuam no automático."}
                    onAction={() => runAction(paused ? "run-resume" : "run-pause", paused ? "Não consegui retomar as ligações." : "Não consegui pausar as ligações.")}
                  >
                    {paused ? "Retomar" : "Pausar"}
                  </LiteActionButton>
                ) : null}
                {sessionMenu ? <LiteMenu label="Mais ações da sessão" items={sessionMenu} /> : null}
              </div>
            </div>

            {paused ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-(--radius-panel) border border-(--border) bg-(--surface-muted) px-4 py-3" role="status">
                <p className="flex items-center gap-2 text-sm text-(--foreground)"><Pause className="size-4 text-(--text-muted)" aria-hidden="true" />{session.pausedBy === "phone" ? "O celular pausou a sessão." : "Você pausou a sessão."} A ligação em andamento continua; nenhuma nova começa até retomar.</p>
              </div>
            ) : null}

            {canUseTestList && !isLab && testToolsOpen ? (
              <section className="mb-4 rounded-(--radius-panel) border border-(--border) bg-(--surface) p-4 md:p-5" aria-labelledby="call-ancora-test-list">
                <h2 id="call-ancora-test-list" className="text-sm font-medium text-(--foreground)">Lista de teste (ligação real)</h2>
                <p className="mt-1 text-xs leading-5 text-(--text-secondary)">Só para administradores. O app Android disca estes números de verdade. Um por linha, nome opcional (ex.: <span className="font-mono">Ana; (21) 99999-0000</span>). Até 50. Substitui a fila desta sessão.</p>
                <textarea
                  className="mt-3 min-h-28 w-full rounded-(--radius-panel) border border-(--border-strong) bg-(--surface) px-3 py-2 font-mono text-base text-(--foreground) md:text-sm"
                  value={testListText}
                  onChange={(event) => setTestListText(event.target.value)}
                  placeholder={"(21) 99999-0000\nBruno; (21) 98888-7777"}
                  aria-label="Números da lista de teste"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="secondary" className="min-h-10 rounded-full" disabled={busy || !testListText.trim()} loading={busy} onClick={() => void applyTestList()}>Usar como fila</Button>
                  <span className="text-xs text-(--text-muted)">{realQueue ? `Fila atual: lista de teste, ${totalContacts} números` : totalContacts === 0 ? "Fila atual: vazia" : "Fila atual: base de frios"}</span>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4">
              <EnterInOrder index={1}>
                <article className="relative overflow-hidden rounded-(--radius-surface) border border-(--border) bg-(--surface) p-6 shadow-(--shadow-resting) md:p-8">
                  {session.notice ? <p className="mb-4 rounded-(--radius-panel) bg-(--surface-muted) px-4 py-3 text-sm text-(--foreground)" role="status">{session.notice}</p> : null}
                  {!session.callingWindowOpen && session.queueSource === "cold_base" && session.status !== "ended" && !session.current?.dialable ? (
                    <EmptyState icon={<Clock3 aria-hidden="true" />} title="Fora do horário de ligações" description="As ligações para os frios seguem o horário que o diretor define nas configurações do Call Âncora. A fila volta sozinha quando o horário abrir." />
                  ) : (session.total === 0 || (session.queueSource === "cold_base" && !session.current)) && session.status !== "ended" ? (
                    <EmptyState icon={<Users aria-hidden="true" />} title="Sua fila está vazia" description="Ainda não há frios para você. Quando o diretor ligar a base de frios, os contatos aparecem aqui." />
                  ) : session.current && session.status !== "ended" ? <>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-(--surface-muted) px-3 text-xs font-medium text-(--text-secondary)">
                        <span className={`size-2 rounded-full transition-colors duration-300 ${session.callStatus === "active" ? "bg-(--success)" : calling ? "bg-(--chat-action)" : "bg-(--text-muted)"}`} aria-hidden="true" />
                        <SwapText value={statusLabel(session.callStatus)} />
                      </span>
                    </div>
                    <div className="mt-4"><QueueTrack total={totalContacts} done={session.completed} /></div>
                    <SlideSwap swapKey={session.current.id}>
                      <div className="mx-auto flex max-w-lg flex-col items-center pt-8 text-center md:pt-10">
                        <CallAvatar name={session.current.name} status={session.callStatus} />
                        <h2 className="mt-5 max-w-full text-3xl font-medium tracking-tight text-balance break-words text-(--foreground)"><NameReveal text={session.current.name} delay={motionTokens.beat.text} /></h2>
                        <p className="mt-2 text-sm tabular-nums text-(--text-secondary)">{session.current.phone} <span className="text-(--text-muted)">{session.current.source === "test_list" ? "· lista de teste" : "· número completo só no celular"}</span></p>
                      </div>
                    </SlideSwap>
                    <SlideSwap swapKey={`${session.current.id}-${session.callStatus}-${session.countdown ? "countdown" : "idle"}`} axis="y" className="mx-auto flex max-w-lg flex-col items-center pb-2 text-center">
                      {session.callStatus === "active" ? <p className="mt-6 flex items-center gap-2 text-2xl font-medium tabular-nums text-(--foreground)" aria-live="off"><Clock3 className="size-5 text-(--success)" aria-hidden="true" /> {clock(Math.floor(Math.max(0, now - Date.parse(session.callStartedAt ?? new Date().toISOString())) / 1000))}</p> : null}
                      {calling ? <p className="mt-6 text-sm text-(--text-secondary)">{session.callStatus === "dialing" ? "Discando pelo celular…" : "Chamando. Esperando atender…"}</p> : null}
                      {realCallInProgress && !isLab ? (
                        <div className="mt-5 flex items-center gap-2">
                          <Button size="md" variant="secondary" className="min-h-11 min-w-56 rounded-full" disabled={busy || session.hangupRequested} onClick={() => void sendAction({ action: "hangup-call" }, "Não consegui pedir para o celular desligar.")}>
                            <PhoneOff className="size-4" aria-hidden="true" /> {session.hangupRequested ? "Desligando pelo celular…" : "Desligar ligação"}
                          </Button>
                          <LiteMenu label="Mais ações da ligação" items={[{ id: "voicemail", label: "Caiu na caixa postal: desligar", disabled: busy || session.hangupRequested, onSelect: () => void sendAction({ action: "hangup-voicemail" }, "Não consegui pedir para o celular desligar.") }]} />
                        </div>
                      ) : null}
                      {session.callStatus === "ready" && !session.countdown && canStart ? (
                        <div className="mt-6 flex flex-col items-center gap-2">
                          <LiteActionButton
                            icon={<PhoneCall className="size-4" aria-hidden="true" />}
                            busyLabel="Começando…"
                            doneLabel="Ligações começaram"
                            keeps="O celular continua conectado e esperando."
                            onAction={() => runAction("start-calls", "Não consegui começar as ligações.")}
                          >
                            Começar ligações
                          </LiteActionButton>
                          <p className="max-w-sm text-xs leading-5 text-(--text-muted)">O celular disca sozinho e segue a fila no automático. Você pode pausar quando quiser.</p>
                        </div>
                      ) : session.callStatus === "ready" && !session.countdown ? <p className="mt-5 max-w-sm text-sm leading-6 text-(--text-secondary)">{paused ? "Ligações pausadas. Toque em Retomar para continuar." : callsStarted ? "Ligando pelo celular…" : "Pronto para ligar."}</p> : null}
                      {lastCallText && (session.callStatus === "ended" || session.countdown) ? <p className="mt-5 text-sm font-medium text-(--foreground)" role="status">{lastCallText}</p> : null}
                      {session.awaitingClassification && !session.countdown ? <p className="mt-5 text-base font-medium text-(--foreground)">Como foi a conversa?</p> : null}
                      {session.countdown && currentOutcome ? (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-(--text-secondary)">
                          <span>Classificada como <span className="font-medium text-(--foreground)">{OUTCOME_LABEL[currentOutcome.outcome]}</span>{currentOutcome.auto ? " (automático, estimativa)" : ""}.</span>
                          <LiteMenu label="Corrigir classificação" items={(Object.keys(OUTCOME_LABEL) as CallOutcome[]).filter((outcome) => outcome !== currentOutcome.outcome).map((outcome) => ({ id: outcome, label: OUTCOME_LABEL[outcome], disabled: busy, onSelect: () => void sendAction({ action: "reclassify", outcome }, "Não consegui corrigir a classificação.") }))} />
                        </div>
                      ) : null}
                      {session.countdown ? (
                        <div className="mt-5 flex min-h-20 w-full max-w-md flex-col items-center justify-center rounded-(--radius-panel) bg-(--surface-muted) px-4 py-3" role="status">
                          <span className="text-xs text-(--text-secondary)">{countdownExpired ? "Ligando para o próximo" : session.countdown.paused ? "Contagem pausada" : "Próxima ligação em"}</span>
                          {!countdownExpired && !session.countdown.paused ? <span className="mt-1 inline-flex items-baseline gap-1 text-3xl font-medium tabular-nums text-(--foreground)"><LiteNumber value={session.countdown.remainingSeconds} /><span className="text-base text-(--text-secondary)">s</span></span> : null}
                        </div>
                      ) : null}
                      {session.awaitingClassification && !session.countdown ? (
                        <div className="mt-5 flex w-full max-w-md flex-col items-stretch gap-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <LiteActionButton busyLabel="Registrando…" doneLabel="Interesse registrado" keeps="A ligação continua registrada." disabled={busy} icon={<Heart className="size-4" aria-hidden="true" />} onAction={() => classify("interested")}>Com interesse</LiteActionButton>
                            <Button variant="secondary" size="lg" className="min-h-12 rounded-full" disabled={busy} onClick={() => void classify("not_interested")}><X className="size-4" aria-hidden="true" /> Sem interesse</Button>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-0">
                            <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-3" disabled={busy} onClick={() => void classify("voicemail")}>Caixa postal</Button>
                            <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-3" disabled={busy} onClick={() => void classify("no_answer")}>Não atendeu</Button>
                            <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-3" disabled={busy} onClick={() => void classify("wrong_number")}>Número errado</Button>
                          </div>
                        </div>
                      ) : null}
                    </SlideSwap>
                  </> : (
                    <EmptyState
                      icon={<Check aria-hidden="true" />}
                      title={session.runState === "ended" ? "Sessão encerrada" : "Fila concluída"}
                      description={`${session.completed} ${session.completed === 1 ? "ligação" : "ligações"} nesta sessão, ${interestCount} com interesse. Os interessados já estão na sua carteira.`}
                      action={<Button className="min-h-11 rounded-full" variant="primary" onClick={() => void start()}>Recomeçar</Button>}
                    />
                  )}
                </article>
              </EnterInOrder>

              {session.next && session.status !== "ended" ? (
                <EnterInOrder index={2}>
                  <article className="relative overflow-hidden rounded-(--radius-panel) border border-(--border) bg-(--surface)">
                    <SlideSwap swapKey={session.next.id} axis="y" className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--surface-muted) text-(--text-secondary)"><ArrowRight className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-(--text-muted)">Próximo contato</p><p className="mt-1 truncate text-sm font-medium text-(--foreground)">{session.next.name}</p></div></div>
                      <span className="shrink-0 text-sm tabular-nums text-(--text-secondary)">{session.next.phone}</span>
                    </SlideSwap>
                  </article>
                </EnterInOrder>
              ) : null}

              {interestCount > 0 && session.status !== "ended" ? (
                <p className="flex items-center justify-center gap-2 text-sm text-(--text-secondary)" role="status"><Heart className="size-4 text-(--chat-action)" aria-hidden="true" /><span><span className="font-medium tabular-nums text-(--foreground)">{interestCount}</span> com interesse nesta sessão</span></p>
              ) : null}

              {isLab ? (
                <EnterInOrder index={4}>
                  <article className="rounded-(--radius-panel) border border-(--border) bg-(--surface) p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-5" aria-hidden="true" /></span><div><h3 className="font-medium text-(--foreground)">Celular do laboratório</h3><p className="text-xs text-(--text-secondary)">Conectado à conta de {brokerFirstName}</p></div></div></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-(--text-muted)"><span className="rounded-full bg-(--surface-muted) px-3 py-1.5">{statusLabel(session.callStatus)}</span><span>Laboratório: sem discagem real; o 2º contato não atende</span></div></article>
                </EnterInOrder>
              ) : null}
            </section>
          </div>
        )}

        {isLab ? <p className="mx-auto mt-5 flex max-w-2xl items-center gap-2 text-xs text-(--text-muted)"><Sparkles className="size-4" aria-hidden="true" /> Laboratório: sessão e celular simulados no navegador, sem chamadas ou gravações.</p> : null}
      </div>
    </main>
  );
}

export function CallAncoraMobile({ token }: { token: string }) {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [session, setSession] = useState<CallAncoraSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const pairedOnce = useRef(false);
  const sessionEndedRef = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const notifiedContact = useRef<string | null>(null);
  const fire = useFeedback();

  const stopForEndedSession = useCallback(() => {
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setError(CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE);
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (pairedOnce.current) return;
    pairedOnce.current = true;
    void fetch("/api/call-ancora/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        const payload = await response.json() as { deviceToken?: string; session?: CallAncoraSnapshot; error?: string };
        if (!response.ok || !payload.deviceToken || !payload.session) throw new Error(payload.error || "Não consegui conectar este celular.");
        setDeviceToken(payload.deviceToken);
        setSession(payload.session);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Não consegui conectar este celular."));
  }, [token]);

  useEffect(() => {
    if (!deviceToken || sessionEndedRef.current) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/call-ancora/mobile", { cache: "no-store", headers: { Authorization: `Bearer ${deviceToken}` } });
        if (isCallAncoraMobileSessionEndedStatus(response.status)) {
          if (!cancelled) stopForEndedSession();
          return;
        }
        const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
        if (!response.ok || !payload.session) throw new Error(payload.error || "A conexão do celular foi encerrada.");
        if (!cancelled && !sessionEndedRef.current) {
          setSession(payload.session);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled && !sessionEndedRef.current) setError(reason instanceof Error ? reason.message : "O celular perdeu a conexão.");
      }
    };
    void load();
    pollTimer.current = window.setInterval(() => { void load(); }, POLL_MS);
    return () => {
      cancelled = true;
      if (pollTimer.current !== null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [deviceToken, stopForEndedSession]);

  useEffect(() => {
    if (!session?.current || session.callStatus !== "ready") return;
    const contactKey = `${session.sessionId}:${session.current.id}`;
    if (notifiedContact.current === contactKey) return;
    notifiedContact.current = contactKey;
    fire("notify");
  }, [fire, session]);

  return (
    <main className="arc-venancor min-h-dvh bg-(--background) px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col">
        <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-(--accent-subtle) text-(--accent-strong)"><PhoneCall className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-semibold text-(--text-muted)">Call Âncora</p><p className="text-sm font-medium text-(--foreground)">Celular pelo navegador</p></div></header>
        {error ? <section className="mt-8 rounded-3xl border border-(--danger)/25 bg-(--surface) p-6 text-center" role="alert"><p className="font-semibold text-(--foreground)">{sessionEnded ? "Sessão encerrada" : "Não foi possível conectar"}</p><p className="mt-2 text-sm leading-6 text-(--text-secondary)">{error}</p></section> : !session ? <p className="mt-8 rounded-3xl border border-(--border) bg-(--surface) p-6 text-center text-sm text-(--text-secondary)" role="status">Conectando à sessão…</p> : <>
          <section className="mt-8 rounded-[2rem] border border-(--border) bg-(--surface) p-6 text-center shadow-(--shadow-resting)">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-(--success)/10 text-(--success)"><Check className="size-6" aria-hidden="true" /></span>
            <p className="mt-4 text-lg font-semibold text-(--foreground)"><NameReveal text={`Olá, ${session.brokerFirstName}!`} /></p>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">Este celular está pareado à sua sessão do Call Âncora.</p>
          </section>
          {session.current ? <section className="mt-5 rounded-[2rem] border border-(--border) bg-(--surface) p-6">
            <p className="text-xs font-semibold text-(--text-muted)">Contato atual</p>
            <SlideSwap swapKey={session.current.id}><h1 className="mt-3 text-2xl font-semibold text-(--foreground)"><NameReveal text={session.current.name} delay={motionTokens.beat.text} /></h1></SlideSwap>
            <p className="mt-3 rounded-2xl bg-(--accent-subtle) px-4 py-3 text-center text-2xl font-semibold tabular-nums tracking-wide text-(--accent-strong)">{session.current.phone}</p>
            {session.countdown ? <p role="status" className="mt-3 rounded-2xl bg-(--surface-muted) px-4 py-3 text-center text-sm text-(--text-secondary)">{session.countdown.paused ? "Contagem pausada" : <>Próxima ligação em <span className="font-semibold tabular-nums text-(--foreground)"><LiteNumber value={session.countdown.remainingSeconds} /> s</span></>}</p> : null}
            {/* Browsers block opening tel: without a fresh user gesture. Fully automatic real calls require the Android app and TelecomManager.placeCall. */}
            {session.callStatus === "ready" ? <a href={`tel:${session.current.phone.replace(/[^+\d]/g, "")}`} className="mt-4 flex min-h-16 items-center justify-center gap-3 rounded-full bg-(--success) px-5 text-lg font-semibold text-white shadow-(--shadow-resting)"><Phone className="size-5" aria-hidden="true" /> Ligar para o próximo</a> : null}
            <p className="mt-3 text-center text-xs leading-5 text-(--text-muted)">{session.callStatus === "ready" ? "Toque em Ligar para abrir o discador do celular." : statusLabel(session.callStatus)}{session.callStatus === "active" ? ` · ${clock(session.callElapsedSeconds)}` : ""}</p>
          </section> : <section className="mt-5 rounded-[2rem] border border-(--border) bg-(--surface) p-6 text-center"><Check className="mx-auto size-8 text-(--success)" aria-hidden="true" /><p className="mt-3 font-semibold text-(--foreground)">{session.total === 0 ? "Ainda não há frios na sua fila. Assim que a base de frios estiver ligada, eles aparecem aqui." : "Fila concluída"}</p></section>}
          {session.next ? <SlideSwap swapKey={session.next.id} axis="y"><section className="mt-4 rounded-[1.5rem] border border-(--border) bg-(--surface) px-5 py-4"><p className="text-xs font-medium text-(--text-muted)">Próximo contato</p><p className="mt-1 font-semibold text-(--foreground)">{session.next.name}</p></section></SlideSwap> : null}
          <p className="mt-auto pt-6 text-center text-xs leading-5 text-(--text-muted)">No navegador, cada ligação precisa de um toque. Para discar sozinho, use o app Call Âncora no celular.</p>
        </>}
      </div>
    </main>
  );
}
