"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Clock3, Headphones, Heart, Pause, Phone, PhoneCall, Play, Radio, ScanLine, Smartphone, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/motion-tokens";
import { Switch } from "@/components/arc/switch/switch";
import { LiteAttention, LiteListPresence, LiteNumber } from "@/components/lite/motion";
import { reducedFade } from "@/components/lite/motion/shared";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { CALL_ANCORA_DEMO_CONTACTS } from "../contacts";
import { CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE, isCallAncoraMobileSessionEndedStatus } from "../mobile-session";
import type { CallAncoraSnapshot, CallOutcome, CallStatus } from "../session-store";
import { Beat, CallAvatar, ConnectedMoment, contactInitials, EnterInOrder, ExpiryBar, PairingQr, QueueTrack, SlideSwap, SwapText } from "./call-ancora-motion";

const POLL_MS = 1_200;
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
    current: CALL_ANCORA_DEMO_CONTACTS[0],
    next: CALL_ANCORA_DEMO_CONTACTS[1],
    callStatus: "ready",
    callStartedAt: null,
    callElapsedSeconds: 0,
    interests: [],
    completed: 0,
    total: CALL_ANCORA_DEMO_CONTACTS.length,
    queueSource: "demo",
    autoDialEnabled: false,
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
    current: CALL_ANCORA_DEMO_CONTACTS[index] ?? null,
    next: CALL_ANCORA_DEMO_CONTACTS[index + 1] ?? null,
    status: index < CALL_ANCORA_DEMO_CONTACTS.length ? "active" : "ended",
    callStatus: index < CALL_ANCORA_DEMO_CONTACTS.length ? "ready" : "ended",
    callStartedAt: null,
    callElapsedSeconds: 0,
    countdown: null,
    updatedAt: new Date().toISOString(),
  };
}

function statusLabel(status: CallStatus) {
  return ({ ready: "Pronta para ligar", dialing: "Discando", ringing: "Chamando", active: "Em ligação", ended: "Ligação encerrada" })[status];
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  interested: "Com interesse",
  not_interested: "Sem interesse",
  no_answer: "Não atendeu",
  voicemail: "Caixa postal",
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

export function CallAncoraWorkspace({ brokerFirstName, canUseTestList = false }: { brokerFirstName: string; canUseTestList?: boolean }) {
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
  const pollInFlight = useRef(false);
  const previousInterestCount = useRef(0);
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
        const payload = await response.json() as { session?: CallAncoraSnapshot | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a demonstração.");
        if (!cancelled) {
          setSession(payload.session ?? null);
          setError(null);
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

  useEffect(() => {
    const count = session?.interests.length ?? 0;
    if (count > previousInterestCount.current) fire("confirm");
    previousInterestCount.current = count;
  }, [fire, session?.interests.length]);

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
      if (!response.ok || !payload.pairingToken || !payload.snapshot) throw new Error(payload.error || "Não foi possível iniciar a demonstração.");
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

  const classify = useCallback(async (outcome: CallOutcome) => {
    if (!session || session.callStatus !== "ended") return;
    setBusy(true);
    setError(null);
    if (isLab) {
      setSession((current) => {
        if (!current) return current;
        const classified = {
          ...current,
          completed: current.completed + 1,
          interests: outcome === "interested" && current.current && !current.interests.some((item) => item.id === current.current?.id) ? [...current.interests, current.current] : current.interests,
          countdown: current.autoDialEnabled ? { remainingSeconds: 3, paused: false } : null,
        };
        return current.autoDialEnabled ? classified : advanceLabSession(classified);
      });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/call-ancora/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", outcome }) });
      const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "A classificação não foi registrada. Tente de novo.");
      setSession(payload.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A classificação não foi registrada. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }, [isLab, session]);

  const setAutoDialEnabled = useCallback(async (enabled: boolean) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    if (isLab) {
      setSession((current) => {
        if (!current) return current;
        const updated = { ...current, autoDialEnabled: enabled };
        return !enabled && current.countdown ? advanceLabSession(updated) : updated;
      });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/call-ancora/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-dial", enabled }),
      });
      const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "Não consegui atualizar a discagem automática.");
      setSession(payload.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui atualizar a discagem automática.");
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

  const setCountdownPaused = useCallback(async (pause: boolean) => {
    if (!session?.countdown) return;
    if (isLab) {
      setSession((current) => current?.countdown ? { ...current, countdown: { ...current.countdown, paused: pause } } : current);
      return;
    }
    const response = await fetch("/api/call-ancora/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pause ? "pause" : "resume" }) });
    const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
    if (!response.ok || !payload.session) { setError(payload.error || "Não consegui atualizar a contagem. Tente de novo."); return; }
    setSession(payload.session);
  }, [isLab, session?.countdown]);

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
    move("ringing"); await delay(900);
    move("active"); await delay(5_000);
    move("ended");
    setSimulating(false);
  }, [session, simulating]);

  useEffect(() => {
    if (!isLab || !session?.autoDialEnabled || session.completed === 0 || session.callStatus !== "ready" || !session.current || simulating) return;
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
  const totalContacts = session?.total ?? CALL_ANCORA_DEMO_CONTACTS.length;
  const realQueue = session?.queueSource === "test_list";
  const lastCallText = lastCallSummary(session?.lastCall ?? null);
  const currentOutcome = session?.lastOutcome && session.current && session.lastOutcome.contactId === session.current.id ? session.lastOutcome : null;
  const realCallInProgress = Boolean(session?.current?.dialable) && (session?.callStatus === "dialing" || session?.callStatus === "ringing" || session?.callStatus === "active");
  const calling = session?.callStatus === "dialing" || session?.callStatus === "ringing";
  const inSession = Boolean(session && session.status !== "waiting_pairing" && !connectedMoment);
  const newestInterests = session ? [...session.interests].reverse() : [];

  return (
    <main className="arc-venancor min-h-full bg-(--background) px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-(--accent-strong)"><PhoneCall className="size-4" aria-hidden="true" /> CALL ÂNCORA · DEMONSTRAÇÃO</p>
            <h1 className="text-2xl font-semibold tracking-tight text-(--foreground) md:text-3xl">Sua sessão de ligações</h1>
            <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">Veja o fluxo de ponta a ponta com contatos fictícios. Nada é salvo e nenhum lead é criado.</p>
          </div>
          {inSession && session?.status === "active" ? (
            <motion.span
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-(--success)/20 bg-(--success)/10 px-4 text-sm font-medium text-(--success)"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: motionTokens.scale.popIn, y: -motionTokens.distance.xs }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={reduceMotion ? reducedFade : motionTokens.spring.snappy}
            >
              <Radio className="size-4" aria-hidden="true" /> {session.phone && !session.phone.reachable ? `Celular sem sinal com o AncoraHub há ${session.phone.staleSeconds} s` : "Celular conectado"}
            </motion.span>
          ) : null}
        </header>

        {error ? <p className="mb-5 rounded-xl border border-(--danger)/25 bg-(--danger)/5 px-4 py-3 text-sm text-(--danger)" role="alert">{error}</p> : null}

        {!session ? (
          <section className="mx-auto flex min-h-[min(58vh,560px)] max-w-3xl flex-col items-center justify-center rounded-2xl border border-(--border) bg-(--surface) px-6 py-12 text-center md:px-12">
            <Beat className="mb-7">
              <LiteAttention pulseKey="intro" className="rounded-full">
                <span className="grid size-20 place-items-center rounded-full bg-(--accent-subtle) text-(--accent-strong)"><Headphones className="size-9" aria-hidden="true" /></span>
              </LiteAttention>
            </Beat>
            <Beat at="text">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-(--text-muted)">Call Âncora</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--foreground) md:text-4xl">Uma conversa de cada vez.</h2>
            </Beat>
            <Beat at="number">
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-(--text-secondary)">Conecte o celular da demonstração e acompanhe a ligação, o próximo contato e os interessados nesta tela.</p>
            </Beat>
            <Beat at="after" className="flex flex-col items-center">
              <Button className="mt-8 min-h-14 min-w-52 rounded-full px-10 text-base" size="lg" loading={busy} onClick={() => void start()}>
                <PhoneCall className="size-5" aria-hidden="true" /> Iniciar
              </Button>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-(--text-muted)" aria-label="Sobre a demonstração">
                {["Somente simulação", `${totalContacts} contatos fictícios`, "Sem acesso à base real"].map((item) => <li key={item} className="rounded-full border border-(--border) px-3 py-1">{item}</li>)}
              </ul>
            </Beat>
          </section>
        ) : session.status === "waiting_pairing" ? (
          <section className="mx-auto grid max-w-4xl items-center gap-8 rounded-2xl border border-(--border) bg-(--surface) p-6 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <Beat><span className="inline-flex size-12 items-center justify-center rounded-xl bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-6" aria-hidden="true" /></span></Beat>
              <Beat at="text">
                <h2 className="mt-5 text-2xl font-semibold text-(--foreground)">Conecte o celular</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-(--text-secondary)">Abra a câmera do celular e leia este QR. O código vale por dois minutos e só pode ser usado uma vez.</p>
              </Beat>
              <Beat at="number" className="mt-6 max-w-xs">
                <p className="mb-2 flex items-center gap-2 text-sm text-(--text-secondary)" aria-live="off"><Clock3 className="size-4" aria-hidden="true" /> <span className="tabular-nums">{pairExpired ? "QR vencido" : `Expira em ${pairSecondsLeft} s`}</span></p>
                <ExpiryBar ratio={pairExpired ? 0 : pairSecondsLeft / PAIR_TTL_SECONDS} />
              </Beat>
              <Beat at="after" className="mt-6 flex flex-wrap gap-3">
                <Button className="min-h-11 rounded-full" variant="secondary" onClick={() => void start()} loading={busy}>{pairExpired ? "Gerar outro QR" : "Gerar novo QR"}</Button>
                {isLab ? <Button className="min-h-11 rounded-full" variant="secondary" disabled={pairExpired} onClick={simulateLabPairing}><ScanLine className="size-4" aria-hidden="true" /> Simular leitura do QR</Button> : null}
              </Beat>
            </div>
            <div className="relative">
              {qrValue ? <PairingQr value={qrValue} expired={pairExpired} label="QR code de pareamento do Call Âncora" /> : <div className="grid size-64 place-items-center text-sm text-(--text-muted)">Preparando QR…</div>}
              {pairExpired ? <span className="absolute inset-0 grid place-items-center"><span className="rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-medium text-(--foreground)">Gere outro QR</span></span> : null}
            </div>
          </section>
        ) : connectedMoment ? (
          <ConnectedMoment brokerFirstName={session.brokerFirstName} />
        ) : (
          <>
            <EnterInOrder index={0} className="mb-6">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-(--border) bg-(--surface) px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <p id="call-ancora-auto-dial-label" className="text-sm font-semibold text-(--foreground)">Discagem automática</p>
                  <p className="mt-1 text-xs leading-5 text-(--text-secondary)"><SwapText value={session.autoDialEnabled ? "Após classificar, a próxima simulação começa sozinha em 3 segundos." : "Desligada. O próximo contato fica pronto para você iniciar no celular."} /></p>
                </div>
                <Switch aria-labelledby="call-ancora-auto-dial-label" checked={session.autoDialEnabled} disabled={busy} onCheckedChange={(enabled) => void setAutoDialEnabled(enabled)} />
              </div>
            </EnterInOrder>

            {!isLab && session.status !== "ended" ? (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="secondary" className="min-h-10 rounded-full" disabled={busy} onClick={() => void sendAction({ action: session.runState === "paused" ? "run-resume" : "run-pause" }, "Não consegui atualizar a sessão.")}>{session.runState === "paused" ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}{session.runState === "paused" ? "Retomar sessão" : "Pausar sessão"}</Button>
                <Button size="sm" variant="secondary" className="min-h-10 rounded-full" disabled={busy} onClick={() => { if (window.confirm("Encerrar a sessão? O celular é desconectado.")) void sendAction({ action: "end" }, "Não consegui encerrar a sessão."); }}>Encerrar sessão</Button>
                {session.phone && !session.phone.reachable ? <span className="text-xs text-(--danger)">Sem notícia do celular há {session.phone.staleSeconds} s: a fila espera ele voltar.</span> : null}
              </div>
            ) : null}
            {session.runState === "paused" ? <p className="mb-5 rounded-xl border border-(--warning)/25 bg-(--warning)/5 px-4 py-3 text-sm text-(--foreground)" role="status">{session.pausedBy === "phone" ? "O celular pausou a sessão." : "Sessão pausada pela tela."} A ligação em andamento continua; nenhuma nova começa até retomar.</p> : null}

            {canUseTestList && !isLab ? (
              <EnterInOrder index={1} className="mb-6">
                <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 md:p-5" aria-labelledby="call-ancora-test-list">
                  <h2 id="call-ancora-test-list" className="text-sm font-semibold text-(--foreground)">Lista de teste (ligação real)</h2>
                  <p className="mt-1 text-xs leading-5 text-(--text-secondary)">Só para administradores. Estes números são discados de verdade pelo app Android. Um por linha, nome opcional (ex.: <span className="font-mono">Ana; (21) 99999-0000</span>). Até 50. Substitui a fila desta sessão.</p>
                  <textarea
                    className="mt-3 min-h-28 w-full rounded-xl border border-(--border) bg-(--background) px-3 py-2 font-mono text-sm text-(--foreground)"
                    value={testListText}
                    onChange={(event) => setTestListText(event.target.value)}
                    placeholder={"(21) 99999-0000\nBruno; (21) 98888-7777"}
                    aria-label="Números da lista de teste"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="secondary" className="min-h-10 rounded-full" disabled={busy || !testListText.trim()} loading={busy} onClick={() => void applyTestList()}>Usar como fila</Button>
                    <span className="text-xs text-(--text-muted)">{realQueue ? `Fila atual: lista de teste, ${totalContacts} números` : "Fila atual: contatos fictícios (não discáveis)"}</span>
                  </div>
                </section>
              </EnterInOrder>
            ) : null}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
              <EnterInOrder index={3} className="order-2 lg:order-1">
                <section className="rounded-2xl border border-(--border) bg-(--surface) p-5" aria-labelledby="call-ancora-interesses">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <motion.span
                        key={session.interests.length}
                        className="grid size-10 place-items-center rounded-xl bg-(--success)/10 text-(--success)"
                        initial={reduceMotion || session.interests.length === 0 ? false : { scale: 0.85 }}
                        animate={{ scale: 1 }}
                        transition={motionTokens.spring.snappy}
                      >
                        <Heart className="size-5" fill={session.interests.length ? "currentColor" : "none"} aria-hidden="true" />
                      </motion.span>
                      <div><h2 id="call-ancora-interesses" className="font-semibold text-(--foreground)">Com interesse</h2><p className="text-xs text-(--text-muted)">Ficam nesta lista de demonstração</p></div>
                    </div>
                    <LiteAttention pulseKey={session.interests.length || undefined} className="rounded-full">
                      <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-(--surface-muted) px-2 text-sm font-semibold text-(--foreground)"><LiteNumber value={session.interests.length} live /></span>
                    </LiteAttention>
                  </div>
                  {newestInterests.length ? (
                    <LiteListPresence className="grid gap-2">
                      {newestInterests.map((contact, index) => (
                        <article key={contact.id} className={`flex min-h-[68px] items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-500 ${index === 0 ? "border-(--success)/25 bg-(--success)/5" : "border-transparent bg-(--surface-muted)"}`}>
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--surface) text-sm font-semibold text-(--accent-strong)">{contactInitials(contact.name)}</span>
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-(--foreground)">{contact.name}</p><p className="text-xs text-(--text-muted)">{index === 0 ? "Interesse marcado agora" : "Interesse marcado"}</p></div>
                          <Check className="ml-auto size-4 shrink-0 text-(--success)" aria-label="Interesse marcado" />
                        </article>
                      ))}
                    </LiteListPresence>
                  ) : (
                    <div className="rounded-xl border border-dashed border-(--border) px-4 py-7 text-center"><Users className="mx-auto size-6 text-(--text-muted)" aria-hidden="true" /><p className="mt-2 text-sm font-medium text-(--foreground)">A lista começa vazia</p><p className="mt-1 text-xs leading-5 text-(--text-muted)">Quando alguém demonstrar interesse, aparece aqui.</p></div>
                  )}
                  <p className="mt-4 text-xs leading-5 text-(--text-muted)">Nesta etapa, interesse não cria lead nem movimenta a carteira.</p>
                </section>
              </EnterInOrder>

              <section className="order-1 grid gap-5 lg:order-2">
                <EnterInOrder index={1}>
                  <article className="relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-(--shadow-resting) md:p-8">
                    {session.current && session.status !== "ended" ? <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-(--surface-muted) px-3 text-xs font-medium text-(--text-secondary)">
                          <span className={`size-2 rounded-full transition-colors duration-300 ${session.callStatus === "active" ? "bg-(--success)" : calling ? "bg-(--primary)" : "bg-(--text-muted)"}`} aria-hidden="true" />
                          <SwapText value={statusLabel(session.callStatus)} />
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-(--text-muted)">Contato <LiteNumber value={Math.min(session.completed + 1, totalContacts)} /> de {totalContacts}</span>
                      </div>
                      <div className="mt-4"><QueueTrack total={totalContacts} done={session.completed} /></div>
                      <SlideSwap swapKey={session.current.id}>
                        <div className="mx-auto flex max-w-lg flex-col items-center pt-8 text-center md:pt-10">
                          <CallAvatar name={session.current.name} status={session.callStatus} />
                          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-(--foreground)">{session.current.name}</h2>
                          <p className="mt-2 text-sm tabular-nums text-(--text-secondary)">{session.current.phone} <span className="text-(--text-muted)">{session.current.dialable ? "· lista de teste (ligação real)" : "· número fictício"}</span></p>
                        </div>
                      </SlideSwap>
                      <SlideSwap swapKey={`${session.current.id}-${session.callStatus}-${session.countdown ? "countdown" : "idle"}`} axis="y" className="mx-auto flex max-w-lg flex-col items-center pb-2 text-center">
                        {session.callStatus === "active" ? <p className="mt-6 flex items-center gap-2 font-mono text-2xl tabular-nums text-(--foreground)" aria-live="off"><Clock3 className="size-5 text-(--success)" aria-hidden="true" /> {clock(Math.floor(Math.max(0, now - Date.parse(session.callStartedAt ?? new Date().toISOString())) / 1000))}</p> : null}
                        {calling ? <p className="mt-6 text-sm text-(--text-secondary)">{session.callStatus === "dialing" ? "Discando pelo celular pareado…" : "Chamando. Aguardando atender…"}</p> : null}
                        {realCallInProgress && !isLab ? <Button size="sm" variant="secondary" className="mt-4 min-h-10 rounded-full" disabled={busy || session.hangupRequested} onClick={() => void sendAction({ action: "hangup-voicemail" }, "Não consegui pedir para desligar.")}>{session.hangupRequest === "voicemail" ? "Pedindo para o celular desligar…" : "Caixa postal (desligar)"}</Button> : null}
                        {realCallInProgress && !isLab ? <Button size="sm" variant="secondary" className="mt-2 min-h-10 rounded-full" disabled={busy || session.hangupRequested} onClick={() => void sendAction({ action: "hangup-call" }, "Não consegui pedir para desligar.")}>{session.hangupRequest === "hangup" ? "Pedindo para o celular desligar…" : "Desligar ligação"}</Button> : null}
                        {session.callStatus === "ready" ? <p className="mt-5 max-w-sm text-sm leading-6 text-(--text-secondary)">{session.autoDialEnabled ? "Discagem automática ligada. A próxima simulação começa após a contagem; para uma chamada real, o navegador exige um toque em Ligar no celular." : "Discagem automática desligada. O próximo contato está pronto. Toque em Ligar para o próximo no celular."}</p> : null}
                        {lastCallText && (session.callStatus === "ended" || session.countdown) ? <p className="mt-5 text-sm font-medium text-(--foreground)" role="status">{lastCallText}</p> : null}
                        {session.callStatus === "ended" && !session.countdown ? <p className="mt-5 text-sm text-(--text-secondary)">Como foi esta conversa?</p> : null}
                        {session.countdown && currentOutcome && !isLab ? <div className="mt-5 w-full max-w-md text-center"><p className="text-sm text-(--text-secondary)">Classificada como <span className="font-semibold text-(--foreground)">{OUTCOME_LABEL[currentOutcome.outcome]}</span>{currentOutcome.auto ? " (automático, estimativa)" : ""}.</p><div className="mt-2 flex flex-wrap justify-center gap-2"><span className="self-center text-xs text-(--text-muted)">Corrigir:</span>{(Object.keys(OUTCOME_LABEL) as CallOutcome[]).filter((outcome) => outcome !== currentOutcome.outcome).map((outcome) => <Button key={outcome} size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={busy} onClick={() => void sendAction({ action: "reclassify", outcome }, "Não consegui corrigir a classificação.")}>{OUTCOME_LABEL[outcome]}</Button>)}</div></div> : null}
                        {session.countdown ? <div className="mt-6 flex w-full max-w-md flex-wrap items-center justify-center gap-3 rounded-xl bg-(--surface-muted) px-4 py-3"><span className="inline-flex items-center gap-1 text-sm text-(--text-secondary)">{countdownExpired ? "Próximo contato" : session.countdown.paused ? "Próximo em pausado" : <>Próximo em <LiteNumber value={session.countdown.remainingSeconds} /> s</>}</span><Button size="sm" variant="secondary" className="min-h-10 rounded-full" onClick={() => void setCountdownPaused(!session.countdown?.paused)}>{session.countdown.paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}{session.countdown.paused ? "Retomar" : "Pausar"}</Button></div> : null}
                        {session.callStatus === "ended" && !session.countdown ? <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2"><Button variant="primary" size="lg" className="min-h-12 rounded-full" disabled={busy} loading={busy} onClick={() => void classify("interested")}><Heart className="size-4" aria-hidden="true" /> Com interesse</Button><Button variant="secondary" size="lg" className="min-h-12 rounded-full" disabled={busy} onClick={() => void classify("not_interested")}><X className="size-4" aria-hidden="true" /> Sem interesse</Button><Button variant="secondary" size="md" className="min-h-11 rounded-full" disabled={busy} onClick={() => void classify("voicemail")}>Caixa postal</Button><Button variant="secondary" size="md" className="min-h-11 rounded-full" disabled={busy} onClick={() => void classify("no_answer")}>Não atendeu</Button></div> : null}
                      </SlideSwap>
                    </> : (
                      <div className="flex flex-col items-center py-16 text-center">
                        <Beat><span className="grid size-16 place-items-center rounded-full bg-(--success)/10 text-(--success)"><Check className="size-8" aria-hidden="true" /></span></Beat>
                        <Beat at="text"><h2 className="mt-4 text-2xl font-semibold text-(--foreground)">{session.runState === "ended" ? "Sessão encerrada" : "Demonstração concluída"}</h2></Beat>
                        <Beat at="number"><p className="mt-2 text-sm text-(--text-secondary)">Os contatos continuam fictícios e não foram salvos.</p></Beat>
                        <Beat at="after"><Button className="mt-6 min-h-11 rounded-full" variant="secondary" onClick={() => void start()}>Recomeçar</Button></Beat>
                      </div>
                    )}
                  </article>
                </EnterInOrder>

                {session.next ? (
                  <EnterInOrder index={2}>
                    <article className="relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
                      <SlideSwap swapKey={session.next.id} axis="y" className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-(--surface-muted) text-(--text-secondary)"><ArrowRight className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Próximo contato</p><p className="mt-1 text-sm font-semibold text-(--foreground)">{session.next.name}</p></div></div>
                        <span className="text-sm tabular-nums text-(--text-secondary)">{session.next.phone}</span>
                      </SlideSwap>
                    </article>
                  </EnterInOrder>
                ) : null}

                {isLab ? (
                  <EnterInOrder index={4}>
                    <article className="rounded-2xl border border-(--border) bg-(--surface) p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-5" aria-hidden="true" /></span><div><h3 className="font-semibold text-(--foreground)">Celular da demonstração</h3><p className="text-xs text-(--text-secondary)">Conectado à conta de {brokerFirstName}</p></div></div><Button size="md" variant="secondary" className="min-h-11 rounded-full" disabled={simulating || session.callStatus !== "ready" || (session.autoDialEnabled && session.completed > 0)} loading={simulating} onClick={() => void simulateLabCall()}><PhoneCall className="size-4" aria-hidden="true" />{simulating ? "Simulando…" : session.autoDialEnabled && session.completed > 0 ? "Começando automaticamente" : "Ligar para o próximo"}</Button></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-(--text-muted)"><span className="rounded-full bg-(--surface-muted) px-3 py-1.5">{statusLabel(session.callStatus)}</span><span>Número fictício, sem discagem real</span></div></article>
                  </EnterInOrder>
                ) : null}
              </section>
            </div>
          </>
        )}

        {isLab ? <p className="mt-5 flex items-center gap-2 text-xs text-(--text-muted)"><Sparkles className="size-4" aria-hidden="true" /> Laboratório: sessão e celular simulados no navegador, sem chamadas ou gravações.</p> : null}
      </div>
    </main>
  );
}

export function CallAncoraMobile({ token }: { token: string }) {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [session, setSession] = useState<CallAncoraSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const pairedOnce = useRef(false);
  const sessionEndedRef = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const autoStartedContact = useRef<string | null>(null);
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

  const simulate = useCallback(async () => {
    if (!deviceToken || !session || simulating || session.callStatus !== "ready") return;
    setSimulating(true);
    setError(null);
    const transitions: Array<{ callStatus: CallStatus; waitMs: number }> = [
      { callStatus: "dialing", waitMs: 700 },
      { callStatus: "ringing", waitMs: 900 },
      { callStatus: "active", waitMs: 4_500 },
      { callStatus: "ended", waitMs: 0 },
    ];
    try {
      for (const transition of transitions) {
        const response = await fetch("/api/call-ancora/mobile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` }, body: JSON.stringify({ callStatus: transition.callStatus }) });
        if (isCallAncoraMobileSessionEndedStatus(response.status)) {
          stopForEndedSession();
          return;
        }
        const payload = await response.json() as { session?: CallAncoraSnapshot; error?: string };
        if (!response.ok || !payload.session) throw new Error(payload.error || "A ligação simulada parou. Tente de novo.");
        setSession(payload.session);
        if (transition.waitMs) await delay(transition.waitMs);
      }
      fire("confirm");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A ligação simulada parou. Tente de novo.");
    } finally {
      setSimulating(false);
    }
  }, [deviceToken, fire, session, simulating, stopForEndedSession]);

  useEffect(() => {
    if (!deviceToken || !session?.autoDialEnabled || session.completed === 0 || session.callStatus !== "ready" || !session.current || simulating) return;
    const contactKey = `${session.sessionId}:${session.current.id}`;
    if (autoStartedContact.current === contactKey) return;
    autoStartedContact.current = contactKey;
    // Simulation can advance automatically; the real tel: path below always needs a fresh tap in a browser.
    void simulate();
  }, [deviceToken, session, simulating, simulate]);

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
        <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-(--accent-subtle) text-(--accent-strong)"><PhoneCall className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Call Âncora</p><p className="text-sm font-medium text-(--foreground)">Celular da demonstração</p></div></header>
        {error ? <section className="mt-8 rounded-3xl border border-(--danger)/25 bg-(--surface) p-6 text-center" role="alert"><p className="font-semibold text-(--foreground)">{sessionEnded ? "Sessão encerrada" : "Não foi possível conectar"}</p><p className="mt-2 text-sm leading-6 text-(--text-secondary)">{error}</p></section> : !session ? <p className="mt-8 rounded-3xl border border-(--border) bg-(--surface) p-6 text-center text-sm text-(--text-secondary)" role="status">Conectando à sessão…</p> : <>
          <section className="mt-8 rounded-[2rem] border border-(--border) bg-(--surface) p-6 text-center shadow-(--shadow-resting)">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-(--success)/10 text-(--success)"><Check className="size-6" aria-hidden="true" /></span>
            <p className="mt-4 text-lg font-semibold text-(--foreground)">Conectado à conta de {session.brokerFirstName}</p>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">Este celular está pareado à demonstração do Call Âncora.</p>
          </section>
          {session.current ? <section className="mt-5 rounded-[2rem] border border-(--border) bg-(--surface) p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Contato atual · fictício</p>
            <h1 className="mt-3 text-2xl font-semibold text-(--foreground)">{session.current.name}</h1>
            <p className="mt-3 rounded-2xl bg-(--accent-subtle) px-4 py-3 text-center text-2xl font-semibold tabular-nums tracking-wide text-(--accent-strong)">{session.current.phone}</p>
            {session.autoDialEnabled ? <p className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-(--success)/10 px-3 text-sm font-medium text-(--success)">Discagem automática ligada</p> : <p className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-(--surface-muted) px-3 text-sm text-(--text-secondary)">Discagem automática desligada</p>}
            {session.countdown ? <p role="status" className="mt-3 rounded-2xl bg-(--surface-muted) px-4 py-3 text-center text-sm text-(--text-secondary)">{session.countdown.paused ? "Próximo contato pausado" : `Próximo contato em ${session.countdown.remainingSeconds} s`}</p> : null}
            {/* Browsers block opening tel: without a fresh user gesture. Fully automatic real calls require the Android app and TelecomManager.placeCall. */}
            {session.callStatus === "ready" ? <a href={`tel:${session.current.phone.replace(/[^+\d]/g, "")}`} className="mt-4 flex min-h-16 items-center justify-center gap-3 rounded-full bg-(--success) px-5 text-lg font-semibold text-white shadow-(--shadow-resting)"><Phone className="size-5" aria-hidden="true" /> Ligar para o próximo</a> : null}
            {session.callStatus === "ready" ? <Button variant="secondary" size="lg" className="mt-3 min-h-12 w-full rounded-full" disabled={!deviceToken || simulating || (session.autoDialEnabled && session.completed > 0)} loading={simulating} onClick={() => void simulate()}><PhoneCall className="size-4" aria-hidden="true" />{simulating ? statusLabel(session.callStatus) : session.autoDialEnabled && session.completed > 0 ? "Começando automaticamente" : "Simular"}</Button> : null}
            <p className="mt-3 text-center text-xs leading-5 text-(--text-muted)">{session.callStatus === "ready" ? session.autoDialEnabled && session.completed > 0 ? "A próxima simulação começa sozinha. Toque em Ligar para uma chamada real." : "Toque em Ligar para abrir o discador; chamadas reais exigem toque nesta página." : statusLabel(session.callStatus)}{session.callStatus === "active" ? ` · ${clock(session.callElapsedSeconds)}` : ""}</p>
          </section> : <section className="mt-5 rounded-[2rem] border border-(--border) bg-(--surface) p-6 text-center"><Check className="mx-auto size-8 text-(--success)" aria-hidden="true" /><p className="mt-3 font-semibold text-(--foreground)">Fila de demonstração concluída</p></section>}
          <p className="mt-auto pt-6 text-center text-xs leading-5 text-(--text-muted)">Nenhuma ligação real começa sozinha no navegador. A discagem automática real virá com o app Android usando TelecomManager.placeCall.</p>
        </>}
      </div>
    </main>
  );
}
