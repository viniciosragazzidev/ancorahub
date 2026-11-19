"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode-generator";
import Image from "next/image";
import { ArrowRight, Check, Clock3, Headphones, Heart, Pause, Phone, PhoneCall, Play, Radio, Smartphone, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { LiteListPresence } from "@/components/lite/motion";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { CALL_ANCORA_DEMO_CONTACTS } from "../contacts";
import { CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE, isCallAncoraMobileSessionEndedStatus } from "../mobile-session";
import type { CallAncoraSnapshot, CallStatus } from "../session-store";

const POLL_MS = 1_200;
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
    countdown: null,
    updatedAt: new Date().toISOString(),
  };
}

function statusLabel(status: CallStatus) {
  return ({ ready: "Pronta para ligar", dialing: "Discando", ringing: "Chamando", active: "Em ligação", ended: "Ligação encerrada" })[status];
}

export function CallAncoraWorkspace({ brokerFirstName }: { brokerFirstName: string }) {
  const lab = useDevLab();
  const isLab = Boolean(lab);
  const fire = useFeedback();
  const [session, setSession] = useState<CallAncoraSnapshot | null>(() => isLab ? labSnapshot(brokerFirstName) : null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const pollInFlight = useRef(false);
  const previousInterestCount = useRef(0);

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

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setQrDataUrl(null);
    if (isLab) {
      setSession(labSnapshot(brokerFirstName));
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
      const qr = QRCode(0, "M");
      qr.addData(url.toString());
      qr.make();
      setQrDataUrl(qr.createDataURL(5, 3));
      setSession(payload.snapshot);
      setPairingExpiresAt(payload.pairExpiresAt ?? Date.now() + 120_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [brokerFirstName, isLab]);

  const classify = useCallback(async (outcome: "interested" | "not_interested") => {
    if (!session || session.callStatus !== "ended") return;
    setBusy(true);
    setError(null);
    if (isLab) {
      setSession((current) => current ? { ...current, completed: current.completed + 1, interests: outcome === "interested" && current.current && !current.interests.some((item) => item.id === current.current?.id) ? [...current.interests, current.current] : current.interests, countdown: { remainingSeconds: 3, paused: false } } : current);
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
        const index = current.completed;
        return { ...current, current: CALL_ANCORA_DEMO_CONTACTS[index] ?? null, next: CALL_ANCORA_DEMO_CONTACTS[index + 1] ?? null, status: index < CALL_ANCORA_DEMO_CONTACTS.length ? "active" : "ended", callStatus: index < CALL_ANCORA_DEMO_CONTACTS.length ? "ready" : "ended", callStartedAt: null, callElapsedSeconds: 0, countdown: null, updatedAt: new Date().toISOString() };
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [isLab, session?.countdown, session?.countdown?.paused, session?.countdown?.remainingSeconds, session?.completed]);

  const simulateLabCall = useCallback(async () => {
    if (!session || simulating) return;
    setSimulating(true);
    const move = (callStatus: CallStatus) => setSession((current) => current ? { ...current, callStatus, callStartedAt: callStatus === "active" ? new Date().toISOString() : current.callStartedAt, callElapsedSeconds: 0, updatedAt: new Date().toISOString() } : current);
    move("dialing"); await delay(700);
    move("ringing"); await delay(900);
    move("active"); await delay(5_000);
    move("ended");
    setSimulating(false);
  }, [session, simulating]);

  const countdownExpired = Boolean(session?.countdown && !session.countdown.paused && session.countdown.remainingSeconds <= 0);
  const pairExpired = pairingExpiresAt !== null && now >= pairingExpiresAt;

  return (
    <main className="arc-venancor min-h-full bg-(--background) px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-(--accent-strong)"><PhoneCall className="size-4" aria-hidden="true" /> CALL ÂNCORA · DEMONSTRAÇÃO</p>
            <h1 className="text-2xl font-semibold tracking-tight text-(--foreground) md:text-3xl">Sua sessão de ligações</h1>
            <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">Veja o fluxo de ponta a ponta com contatos fictícios. Nada é salvo e nenhum lead é criado.</p>
          </div>
          {session?.status === "active" ? <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-(--success)/10 px-4 text-sm font-medium text-(--success)"><Radio className="size-4" aria-hidden="true" /> Celular conectado</span> : null}
        </header>

        {error ? <p className="mb-5 rounded-2xl border border-(--danger)/25 bg-(--danger)/5 px-4 py-3 text-sm text-(--danger)" role="alert">{error}</p> : null}

        {!session ? (
          <section className="mx-auto flex min-h-[min(58vh,560px)] max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-(--border) bg-(--surface) px-6 py-12 text-center shadow-(--shadow-resting) md:px-12">
            <span className="mb-7 grid size-20 place-items-center rounded-full bg-(--accent-subtle) text-(--accent-strong)"><Headphones className="size-9" aria-hidden="true" /></span>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-(--text-muted)">Call Âncora</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--foreground) md:text-4xl">Uma conversa de cada vez.</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-(--text-secondary)">Conecte o celular da demonstração e acompanhe a ligação, o próximo contato e os interessados nesta tela.</p>
            <Button className="mt-8 min-h-14 min-w-52 rounded-full px-10 text-base" size="lg" loading={busy} onClick={() => void start()}>
              <PhoneCall className="size-5" aria-hidden="true" /> Iniciar
            </Button>
            <p className="mt-4 text-xs text-(--text-muted)">Somente simulação · 18 contatos fictícios · sem acesso à base real</p>
          </section>
        ) : session.status === "waiting_pairing" && !isLab ? (
          <section className="mx-auto grid max-w-4xl items-center gap-8 rounded-[2rem] border border-(--border) bg-(--surface) p-6 shadow-(--shadow-resting) md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-6" aria-hidden="true" /></span>
              <h2 className="mt-5 text-2xl font-semibold text-(--foreground)">Conecte o celular</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-(--text-secondary)">Abra a câmera do celular e leia este QR. O código vale por dois minutos e só pode ser usado uma vez.</p>
              <div className="mt-5 flex items-center gap-2 text-sm text-(--text-secondary)"><Clock3 className="size-4" aria-hidden="true" /> {pairExpired ? "QR vencido" : `Expira em ${Math.max(0, Math.ceil(((pairingExpiresAt ?? now) - now) / 1000))} s`}</div>
              <Button className="mt-6 min-h-11 rounded-full" variant="secondary" onClick={() => void start()} loading={busy}>{pairExpired ? "Gerar outro QR" : "Gerar novo QR"}</Button>
            </div>
            <div className="mx-auto grid size-60 place-items-center rounded-3xl border border-(--border) bg-white p-4">
              {qrDataUrl && !pairExpired ? <Image src={qrDataUrl} width={208} height={208} alt="QR code de pareamento do Call Âncora" unoptimized className="size-52" /> : <span className="text-center text-sm text-(--text-muted)">{pairExpired ? "Gere outro QR" : "Preparando QR…"}</span>}
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
            <section className="order-2 rounded-[1.75rem] border border-(--border) bg-(--surface) p-5 shadow-(--shadow-resting) lg:order-1" aria-labelledby="call-ancora-interesses">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-(--success)/10 text-(--success)"><Heart className="size-5" aria-hidden="true" /></span><div><h2 id="call-ancora-interesses" className="font-semibold text-(--foreground)">Com interesse</h2><p className="text-xs text-(--text-muted)">Ficam nesta lista de demonstração</p></div></div>
                <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-(--surface-muted) px-2 text-sm font-semibold tabular-nums text-(--foreground)">{session.interests.length}</span>
              </div>
              {session.interests.length ? <LiteListPresence className="grid gap-2">{session.interests.map((contact) => <article key={contact.id} className="flex min-h-[68px] items-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--surface) text-sm font-semibold text-(--accent-strong)">{contact.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-(--foreground)">{contact.name}</p><p className="text-xs text-(--text-muted)">Interesse marcado agora</p></div><Check className="ml-auto size-4 shrink-0 text-(--success)" aria-label="Interesse marcado" /></article>)}</LiteListPresence> : <div className="rounded-2xl bg-(--surface-muted) px-4 py-7 text-center"><Users className="mx-auto size-6 text-(--text-muted)" aria-hidden="true" /><p className="mt-2 text-sm font-medium text-(--foreground)">A lista começa vazia</p><p className="mt-1 text-xs leading-5 text-(--text-muted)">Quando alguém demonstrar interesse, aparece aqui.</p></div>}
              <p className="mt-4 text-xs leading-5 text-(--text-muted)">Nesta etapa, interesse não cria lead nem movimenta a carteira.</p>
            </section>

            <section className="order-1 grid gap-5 lg:order-2">
              <article className="rounded-[2rem] border border-(--border) bg-(--surface) p-6 shadow-(--shadow-resting) md:p-8">
                {session.current ? <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-(--surface-muted) px-3 text-xs font-medium text-(--text-secondary)"><span className={`size-2 rounded-full ${session.callStatus === "active" ? "bg-(--success)" : "bg-(--text-muted)"}`} aria-hidden="true" /> {statusLabel(session.callStatus)}</span>
                    <span className="text-xs font-medium tabular-nums text-(--text-muted)">Contato {session.completed + 1} de {CALL_ANCORA_DEMO_CONTACTS.length}</span>
                  </div>
                  <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center md:py-10">
                    <span className="grid size-20 place-items-center rounded-full bg-(--accent-subtle) text-2xl font-semibold text-(--accent-strong)">{session.current.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                    <h2 className="mt-5 text-3xl font-semibold tracking-tight text-(--foreground)">{session.current.name}</h2>
                    <p className="mt-2 text-sm text-(--text-secondary)">{session.current.phone} <span className="text-(--text-muted)">· número fictício</span></p>
                    {session.callStatus === "active" ? <p className="mt-6 flex items-center gap-2 font-mono text-2xl tabular-nums text-(--foreground)" aria-live="off"><Clock3 className="size-5 text-(--success)" aria-hidden="true" /> {clock(Math.floor(Math.max(0, now - Date.parse(session.callStartedAt ?? new Date().toISOString())) / 1000))}</p> : null}
                    {session.callStatus === "ready" ? <p className="mt-5 max-w-sm text-sm leading-6 text-(--text-secondary)">{isLab ? "Use o celular simulado ao lado para avançar a ligação." : "A ligação é controlada pelo celular pareado. Quando terminar, classifique o resultado aqui."}</p> : null}
                    {session.callStatus === "ended" && !session.countdown ? <p className="mt-5 text-sm text-(--text-secondary)">Como foi esta conversa?</p> : null}
                    {session.countdown ? <div className="mt-6 flex w-full max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-3"><span className="text-sm text-(--text-secondary)">{countdownExpired ? "Próximo contato" : `Próximo em ${session.countdown.paused ? "pausado" : `${session.countdown.remainingSeconds} s`}`}</span><Button size="sm" variant="secondary" className="min-h-10 rounded-full" onClick={() => void setCountdownPaused(!session.countdown?.paused)}>{session.countdown.paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}{session.countdown.paused ? "Retomar" : "Pausar"}</Button></div> : null}
                  </div>
                  {session.callStatus === "ended" && !session.countdown ? <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2"><Button variant="primary" size="lg" className="min-h-12 rounded-full" disabled={busy} loading={busy} onClick={() => void classify("interested")}><Heart className="size-4" aria-hidden="true" /> Com interesse</Button><Button variant="secondary" size="lg" className="min-h-12 rounded-full" disabled={busy} onClick={() => void classify("not_interested")}><X className="size-4" aria-hidden="true" /> Sem interesse</Button></div> : null}
                </> : <div className="py-16 text-center"><Check className="mx-auto size-10 text-(--success)" aria-hidden="true" /><h2 className="mt-4 text-2xl font-semibold text-(--foreground)">Demonstração concluída</h2><p className="mt-2 text-sm text-(--text-secondary)">Os contatos continuam fictícios e não foram salvos.</p><Button className="mt-6 min-h-11 rounded-full" variant="secondary" onClick={() => void start()}>Recomeçar</Button></div>}
              </article>

              {session.next ? <article className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-(--border) bg-(--surface) px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-(--surface-muted) text-(--text-secondary)"><ArrowRight className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Próximo contato</p><p className="mt-1 text-sm font-semibold text-(--foreground)">{session.next.name}</p></div></div><span className="text-sm tabular-nums text-(--text-secondary)">{session.next.phone}</span></article> : null}

              {isLab ? <article className="rounded-[1.5rem] border border-(--border) bg-(--surface) p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-(--accent-subtle) text-(--accent-strong)"><Smartphone className="size-5" aria-hidden="true" /></span><div><h3 className="font-semibold text-(--foreground)">Celular da demonstração</h3><p className="text-xs text-(--text-secondary)">Conectado à conta de {brokerFirstName}</p></div></div><Button size="md" variant="secondary" className="min-h-11 rounded-full" disabled={simulating || session.callStatus !== "ready"} loading={simulating} onClick={() => void simulateLabCall()}><PhoneCall className="size-4" aria-hidden="true" />{simulating ? "Simulando…" : "Simular ligação"}</Button></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-(--text-muted)"><span className="rounded-full bg-(--surface-muted) px-3 py-1.5">{statusLabel(session.callStatus)}</span><span>Número fictício, sem discagem real</span></div></article> : null}
            </section>
          </div>
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
            <p className="mt-2 text-sm tabular-nums text-(--text-secondary)">{session.current.phone}</p>
            <a href={`tel:${session.current.phone.replace(/[^+\d]/g, "")}`} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-full border border-(--border-strong) px-5 text-sm font-semibold text-(--foreground)"><Phone className="size-4" aria-hidden="true" /> Ligar</a>
            <Button variant="primary" size="lg" className="mt-3 min-h-12 w-full rounded-full" disabled={!deviceToken || simulating || session.callStatus !== "ready"} loading={simulating} onClick={() => void simulate()}><PhoneCall className="size-4" aria-hidden="true" />{simulating ? statusLabel(session.callStatus) : session.callStatus === "ended" ? "Ligação encerrada" : "Simular"}</Button>
            <p className="mt-3 text-center text-xs text-(--text-muted)">{session.callStatus === "ready" ? "A simulação mostra os estados no computador." : statusLabel(session.callStatus)}{session.callStatus === "active" ? ` · ${clock(session.callElapsedSeconds)}` : ""}</p>
          </section> : <section className="mt-5 rounded-[2rem] border border-(--border) bg-(--surface) p-6 text-center"><Check className="mx-auto size-8 text-(--success)" aria-hidden="true" /><p className="mt-3 font-semibold text-(--foreground)">Fila de demonstração concluída</p></section>}
          <p className="mt-auto pt-6 text-center text-xs leading-5 text-(--text-muted)">Nenhuma ligação real é iniciada por este botão. O link Ligar abre o discador do celular com um número fictício.</p>
        </>}
      </div>
    </main>
  );
}
