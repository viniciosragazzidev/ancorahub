"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WhatsappLogo } from "@/components/huge-icons";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { wahaActionCodeFromMessage, wahaActionErrorMessage } from "@/lib/waha-error-codes";
import {
  derivePairingPhase,
  FIRST_QR_LIFETIME_SECONDS,
  PAIRING_STALL_SECONDS,
  ROTATED_QR_LIFETIME_SECONDS,
  type PairingPhase,
} from "@/features/waha-cadence/pairing-phase";
import {
  forceDisconnectWhatsAppSession,
  getWhatsAppConnection,
  getWhatsAppPairingPhone,
  pollWhatsAppConnection,
  requestWhatsAppPairingCode,
  resetWhatsAppSessionAction,
  startWhatsAppConnection,
  toggleWhatsAppChatAction,
} from "@/app/(dashboard)/settings/whatsapp-actions";
import { PAIRING_BADGE_LABELS, PAIRING_TOASTS, type PairingMethod } from "@/features/waha-cadence/pairing-copy";
import { FadeSwap, PairingCodePanel, PairingGuide, PairingQrPanel, PairingStepper } from "./whatsapp-pairing-panel";

type Connection = Awaited<ReturnType<typeof getWhatsAppConnection>>;
type PollSnapshot = Extract<Awaited<ReturnType<typeof pollWhatsAppConnection>>, { success: true }>;

const PHASE_BADGE_STATUS: Record<PairingPhase, DsStatusBadgeStatus> = {
  idle: "secondary",
  starting: "info",
  qr: "info",
  pairing: "info",
  ready: "success",
  error: "destructive",
};

/** Quanto tempo a tela de sucesso permanece antes de o dialog fechar sozinho. */
const SUCCESS_HOLD_MS = 1_600;
/** Um QR ausente por mais que isto além da validade estimada deixa de ser exibido. */
const QR_GRACE_SECONDS = 15;
/** Depois de fechado, o pareamento pendente continua sendo verificado por este tempo. */
const BACKGROUND_WATCH_MS = 10 * 60_000;
/** Intervalo de verificação com o dialog fechado (aberto: 1–1,5 s). */
const BACKGROUND_INTERVAL_MS = 3_000;
/** Reinícios automáticos de sessão sumida/expirada por tentativa de conexão. */
const MAX_AUTO_RESTARTS = 2;

/** Leitura de relógio para handlers de eventos (fora do render). */
const clock = () => Date.now();

/** Pedidos seguidos enquanto a sessão ainda sobe (cada um espera ~1,5 s). */
const MAX_CODE_ATTEMPTS = 15;
const PAIRING_METHOD_OPTIONS = [
  { value: "qr", label: "QR Code" },
  { value: "code", label: "Código" },
] as const;

/**
 * Celular ou tablet: o QR apareceria no mesmo aparelho que teria de lê-lo,
 * então o código de pareamento é o padrão (tela estreita ou toque como
 * ponteiro principal).
 */
function prefersPairingCode() {
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function errorMessage(code?: string | null): string {
  return wahaActionErrorMessage(code);
}

export function WhatsAppConnectDialog({
  initial,
  returnTo,
  triggerLabel = "Conectar WhatsApp",
  connectedLabel = "WhatsApp conectado",
  open: controlledOpen,
  onConnectionChanged,
  onOpenChange,
  trigger,
}: {
  /** A custom trigger (e.g. the round status button of the Lite); default is the labeled button. */
  trigger?: React.ReactElement;
  initial: Connection;
  returnTo?: string;
  triggerLabel?: string;
  connectedLabel?: string;
  /** Allows another CTA to open this dialog without an additional visible trigger. */
  open?: boolean;
  onConnectionChanged?: (connection?: Connection) => void;
  /** Permite ao pai manter o dialog montado enquanto ele estiver aberto. */
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [pending, startTransition] = useTransition();

  function updateOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  // ── Estado do pareamento ────────────────────────────────────────────
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [sawQr, setSawQr] = useState(false);
  const [qrKey, setQrKey] = useState(0);
  const [qrShownAt, setQrShownAt] = useState<number | null>(null);
  const [qrLifetime, setQrLifetime] = useState(FIRST_QR_LIFETIME_SECONDS);
  const [pairingSince, setPairingSince] = useState<number | null>(null);
  const [phoneSuffix, setPhoneSuffix] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState<"unreachable" | "unauthorized" | null>(null);
  const [renewing, setRenewing] = useState(false);
  // Pareamento pendente com o dialog fechado: a verificação continua em segundo plano.
  const [watching, setWatching] = useState(false);
  // ── Código de pareamento (alternativa ao QR; padrão no celular) ──────
  const [method, setMethod] = useState<PairingMethod>("qr");
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeExpired, setCodeExpired] = useState(false);
  const [codeCooldownUntil, setCodeCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Refs espelham o que o loop de polling (fechado em um efeito) precisa ler
  // sem recriar o timer a cada render.
  const qrRef = useRef<string | null>(null);
  const sawQrRef = useRef(false);
  const firstQrRef = useRef(true);
  const connectingRef = useRef(false);
  const acting = useRef(false);
  const polling = useRef(false);
  const pollingFailures = useRef(0);
  const autoRestarts = useRef(0);
  const lastStartAt = useRef(0);
  const watchDeadline = useRef(0);
  const successTimer = useRef<number | null>(null);
  const wake = useRef<(() => void) | null>(null);
  const intervalMs = useRef(1_000);
  const openRef = useRef(false);
  const methodChosen = useRef(false);
  const phoneLoaded = useRef(false);
  const pairingCodeRef = useRef<string | null>(null);
  const generatingRef = useRef(false);

  const ready = connection.status === "ready";
  const secondsLeft = qrShownAt ? Math.min(qrLifetime, Math.ceil(qrLifetime - (now - qrShownAt) / 1_000)) : qrLifetime;
  // Um QR só é considerado exibível enquanto não passou muito da validade
  // estimada; depois disso a interface volta a "gerando" em vez de mostrar um
  // código morto.
  const hasQr = Boolean(connection.qrCode) && secondsLeft > -QR_GRACE_SECONDS;
  // No código, "pronto para ler" é a sessão aguardando autenticação (o QR em
  // si nunca aparece) ou um código já na tela.
  const awaitingAuth = method === "code" ? providerStatus === "SCAN_QR_CODE" || Boolean(pairingCode) : hasQr;
  const phase: PairingPhase = ready
    ? "ready"
    : derivePairingPhase({ status: connection.status, providerStatus, hasQr: awaitingAuth, sawQr });
  const stalled = phase === "pairing" && pairingSince !== null && now - pairingSince > PAIRING_STALL_SECONDS * 1_000;
  const badge = {
    status: PHASE_BADGE_STATUS[phase],
    label: method === "code" && phase === "qr" ? PAIRING_BADGE_LABELS.code : PAIRING_BADGE_LABELS[phase],
  };
  const codeCooldownSeconds = Math.max(0, Math.ceil((codeCooldownUntil - now) / 1_000));

  // Fase visível → ticker de 250 ms só enquanto há contagem/estagnação a exibir.
  const ticking = phase === "qr" || phase === "pairing" || codeCooldownUntil > now;
  useEffect(() => {
    if (!open || !ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [open, ticking]);

  // O servidor é a autoridade inicial, mas nunca sobrescreve o estado vivo
  // enquanto o dialog está aberto (o polling do badge lê o banco, que pode
  // estar um ciclo atrás do que este dialog acabou de observar).
  useEffect(() => {
    if (open) return;
    setConnection((current) =>
      current.sessionId === initial.sessionId && current.status === initial.status ? current : initial,
    );
  }, [initial, open]);

  useEffect(() => () => {
    if (successTimer.current) window.clearTimeout(successTimer.current);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────

  function recoverFromOutdatedAction(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    if (!/failed to find server action|older or newer deployment|fetch failed|failed to fetch/i.test(message)) return false;
    toast.info("O CorreTop foi atualizado. Carregando a versão atual da página...");
    window.setTimeout(() => window.location.reload(), 500);
    return true;
  }

  function showUnexpectedActionError(error: unknown) {
    if (recoverFromOutdatedAction(error)) return;
    const msg = error instanceof Error ? error.message : String(error);
    toast.error(msg || "Não foi possível conectar ao WhatsApp. Tente novamente.", { duration: 8_000 });
  }

  function noteSuccess() {
    pollingFailures.current = 0;
    setConnectivity(null);
  }

  function noteFailure(code?: string | null) {
    pollingFailures.current += 1;
    // Falhas isoladas são ruído (rede, rotação de sessão). Só uma sequência
    // vira aviso inline — sem um toast a cada ciclo.
    if (pollingFailures.current >= 3) setConnectivity(code === "WAHA_UNAUTHORIZED" ? "unauthorized" : "unreachable");
  }

  function resetAttempt() {
    qrRef.current = null;
    sawQrRef.current = false;
    firstQrRef.current = true;
    setSawQr(false);
    setQrShownAt(null);
    setQrLifetime(FIRST_QR_LIFETIME_SECONDS);
    setPairingSince(null);
    setProviderStatus(null);
    setRenewing(false);
  }

  function showQr(qr: string) {
    if (qrRef.current === qr) return;
    qrRef.current = qr;
    sawQrRef.current = true;
    setSawQr(true);
    setQrKey((key) => key + 1);
    setQrShownAt(Date.now());
    setQrLifetime(firstQrRef.current ? FIRST_QR_LIFETIME_SECONDS : ROTATED_QR_LIFETIME_SECONDS);
    firstQrRef.current = false;
    setPairingSince(null);
    setRenewing(false);
    setConnection((current) => ({ ...current, status: "initializing", qrCode: qr }));
  }

  function markReady(phone?: string | null) {
    const celebrate = connectingRef.current && open;
    const completedInBackground = connectingRef.current && !open;
    connectingRef.current = false;
    setWatching(false);
    qrRef.current = null;
    if (phone) setPhoneSuffix(phone.slice(-4));
    setRenewing(false);
    setConnection((current) => ({
      ...current,
      status: "ready",
      qrCode: null,
      chatInternoAtivo: true,
      connectedAt: current.connectedAt ?? new Date(),
    }));
    router.refresh();

    if (!celebrate) {
      if (completedInBackground) toast.success(PAIRING_TOASTS.connectedBackground);
      onConnectionChanged?.();
      return;
    }
    toast.success(PAIRING_TOASTS.connected);
    // Mantém a tela de sucesso visível antes de fechar. O pai só é avisado
    // depois: ele pode trocar de árvore ao ver "conectado" e desmontar este
    // dialog no meio da animação.
    successTimer.current = window.setTimeout(() => {
      updateOpen(false);
      onConnectionChanged?.();
      if (returnTo) router.replace(returnTo);
    }, SUCCESS_HOLD_MS);
  }

  function applySnapshot(result: PollSnapshot) {
    setProviderStatus(result.providerStatus);
    if (result.phone) setPhoneSuffix(result.phone.slice(-4));

    if (result.status === "ready") {
      markReady(result.phone);
      return;
    }

    if (result.status === "error") {
      setConnection((current) => ({ ...current, status: "error", qrCode: null }));
      qrRef.current = null;
      // QR exibido e a sessão caiu em FAILED = expirou sem leitura. Renovar
      // sozinho evita que o corretor precise perceber e clicar.
      if (connectingRef.current && autoRestarts.current < MAX_AUTO_RESTARTS) {
        autoRestarts.current += 1;
        runStart({ forceNew: true, auto: true });
      } else {
        connectingRef.current = false;
      }
      return;
    }

    if (result.status === "disconnected") {
      // Fora de uma tentativa de conexão, apenas reflete o estado real.
      if (!connectingRef.current) {
        setConnection((current) => ({ ...current, status: "disconnected", qrCode: null }));
        return;
      }
      // Sessão sumiu (WAHA reiniciado) ou parou durante o pareamento: o start
      // é idempotente e recria/retoma. A janela de 6 s evita reagir ao estado
      // transitório logo após o próprio start.
      if (clock() - lastStartAt.current <= 6_000) return;
      if (autoRestarts.current < MAX_AUTO_RESTARTS) {
        autoRestarts.current += 1;
        runStart({ forceNew: false, auto: true });
      } else {
        connectingRef.current = false;
        setConnection((current) => ({ ...current, status: "error", qrCode: null }));
      }
      return;
    }

    // initializing
    connectingRef.current = true;
    if (result.qrCode) {
      showQr(result.qrCode);
    } else if (result.providerStatus === "SCAN_QR_CODE") {
      // QR em rotação: mantém o anterior até vencer a tolerância; o novo chega
      // no próximo ciclo. Nunca reexibe um código antigo depois disso.
      setConnection((current) => ({ ...current, status: "initializing" }));
    } else {
      // STARTING: sem QR válido. Se já houve QR, é o celular pareando.
      qrRef.current = null;
      setConnection((current) => ({ ...current, status: "initializing", qrCode: null }));
      if (sawQrRef.current) setPairingSince((since) => since ?? Date.now());
    }
  }

  async function pollOnce() {
    if (polling.current || acting.current) return;
    polling.current = true;
    try {
      const result = await pollWhatsAppConnection();
      if (!result.success) {
        if (result.code !== "NO_SESSION") noteFailure(result.code);
        return;
      }
      noteSuccess();
      applySnapshot(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/WAHA_(?:UNREACHABLE|TIMEOUT|UNAVAILABLE)\b/i.test(message)) {
        noteFailure(wahaActionCodeFromMessage(message));
      } else {
        showUnexpectedActionError(error);
      }
    } finally {
      polling.current = false;
    }
  }

  // O loop lê sempre a versão mais recente (closures frescas) sem reiniciar.
  const pollRef = useRef(pollOnce);
  useEffect(() => {
    pollRef.current = pollOnce;
    openRef.current = open;
    intervalMs.current = phase === "qr" ? 1_500 : 1_000;
  });

  // ── Loop de polling ─────────────────────────────────────────────────
  // Auto-agendado (não setInterval): uma consulta lenta nunca empilha outra, e
  // um evento de "acordar" (aba visível, fim de uma ação) dispara na hora.
  // Fechar o dialog no meio do pareamento não interrompe a verificação: ela
  // segue em segundo plano (mais espaçada) até conectar ou vencer a janela.
  const loopActive = Boolean(connection.sessionId) && !ready && (open || watching);
  useEffect(() => {
    if (!loopActive) return;
    let cancelled = false;
    void (async () => {
      while (!cancelled) {
        await pollRef.current();
        if (cancelled) break;
        if (!openRef.current && clock() > watchDeadline.current) {
          setWatching(false);
          break;
        }
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, openRef.current ? intervalMs.current : BACKGROUND_INTERVAL_MS);
          wake.current = () => { window.clearTimeout(timer); resolve(); };
        });
      }
    })();
    return () => {
      cancelled = true;
      wake.current?.();
      wake.current = null;
    };
  }, [loopActive]);

  useEffect(() => {
    if (!open && !watching) return;
    function onVisibilityChange() {
      if (document.visibilityState === "visible") wake.current?.();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [open, watching]);

  // ── Ações ───────────────────────────────────────────────────────────

  function openWhatsAppExternal() {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      // Keep the native-app handoff in the user's current mobile/PWA context.
      window.open("whatsapp://send", "_self");
      return;
    }
    window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  }

  /**
   * Inicia (ou retoma) a conexão.
   * - `forceNew: false` é idempotente: reutiliza a sessão viva, retoma uma
   *   parada e nunca desvincula um aparelho já conectado.
   * - `forceNew: true` recria a sessão para invalidar o QR atual; só é usado
   *   por ação explícita do corretor ou por expiração confirmada.
   */
  function runStart({ forceNew, auto = false }: { forceNew: boolean; auto?: boolean }) {
    if (!auto) autoRestarts.current = 0;
    resetAttempt();
    // Uma sessão nova invalida o código já mostrado: o corretor precisa de outro.
    if (pairingCodeRef.current) {
      if (auto) setCodeExpired(true);
      pairingCodeRef.current = null;
      setPairingCode(null);
    }
    // Renovação automática: recomeça o ciclo do zero (senão o "já houve QR"
    // faria a tela parecer pós-scan), mas sinaliza que é uma renovação.
    if (auto) setRenewing(true);
    connectingRef.current = true;
    lastStartAt.current = clock();
    acting.current = true;
    setConnection((current) => ({ ...current, status: "initializing", qrCode: null, connectedAt: null }));

    startTransition(async () => {
      try {
        const result = await startWhatsAppConnection({ forceNew });
        if (!result.success) {
          connectingRef.current = false;
          setRenewing(false);
          setConnection((current) => ({ ...current, status: "error", qrCode: null }));
          toast.error(errorMessage((result as { code?: string }).code), { duration: 8_000 });
          return;
        }
        setConnection((current) => ({
          ...current,
          sessionId: result.sessionId ?? current.sessionId,
          sessionName: result.sessionId ?? current.sessionName,
          status: result.status ?? "initializing",
        }));
        setProviderStatus(result.providerStatus ?? null);
        if (result.status === "ready") {
          markReady();
        } else if (result.qrCode) {
          showQr(result.qrCode);
        }
      } catch (error) {
        connectingRef.current = false;
        setRenewing(false);
        setConnection((current) => ({ ...current, status: "error", qrCode: null }));
        showUnexpectedActionError(error);
      } finally {
        acting.current = false;
        // Sem esperar o próximo tick: o QR/estado real aparece já.
        wake.current?.();
      }
    });
  }

  function loadPairingPhone() {
    if (phoneLoaded.current) return;
    phoneLoaded.current = true;
    void getWhatsAppPairingPhone()
      .then((result) => {
        // O campo guarda DDD + número; o 55 é fixo na tela.
        if (result.phone) setPairingPhone((current) => current || result.phone!.slice(2));
      })
      .catch(() => { phoneLoaded.current = false; });
  }

  function chooseMethod(next: PairingMethod) {
    methodChosen.current = true;
    setMethod(next);
    if (next === "code") loadPairingPhone();
  }

  /**
   * Pede o código ao WhatsApp. Enquanto a sessão ainda sobe, o servidor
   * responde sem código e o pedido se repete sozinho por alguns segundos.
   */
  async function generatePairingCode() {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGeneratingCode(true);
    setCodeExpired(false);
    try {
      if (!connection.sessionId && !connectingRef.current) runStart({ forceNew: false });
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const result = await requestWhatsAppPairingCode({ phone: `55${pairingPhone}` });
        if (result.success && result.pairingCode) {
          pairingCodeRef.current = result.pairingCode;
          setPairingCode(result.pairingCode);
          connectingRef.current = true;
          // Sair de SCAN_QR_CODE depois disto = o celular aceitou o código.
          sawQrRef.current = true;
          setSawQr(true);
          setCodeCooldownUntil(clock() + 30_000);
          setNow(clock());
          return;
        }
        if (result.success || result.code === "NO_SESSION") {
          await sleep(result.success ? (result.retryInMs ?? 1_500) : 1_500);
          continue;
        }
        if (result.code === "PAIRING_COOLDOWN") {
          setCodeCooldownUntil(clock() + ("retryInMs" in result && result.retryInMs ? result.retryInMs : 30_000));
          setNow(clock());
          return;
        }
        if (result.code === "ALREADY_CONNECTED") {
          wake.current?.();
          return;
        }
        toast.error(
          result.code === "INVALID_PHONE"
            ? "Confira o número: DDD + celular."
            : result.code === "PAIRING_CODE_UNSUPPORTED"
              ? "O servidor do WhatsApp ainda não aceita código. Use o QR Code por enquanto."
              : errorMessage(result.code),
          { duration: 8_000 },
        );
        return;
      }
      toast.error("O WhatsApp demorou para liberar o código. Tente de novo.");
    } catch (error) {
      showUnexpectedActionError(error);
    } finally {
      generatingRef.current = false;
      setGeneratingCode(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    updateOpen(nextOpen);

    if (nextOpen) {
      setWatching(false);
      if (!methodChosen.current) setMethod(prefersPairingCode() ? "code" : "qr");
      if (!ready && (methodChosen.current ? method === "code" : prefersPairingCode())) loadPairingPhone();
      // Abrir NÃO recria a sessão: o start idempotente reutiliza a sessão viva.
      // (Recriar aqui desvinculava o aparelho de quem abria o dialog com o
      // WAHA já conectado e o CRM ainda desatualizado.)
      if (ready) {
        if (connection.sessionId) void pollOnce();
      } else {
        runStart({ forceNew: false });
      }
      return;
    }

    if (successTimer.current) {
      window.clearTimeout(successTimer.current);
      successTimer.current = null;
      onConnectionChanged?.();
    }
    if (connection.sessionId && !ready) {
      if (connectingRef.current) {
        watchDeadline.current = clock() + BACKGROUND_WATCH_MS;
        setWatching(true);
      }
      void pollOnce().then(() => router.refresh());
    }
  }

  function toggle() {
    startTransition(async () => {
      try {
        const result = await toggleWhatsAppChatAction();
        if (!result.success) toast.error(result.error);
        else {
          setConnection((current) => ({ ...current, chatInternoAtivo: result.active ?? current.chatInternoAtivo }));
          toast.success(result.active ? "Chat interno ativado." : "Chat interno desativado.");
        }
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function clearLocalSession() {
    resetAttempt();
    pairingCodeRef.current = null;
    setPairingCode(null);
    connectingRef.current = false;
    setPhoneSuffix(null);
    setConnection((current) => ({
      ...current,
      sessionId: null,
      sessionName: null,
      qrCode: null,
      status: "disconnected",
      connectedAt: null,
    }));
  }

  function disconnect() {
    startTransition(async () => {
      try {
        const result = await resetWhatsAppSessionAction();
        if (!result.success) {
          // Se o VPS está inacessível, oferecer opção de forçar desconexão local
          if (result.code === "WAHA_UNREACHABLE" || result.code === "WAHA_TIMEOUT") {
            toast.error(
              "O servidor WhatsApp está inacessível. Você pode forçar a desconexão local, mas a sessão remota pode permanecer ativa até o timeout do servidor.",
              { duration: 10_000, action: { label: "Forçar desconexão", onClick: () => forceDisconnect() } },
            );
          } else {
            toast.error(errorMessage(result.code));
          }
          return;
        }
        clearLocalSession();
        onConnectionChanged?.();
        toast.success("WhatsApp desconectado.");
        router.refresh();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function forceDisconnect() {
    startTransition(async () => {
      try {
        const result = await forceDisconnectWhatsAppSession();
        if (!result.success) {
          toast.error("Não foi possível limpar a sessão local.");
          return;
        }
        clearLocalSession();
        onConnectionChanged?.();
        toast.success("Sessão desconectada localmente. A sessão remota será encerrada automaticamente pelo servidor.");
        router.refresh();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────

  const canGenerateNewQr = phase === "qr" || phase === "pairing" || phase === "starting";
  // Fases finais (finalizando, conectado) são as mesmas nos dois métodos.
  const cardKey = method === "code" && phase !== "pairing" && phase !== "ready" ? "code" : `qr-${phase === "pairing" || phase === "ready" ? "end" : "scan"}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger || controlledOpen === undefined ? (
        <DialogTrigger render={trigger ?? <Button variant={ready ? "outline" : "default"}><WhatsappLogo /> {ready ? connectedLabel : triggerLabel}</Button>} />
      ) : null}
      <DialogPopup className="max-w-2xl">
        <div className="flex items-start justify-between gap-ds-16">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2"><WhatsappLogo className="text-success" /> WhatsApp</DialogTitle>
            <DialogDescription className="mt-2">
              Vincule o WhatsApp do seu celular para atender seus leads por aqui.
            </DialogDescription>
            <div className="mt-ds-12">
              <PairingStepper phase={phase} method={method} />
            </div>
          </div>
          <DsStatusBadge status={badge.status} label={badge.label} className="shrink-0" />
        </div>

        {!ready && phase !== "pairing" && (
          <DsSegmentedControl
            aria-label="Como conectar"
            className="w-full md:w-auto [&>button]:flex-1 [&>button]:justify-center md:[&>button]:flex-none"
            options={PAIRING_METHOD_OPTIONS}
            value={method}
            onValueChange={(next) => chooseMethod(next as PairingMethod)}
          />
        )}

        <div className="grid gap-ds-16 md:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-ds-12">
            <PairingGuide
              phase={phase}
              phoneSuffix={phoneSuffix}
              stalled={stalled}
              connectivity={connectivity}
              renewing={renewing}
              method={method}
              hasCode={Boolean(pairingCode)}
            />

            <div className={method === "qr" ? "flex flex-wrap gap-ds-8" : "hidden"}>
              {phase === "idle" && (
                <Button disabled={pending} onClick={() => runStart({ forceNew: false })}>Conectar WhatsApp</Button>
              )}
              {phase === "error" && (
                <Button disabled={pending} onClick={() => runStart({ forceNew: true })}>Gerar novo QR</Button>
              )}
              {canGenerateNewQr && (
                <Button disabled={pending} onClick={() => runStart({ forceNew: true })} variant="outline">
                  Gerar novo QR
                </Button>
              )}
            </div>
            {ready && (
              <div className="flex flex-wrap gap-ds-8">
                <Button disabled={pending} onClick={toggle} variant="outline" size="sm">
                  {connection.chatInternoAtivo ? "Desativar chat" : "Ativar chat"}
                </Button>
                <Button disabled={pending} onClick={disconnect} variant="outline" size="sm">
                  Desconectar
                </Button>
              </div>
            )}

            {!(method === "code" && pairingCode && !ready) && (
              <Button className="w-full md:w-auto" onClick={openWhatsAppExternal} size="sm" variant="outline">
                <WhatsappLogo className="size-4" /> Abrir WhatsApp Web ou app
              </Button>
            )}
          </div>

          {/* No celular o cartão vem primeiro: é nele que a conexão acontece. */}
          <FadeSwap swapKey={cardKey} className="order-first md:order-none">
            {cardKey === "code" ? (
              <PairingCodePanel
                phase={phase}
                phone={pairingPhone}
                onPhoneChange={setPairingPhone}
                code={pairingCode}
                generating={generatingCode}
                cooldownSeconds={codeCooldownSeconds}
                expired={codeExpired}
                onGenerate={() => void generatePairingCode()}
                onOpenWhatsApp={openWhatsAppExternal}
              />
            ) : (
              <PairingQrPanel
                phase={phase}
                qrCode={hasQr ? connection.qrCode : null}
                secondsLeft={secondsLeft}
                lifetime={qrLifetime}
                qrKey={qrKey}
              />
            )}
          </FadeSwap>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
