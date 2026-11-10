"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { openWhatsAppApp } from "@/components/whatsapp/open-whatsapp-app";
import { PresenceTutorialVideo } from "@/components/whatsapp/presence-tutorial-video";
import { PRESENCE_GUIDE_COPY as COPY } from "@/features/waha-cadence/pairing-copy";
import { cn } from "@/utils/core/cn";

import {
  AttentionArt, BeforeOpenArt, BigCheck, CodeLoading, SpeakerIcon, CameraIcon, CheckIcon, CloseIcon, CopyIcon, guideEase, HomeScreenArt, LockIcon, PhoneMock,
  Tiles, WaIcon, WaitDots, WaitingMock, WelcomeArt,
} from "./presence-guide-art";
import {
  guideError, narrationKey, platformFromUserAgent, progressOf, readGuideMemory, resumeStep, visibleStep, writeGuideMemory,
  type ConfirmStage, type GuideDevice, type GuideError, type GuideMode, type GuidePlatform, type GuideStep, type LocalIssue,
} from "./presence-guide-steps";
import styles from "./presence-guide.module.css";

/**
 * Roteiro guiado "conectar o WhatsApp e confirmar presença" (09/11, plano 2026-11-09-roteiro-guiado-presenca-whatsapp.md).
 * Uma ideia e um botão por tela, conduzido pelo mascote do Plantão. A conexão de verdade continua no
 * WhatsAppConnectDialog (que passa `connection`); a presença, no cartão de presença (que passa `presence`).
 * Celular: boas-vindas → código → tela inicial → caminho → esperando → conectado → confirmar → pronto.
 * Computador: boas-vindas → QR (ou código) com o caminho ao lado → conectado → confirmar → pronto.
 */
export type PresenceGuideConnection = {
  ready: boolean;
  phase: "idle" | "starting" | "qr" | "pairing" | "ready" | "error";
  method: "qr" | "code";
  onMethodChange: (method: "qr" | "code") => void;
  qrCode: string | null;
  started: boolean;
  onStart: () => void;
  phone: string;
  phoneValid: boolean;
  /** O número do cadastro já foi consultado (sem ele, a etapa do número aparece). */
  phoneChecked: boolean;
  onPhoneChange: (phone: string) => void;
  code: string | null;
  generating: boolean;
  expired: boolean;
  cooldownSeconds: number;
  stalled: boolean;
  connectivity: "unreachable" | "unauthorized" | null;
  issue: string | null;
  onGenerate: () => void;
};

export type PresenceGuideDuty = { key: string; scheduleName: string; branchName: string | null; mode: "online" | "presencial"; until: string };

export type PresenceGuidePresence = {
  stage: ConfirmStage;
  error?: string | null;
  confirmedAt?: string | null;
  /** Reaberto porque o WhatsApp caiu no meio (409 whatsapp_required). */
  reconnect?: boolean;
  onConfirm: () => void;
  onFinish: () => void;
};

/** Só para o protótipo (/dev/roteiro-presenca) e testes: abre direto numa etapa ou estado. */
export type PresenceGuidePreview = { step?: GuideStep; scene?: number; local?: LocalIssue | null; copied?: boolean; sheet?: "ajuda" | "sair" | "abrir" | null; platform?: GuidePlatform };

/**
 * Narração de cada etapa (10/11): um áudio curto (até ~10 s) por etapa, em {base}/{chave}.mp3. Textos em
 * PRESENCE_GUIDE_NARRATION (pairing-copy.ts); a chave vem de narrationKey (presence-guide-steps.ts).
 */
export const PRESENCE_GUIDE_VOICE_BASE = "/onboarding/narracao/presenca";
const VOICE_MUTE_KEY = "ancora:presenca-guia:voz-desligada";

export function PresenceGuide({ device, connection, duty, presence, onClose, openWhatsApp, preview, voiceBase = PRESENCE_GUIDE_VOICE_BASE, mode = "presence" }: {
  device: GuideDevice;
  connection: PresenceGuideConnection;
  duty: PresenceGuideDuty;
  presence: PresenceGuidePresence;
  onClose: () => void;
  /** Troca o jeito de abrir o app (protótipo). Padrão: só abre o app, sem conversa. */
  openWhatsApp?: (onMissing: () => void) => void;
  preview?: PresenceGuidePreview;
  /** Pasta dos áudios da narração; null desliga a voz. */
  voiceBase?: string | null;
  /** "connect": só conectar (botão do WhatsApp no topo); termina em "conectado" com "Pronto". */
  mode?: GuideMode;
}) {
  const connectOnly = mode === "connect";
  const reduce = useReducedMotion();
  const desktop = device === "desktop";
  const [localStep, setLocalStep] = React.useState<GuideStep>(preview?.step ?? (connection.started ? "codigo" : "boasvindas"));
  const [scene, setScene] = React.useState(preview?.scene ?? 0);
  const [platform, setPlatform] = React.useState<GuidePlatform>(preview?.platform ?? "android");
  const [copied, setCopied] = React.useState(preview?.copied ?? false);
  const [local, setLocal] = React.useState<LocalIssue | null>(preview?.local ?? null);
  const [sheet, setSheet] = React.useState<"ajuda" | "sair" | "abrir" | null>(preview?.sheet ?? null);
  // O que fazer depois de abrir o WhatsApp pelo aviso "Quando o WhatsApp abrir" (seguir para a próxima etapa).
  const afterOpen = React.useRef<(() => void) | null>(null);
  const [video, setVideo] = React.useState(false);
  const [showSteps, setShowSteps] = React.useState(false);
  const notOpenedTimer = React.useRef<number | null>(null);
  // Narração: cada etapa toca a sua sozinha (quando o navegador deixa); o corretor pode parar ou ouvir de novo.
  const voice = React.useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = React.useState(false);

  // Retomada: o tipo de celular vem do aparelho; a etapa, da lembrança deste plantão.
  React.useEffect(() => {
    if (preview) return;
    /* eslint-disable react-hooks/set-state-in-effect -- lê o aparelho e a lembrança uma vez, ao abrir */
    const memory = readGuideMemory(duty.key);
    setPlatform(memory?.platform ?? platformFromUserAgent(window.navigator.userAgent));
    const resume = resumeStep(memory, Date.now());
    if (resume && !connection.ready) {
      if (!connection.started) connection.onStart();
      setLocalStep(resume);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, []);

  const step = visibleStep({ local: localStep, device, ready: connection.ready, stage: presence.stage });

  function playVoice() {
    if (!voiceBase || !narration || typeof Audio === "undefined") return;
    const src = `${voiceBase}/${narration}.mp3`;
    if (!voice.current) {
      const audio = new Audio(src);
      audio.addEventListener("ended", () => setSpeaking(false));
      audio.addEventListener("pause", () => setSpeaking(false));
      audio.addEventListener("play", () => setSpeaking(true));
      voice.current = audio;
    } else if (!voice.current.src.endsWith(src)) {
      voice.current.src = src;
    }
    voice.current.currentTime = 0;
    try {
      // Sem toque recente, o navegador pode recusar o som: fica o botão "Ouvir a explicação".
      void Promise.resolve(voice.current.play()).catch(() => setSpeaking(false));
    } catch {
      setSpeaking(false);
    }
  }

  function toggleVoice() {
    if (speaking) {
      voice.current?.pause();
      try { window.localStorage.setItem(VOICE_MUTE_KEY, "1"); } catch { /* sem armazenamento: só para agora */ }
      return;
    }
    try { window.localStorage.removeItem(VOICE_MUTE_KEY); } catch { /* idem */ }
    playVoice();
  }

  const error: GuideError | null = guideError({ step, device, facts: connection, local, stage: presence.stage });
  const narration = narrationKey({ step, scene, platform, device, mode, method: connection.method, dutyMode: duty.mode, stage: presence.stage, error });

  // Vigia do código (10/11): se o código não chega e nada está sendo pedido, pede de novo sozinho (até 2 vezes);
  // se mesmo assim não vier, ou passar de 45 s esperando, a tela troca o carregamento por "Tentar de novo".
  const waitingCode = !error && step === "codigo" && connection.started && !connection.code && (!desktop || connection.method === "code");
  const codeKicks = React.useRef(0);
  React.useEffect(() => {
    if (!waitingCode) {
      codeKicks.current = 0;
      return;
    }
    if (connection.generating || (connection.phoneChecked && !connection.phoneValid) || !connection.phoneChecked) return;
    // A cada 2,5 s parado sem código: pede de novo (2 vezes) e depois desiste com "Tentar de novo".
    const timer = window.setInterval(() => {
      if (codeKicks.current >= 2) {
        window.clearInterval(timer);
        setLocal("codeTimeout");
        return;
      }
      codeKicks.current += 1;
      connection.onGenerate();
    }, 2_500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando muda a espera ou o pedido em andamento
  }, [waitingCode, connection.generating, connection.phoneChecked, connection.phoneValid]);
  React.useEffect(() => {
    if (!waitingCode) return;
    const timer = window.setTimeout(() => setLocal("codeTimeout"), 45_000);
    return () => window.clearTimeout(timer);
  }, [waitingCode]);

  // Ao entrar em cada etapa (e em cada toque do caminho), a narração dela começa sozinha, a não ser que o
  // corretor tenha parado a voz antes. Com erro na tela, a voz para.
  React.useEffect(() => {
    if (!narration) {
      voice.current?.pause();
      return;
    }
    let muted = false;
    try { muted = window.localStorage.getItem(VOICE_MUTE_KEY) === "1"; } catch { /* sem armazenamento */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia o áudio (sistema externo); o estado vem dos eventos dele
    if (!muted) playVoice();
    return () => voice.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por narração
  }, [narration]);
  // Some da tela: a voz não fica tocando.
  React.useEffect(() => () => voice.current?.pause(), []);

  // Lembra onde parou (até a presença sair); limpa ao terminar.
  React.useEffect(() => {
    if (preview) return;
    if (presence.stage === "done" || presence.stage === "waiting") writeGuideMemory(duty.key, null);
    else if (!connection.ready) writeGuideMemory(duty.key, { step: localStep, platform, at: Date.now() });
  }, [preview, duty.key, localStep, platform, presence.stage, connection.ready]);

  // Sem número válido no cadastro, pede o número antes do código.
  React.useEffect(() => {
    if (localStep !== "codigo" || !connection.started || !connection.phoneChecked || connection.phoneValid || connection.code || connection.generating) return;
    if (desktop && connection.method === "qr") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- segue o número consultado no servidor
    setLocalStep("numero");
  }, [localStep, desktop, connection.started, connection.phoneChecked, connection.phoneValid, connection.code, connection.generating, connection.method]);

  // Código novo: precisa copiar de novo.
  React.useEffect(() => {
    if (preview?.copied) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- acompanha o código vindo do WhatsApp
    setCopied(false);
  }, [connection.code, preview?.copied]);

  // Copiou: segue sozinho para a tela inicial.
  React.useEffect(() => {
    if (!copied || preview?.copied || step !== "codigo" || desktop) return;
    const timer = window.setTimeout(() => setLocalStep("telainicial"), 900);
    return () => window.clearTimeout(timer);
  }, [copied, preview, step, desktop]);

  // Saiu para o WhatsApp: o aviso "não abriu" é cancelado.
  React.useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden" && notOpenedTimer.current) {
        window.clearTimeout(notOpenedTimer.current);
        notOpenedTimer.current = null;
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (notOpenedTimer.current) window.clearTimeout(notOpenedTimer.current);
    };
  }, []);

  /** Antes de sair do app, o aviso: tela inicial e 3 pontinhos. O app abre pelo botão do aviso (toque do corretor). */
  function askToOpenWhatsApp(then?: () => void) {
    afterOpen.current = then ?? null;
    setSheet("abrir");
  }

  function confirmOpenWhatsApp() {
    setSheet(null);
    afterOpen.current?.();
    afterOpen.current = null;
    launchWhatsApp();
  }

  function launchWhatsApp() {
    const missing = () => setLocal("notOpened");
    if (openWhatsApp) {
      openWhatsApp(missing);
      return;
    }
    openWhatsAppApp({ onMissing: missing });
    // A página continua visível: o app não abriu.
    if (notOpenedTimer.current) window.clearTimeout(notOpenedTimer.current);
    notOpenedTimer.current = window.setTimeout(() => {
      notOpenedTimer.current = null;
      if (document.visibilityState === "visible") setLocal("notOpened");
    }, 1_800);
  }

  async function copy() {
    if (!connection.code) return;
    try {
      if (!navigator.clipboard) throw new Error("clipboard");
      await navigator.clipboard.writeText(connection.code.replace(/[^A-Z0-9]/gi, ""));
      if ("vibrate" in navigator) navigator.vibrate?.(20);
      setCopied(true);
    } catch {
      setLocal("copyBlocked");
    }
  }

  function regenerate() {
    setLocal(null);
    codeKicks.current = 0;
    setCopied(false);
    setLocalStep("codigo");
    connection.onGenerate();
  }

  function onErrorCta() {
    switch (error) {
      case "issue":
        // Sem número válido, o código nunca sai: leva para a tela do número.
        if (!connection.phoneValid) { setLocal(null); setLocalStep("numero"); return; }
        regenerate();
        return;
      case "expired": case "cooldown": case "stalled": regenerate(); return;
      case "rejected": setLocal(null); setLocalStep("numero"); return;
      case "notOpened": setLocal(null); setLocalStep("esperando"); return;
      case "copyBlocked": setLocal(null); setLocalStep("telainicial"); return;
      case "unstable": case "confirm": presence.onConfirm(); return;
      default:
    }
  }

  function start() {
    connection.onStart();
    setLocalStep("codigo");
  }

  function switchDesktopMethod(next: "qr" | "code") {
    connection.onMethodChange(next);
    if (next === "code" && !connection.code && !connection.generating) {
      if (connection.phoneValid) connection.onGenerate();
      else setLocalStep("numero");
    }
  }

  const { at, total, fill } = progressOf(step, device, mode);

  // ── Cenas ────────────────────────────────────────────────────────────
  let scene$: React.ReactNode;
  let cta$: React.ReactNode;
  if (error) {
    const e = errorView(error, { phone: formatPhone(connection.phone), message: presence.error ?? null });
    scene$ = (
      <>
        <Say title={e.title} sub={e.sub} state="waiting" />
        <div className={styles.art}>
          {error === "copyBlocked" && connection.code ? <Tiles code={connection.code} big />
            : error === "cooldown" ? <span className={styles.checkBig} style={{ background: "var(--surface-muted)", color: "var(--foreground)", fontSize: 28, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{connection.cooldownSeconds}s</span>
              : <AttentionArt />}
        </div>
      </>
    );
    const waiting = error === "cooldown" && connection.cooldownSeconds > 0;
    cta$ = <button type="button" className={styles.cta} disabled={waiting || presence.stage === "sending"} onClick={onErrorCta}>{waiting ? COPY.errors.cooldown.wait(connection.cooldownSeconds) : e.cta}</button>;
  } else {
    switch (step) {
      case "boasvindas":
        scene$ = (
          <>
            <Say title={presence.reconnect ? COPY.welcome.titleReconnect : connectOnly ? COPY.connectOnly.title : COPY.welcome.title} sub={COPY.welcome.sub} state={speaking ? "working" : "idle"} />
            {voiceBase ? (
              <button type="button" className={styles.voice} aria-pressed={speaking} onClick={toggleVoice}>
                <SpeakerIcon on={speaking} /> {speaking ? COPY.welcome.stop : COPY.welcome.listen}
              </button>
            ) : null}
            <div className={styles.art}><WelcomeArt /></div>
            <div className={styles.benefits}>
              {(connectOnly ? COPY.connectOnly.benefits : COPY.welcome.benefits).map((benefit) => <div key={benefit} className={styles.benefit}><span className={styles.benefitIcon}><CheckIcon size={14} /></span><span>{benefit}</span></div>)}
            </div>
            <div className={styles.privacy}><LockIcon /><span><strong>{COPY.welcome.privacyTitle}</strong>{COPY.welcome.privacy}</span></div>
          </>
        );
        cta$ = <button type="button" className={styles.cta} onClick={start}>{COPY.welcome.cta}</button>;
        break;
      case "numero":
        scene$ = (
          <>
            <Say title={COPY.phone.title} sub={COPY.phone.sub} />
            <label className={styles.field}>
              <span className={styles.fieldPrefix}>+55</span>
              <input className={styles.fieldInput} inputMode="numeric" autoComplete="tel-national" placeholder="21987654321" value={connection.phone} onChange={(event) => connection.onPhoneChange(event.target.value.replace(/\D/g, "").slice(0, 11))} aria-label={COPY.phone.label} />
            </label>
          </>
        );
        cta$ = <button type="button" className={styles.cta} disabled={!connection.phoneValid || connection.generating} onClick={() => { if (desktop) connection.onMethodChange("code"); regenerate(); }}>{COPY.phone.cta}</button>;
        break;
      case "codigo":
        if (desktop) {
          const qr = connection.method === "qr";
          scene$ = (
            <>
              <Say title={qr ? COPY.desktop.qrTitle : COPY.desktop.codeTitle} sub={COPY.desktop.sub} state="working" />
              <div className={styles.art} style={{ gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 24, justifyItems: "start" }}>
                {qr
                  // eslint-disable-next-line @next/next/no-img-element -- QR dinâmico em base64
                  ? connection.qrCode ? <img className={styles.qrImg} alt="QR Code para conectar o WhatsApp" src={connection.qrCode.startsWith("data:") ? connection.qrCode : `data:image/png;base64,${connection.qrCode}`} /> : <CodeLoading label={COPY.code.loadingQr} compact />
                  : connection.code ? <Tiles code={connection.code} big /> : <CodeLoading label={COPY.code.loading} compact />}
                <ol className={styles.list}>
                  {COPY.desktop.steps(qr, platform).map((text, index) => <li key={text} className={styles.listItem} data-on={index === 0}><span className={styles.listNum}>{index + 1}</span>{text}</li>)}
                </ol>
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                <span className={styles.caption}>{COPY.desktop.phoneIs}</span>
                <PlatformSwitch value={platform} onChange={setPlatform} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center" }}><WaitDots /><span className={styles.caption}>{COPY.desktop.waiting}</span></div>
            </>
          );
          cta$ = <button type="button" className={styles.link} onClick={() => switchDesktopMethod(qr ? "code" : "qr")}>{qr ? COPY.desktop.useCode : COPY.desktop.useQr}</button>;
          break;
        }
        scene$ = (
          <>
            <Say title={!connection.code ? COPY.code.generating : copied ? COPY.code.copiedTitle : COPY.code.title} sub={connection.code ? COPY.code.sub : undefined} state={connection.code ? "idle" : "working"} />
            <div className={styles.art}>
              {connection.code ? <Tiles code={connection.code} ok={copied} /> : <CodeLoading label={COPY.code.loading} hint={COPY.code.loadingHint} />}
              <span className={styles.copied} role="status">{copied ? <><CheckIcon size={16} /> {COPY.code.copied}</> : null}</span>
            </div>
          </>
        );
        cta$ = <button type="button" className={styles.cta} disabled={!connection.code} onClick={copied ? () => setLocalStep("telainicial") : () => void copy()}>{copied ? COPY.code.next : <><CopyIcon /> {COPY.code.cta}</>}</button>;
        break;
      case "telainicial":
        scene$ = (
          <>
            <Say title={COPY.home.title} sub={COPY.home.sub} />
            <div className={styles.art}>
              <HomeScreenArt platform={platform} />
              <p className={styles.caption}>{COPY.home.captions[platform]}</p>
              <PlatformSwitch value={platform} onChange={setPlatform} />
            </div>
          </>
        );
        // Tutorial antes de sair do app (09/11): a tela inicial e os 4 toques aparecem primeiro; o WhatsApp só
        // abre uma vez, no fim do caminho.
        cta$ = <button type="button" className={styles.cta} onClick={() => { setScene(0); setLocalStep("caminho"); }}>{COPY.home.cta}</button>;
        break;
      case "caminho":
        scene$ = (
          <>
            <Say title={COPY.path.title} sub={COPY.path.sub(scene + 1)} />
            <div className={styles.art}>
              <PhoneMock platform={platform} scene={scene} />
              <p className={styles.caption}><strong>{scene + 1}.</strong> {COPY.path.steps[platform][scene]}</p>
              <div className={styles.mockSteps} aria-hidden="true">{[0, 1, 2, 3].map((index) => <span key={index} className={styles.mockStep} data-on={index === scene} />)}</div>
              <PlatformSwitch value={platform} onChange={setPlatform} />
            </div>
          </>
        );
        cta$ = scene < 3
          ? <button type="button" className={styles.cta} onClick={() => setScene(scene + 1)}>{COPY.path.next}</button>
          : <button type="button" className={styles.cta} data-tone="whatsapp" onClick={() => askToOpenWhatsApp(() => setLocalStep("esperando"))}><WaIcon light /> {COPY.path.cta}</button>;
        break;
      case "esperando":
        scene$ = (
          <>
            <Say title={COPY.waiting.title} sub={COPY.waiting.sub} state="working" />
            <div className={styles.art}>
              <WaitingMock code={connection.code} />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}><WaitDots /><span className={styles.caption}>{COPY.waiting.label}</span></div>
              <button type="button" className={styles.link} onClick={() => { setScene(0); setLocalStep("caminho"); }}>{COPY.waiting.again}</button>
            </div>
          </>
        );
        cta$ = <button type="button" className={styles.cta} data-tone="whatsapp" onClick={() => askToOpenWhatsApp()}><WaIcon light /> {COPY.waiting.cta}</button>;
        break;
      case "conectado":
        scene$ = (
          <>
            <Say title={COPY.connected.title} sub={connectOnly ? COPY.connectOnly.doneSub : COPY.connected.sub} celebrate />
            <div className={styles.art}><BigCheck /></div>
          </>
        );
        cta$ = connectOnly
          ? <button type="button" className={styles.cta} onClick={presence.onFinish}>{COPY.connectOnly.doneCta}</button>
          : <button type="button" className={styles.cta} disabled>{COPY.connected.cta}</button>;
        break;
      case "confirmar": {
        const text = duty.mode === "presencial" ? COPY.confirm.presencial : COPY.confirm.online;
        scene$ = (
          <>
            <Say title={text.title} sub={text.sub} />
            <DutyCard duty={duty} />
          </>
        );
        const sending = presence.stage === "sending";
        cta$ = <button type="button" className={styles.cta} disabled={sending} onClick={presence.onConfirm}>{sending ? COPY.confirm.sending : duty.mode === "presencial" ? <><CameraIcon /> {text.cta}</> : text.cta}</button>;
        break;
      }
      case "pronto": {
        const waiting = presence.stage === "waiting";
        scene$ = (
          <>
            <Say title={waiting ? COPY.done.waitingTitle : COPY.done.title(presence.confirmedAt ?? null)} sub={waiting ? COPY.done.waitingSub : COPY.done.sub} celebrate />
            <div className={styles.art}>
              <BigCheck />
              {waiting ? <span className={styles.dutyPill}><WaitDots /> {COPY.done.waitingPill}</span> : null}
            </div>
            {waiting ? null : <DutyCard duty={duty} done />}
          </>
        );
        cta$ = <button type="button" className={styles.cta} onClick={presence.onFinish}>{COPY.done.cta}</button>;
        break;
      }
      default:
        scene$ = null;
        cta$ = null;
    }
  }

  const finished = step === "pronto" || (connectOnly && step === "conectado");
  return (
    <div className={cn("arc-venancor", styles.root)} data-step={step} data-error={error ?? undefined} data-device={device}>
      <div className={styles.lesson}>
        <div className={styles.top}>
          <button type="button" className={styles.close} aria-label={COPY.close} onClick={() => (finished ? presence.onFinish() : setSheet("sair"))}><CloseIcon /></button>
          <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={at} aria-label={`Passo ${COPY.progress(at, total)}`}>
            <motion.div className={styles.fill} initial={false} animate={{ scaleX: fill }} transition={reduce ? { duration: 0 } : { duration: 0.45, ease: guideEase }} />
          </div>
          <span className={styles.count}>{COPY.progress(at, total)}</span>
          {voiceBase && narration ? (
            <button type="button" className={styles.voiceSmall} aria-pressed={speaking} aria-label={speaking ? COPY.welcome.stop : COPY.welcome.listenShort} title={speaking ? COPY.welcome.stop : COPY.welcome.listenShort} onClick={toggleVoice}>
              <SpeakerIcon on={speaking} />
            </button>
          ) : null}
        </div>

        <div className={styles.body}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${step}-${error ?? ""}-${connection.method}`}
              className={styles.scene}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: 0.24, ease: guideEase }}
            >
              {scene$}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.foot}>
          {cta$}
          {finished ? null : <button type="button" className={styles.help} onClick={() => setSheet("ajuda")}>{COPY.help.title}</button>}
        </div>
      </div>

      <AnimatePresence>
        {sheet ? (
          <>
            <motion.div key="scrim" className={styles.sheetScrim} onClick={() => setSheet(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            <motion.div key="sheet" className={styles.sheet} role="dialog" aria-label={sheet === "ajuda" ? COPY.help.title : sheet === "abrir" ? COPY.beforeOpen.title : COPY.exit.title} initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0 }} transition={{ duration: 0.28, ease: guideEase }}>
              <span className={styles.sheetGrip} />
              {sheet === "abrir" ? (
                <>
                  <span className={styles.sheetTitle}>{COPY.beforeOpen.title}</span>
                  <ol className={styles.list} style={{ padding: "0 12px 4px" }}>
                    {COPY.beforeOpen.steps[platform].map((text, index) => (
                      <li key={text} className={styles.listItem} data-on="true"><span className={styles.listNum}>{index + 1}</span>{text}</li>
                    ))}
                  </ol>
                  <div className={styles.art} style={{ padding: "4px 0" }}><BeforeOpenArt platform={platform} /></div>
                  <div className={styles.sheetActions}>
                    <button type="button" className={styles.cta} data-tone="whatsapp" onClick={confirmOpenWhatsApp}><WaIcon light /> {COPY.beforeOpen.cta}</button>
                    <button type="button" className={styles.ghost} onClick={() => setSheet(null)}>{COPY.beforeOpen.back}</button>
                  </div>
                </>
              ) : sheet === "ajuda" ? (
                <>
                  <span className={styles.sheetTitle}>{COPY.help.title}</span>
                  <button type="button" className={styles.sheetItem} onClick={() => { setSheet(null); setVideo(true); }}><span className={styles.sheetItemTitle}>{COPY.help.video[0]}</span><span className={styles.sheetItemText}>{COPY.help.video[1]}</span></button>
                  <button type="button" className={styles.sheetItem} onClick={() => setShowSteps((current) => !current)}><span className={styles.sheetItemTitle}>{COPY.help.steps[0]}</span><span className={styles.sheetItemText}>{COPY.help.steps[1]}</span></button>
                  {showSteps ? (
                    <ol className={styles.list} style={{ padding: "0 12px 8px" }}>
                      {[COPY.home.captions[platform], ...COPY.path.steps[platform]].map((text, index) => <li key={text} className={styles.listItem}><span className={styles.listNum}>{index + 1}</span>{text}</li>)}
                    </ol>
                  ) : null}
                </>
              ) : (
                <>
                  <span className={styles.sheetTitle}>{COPY.exit.title}</span>
                  <p className={styles.saySub} style={{ padding: "0 12px", margin: 0 }}>{COPY.exit.sub}</p>
                  <div className={styles.sheetActions}>
                    <button type="button" className={styles.cta} onClick={() => setSheet(null)}>{COPY.exit.stay}</button>
                    <button type="button" className={styles.ghost} onClick={() => { setSheet(null); onClose(); }}>{COPY.exit.leave}</button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <PresenceTutorialVideo open={video} onOpenChange={setVideo} hideTrigger />
    </div>
  );
}

function errorView(error: GuideError, context: { phone: string; message: string | null }): { title: string; sub?: string; cta: string } {
  const e = COPY.errors;
  switch (error) {
    case "expired": return e.expired;
    case "cooldown": return e.cooldown;
    case "issue": return e.issue;
    case "rejected": return { title: e.rejected.title, sub: e.rejected.sub(context.phone), cta: e.rejected.cta };
    case "stalled": return e.stalled;
    case "notOpened": return e.notOpened;
    case "copyBlocked": return e.copyBlocked;
    case "unstable": return e.unstable;
    case "confirm": return { title: context.message ?? "Não consegui confirmar agora. Tente de novo.", cta: e.confirm.cta };
  }
}

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return d;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

function Say({ title, sub, state = "idle", celebrate = false }: { title: string; sub?: React.ReactNode; state?: "idle" | "working" | "waiting"; celebrate?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.say}>
      <motion.span className={styles.mascot} initial={reduce || !celebrate ? false : { scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", visualDuration: 0.45, bounce: 0.3 }}>
        <AssistantAvatar shape="onigiri" hue={28} size={52} state={state} />
      </motion.span>
      <span className={styles.sayText}>
        <span className={styles.sayTitle} role="status" aria-live="polite">{title}</span>
        {sub ? <span className={styles.saySub}>{sub}</span> : null}
      </span>
    </div>
  );
}

function PlatformSwitch({ value, onChange }: { value: GuidePlatform; onChange: (platform: GuidePlatform) => void }) {
  return (
    <div className={styles.platform} role="group" aria-label="Tipo de celular">
      <button type="button" className={styles.platformBtn} aria-pressed={value === "android"} onClick={() => onChange("android")}>Android</button>
      <button type="button" className={styles.platformBtn} aria-pressed={value === "iphone"} onClick={() => onChange("iphone")}>iPhone</button>
    </div>
  );
}

function DutyCard({ duty, done = false }: { duty: PresenceGuideDuty; done?: boolean }) {
  return (
    <div className={styles.duty}>
      <span className={styles.dutyPill}>{duty.mode === "presencial" ? "Plantão presencial" : "Plantão online"} · até {duty.until}</span>
      <span className={styles.dutyName}>{duty.scheduleName}</span>
      {duty.branchName || done ? <span className={styles.dutyMeta}>{[duty.branchName, done ? "presença confirmada" : null].filter(Boolean).join(" · ")}</span> : null}
    </div>
  );
}
