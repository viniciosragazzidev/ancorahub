"use client";

import * as React from "react";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { PresenceGuide, type PresenceGuideConnection, type PresenceGuidePreview } from "@/components/chat/presence-guide/presence-guide";
import type { ConfirmStage, GuideDevice, GuideStep } from "@/components/chat/presence-guide/presence-guide-steps";
import { SELF_CONFIRM_LATE_MESSAGE } from "@/features/lead-distribution/duty-presence-domain";
import { cn } from "@/utils/core/cn";

import styles from "./roteiro.module.css";

/**
 * Protótipo do roteiro guiado de presença (só em dev). Usa o MESMO componente do app (PresenceGuide); aqui só a
 * conexão e a presença são simuladas: nada chama o WhatsApp (WAHA) nem o banco.
 * Parâmetros para prints: ?aparelho=celular|computador&passo=…&erro=…&modo=online|presencial&limpo=1
 */
type Mode = "online" | "presencial";
type Screen = "cartao" | "retomar" | "fim" | GuideStep | "codigo-copiado";
type Sim = "carregando" | "expirado" | "espera" | "falhou" | "recusado" | "demorando" | "naoabriu" | "copia" | "instavel" | "desconectou" | "atrasado" | "confirmar-erro";

const CODE_A = "K7QM2XPD";
const CODE_B = "P4RT9WQZ";
const DUTY = { name: "Plantão Barra · Manhã", branch: "Unidade Barra", until: "13:00", confirmedAt: "09:12" };
const FAKE_QR = `data:image/svg+xml;utf8,${encodeURIComponent(fakeQrSvg())}`;

const SCREENS: { id: Screen; label: string }[] = [
  { id: "cartao", label: "0. Cartão" },
  { id: "boasvindas", label: "1. Boas-vindas" },
  { id: "numero", label: "1b. Número" },
  { id: "codigo", label: "2. Código" },
  { id: "codigo-copiado", label: "2. Copiado" },
  { id: "telainicial", label: "3. Tela inicial" },
  { id: "caminho", label: "4. Caminho" },
  { id: "esperando", label: "5. Esperando" },
  { id: "conectado", label: "6. Conectado" },
  { id: "confirmar", label: "7. Confirmar" },
  { id: "pronto", label: "Pronto" },
  { id: "retomar", label: "Retomar" },
];
const SIMS: { id: Sim; label: string }[] = [
  { id: "carregando", label: "Gerando código" },
  { id: "expirado", label: "Código venceu" },
  { id: "espera", label: "Muitos pedidos" },
  { id: "falhou", label: "Código não saiu" },
  { id: "recusado", label: "Número errado" },
  { id: "demorando", label: "Demorando" },
  { id: "naoabriu", label: "WhatsApp não abriu" },
  { id: "copia", label: "Cópia bloqueada" },
  { id: "instavel", label: "WhatsApp instável" },
  { id: "desconectou", label: "Desconectou no meio" },
  { id: "atrasado", label: "Passou de 1 hora" },
  { id: "confirmar-erro", label: "Falha ao confirmar" },
];

type Facts = Pick<PresenceGuideConnection, "ready" | "phase" | "code" | "generating" | "expired" | "cooldownSeconds" | "stalled" | "connectivity" | "issue" | "phone" | "method" | "started" | "phoneChecked">;
const BASE_FACTS: Facts = { ready: false, phase: "qr", code: CODE_A, generating: false, expired: false, cooldownSeconds: 0, stalled: false, connectivity: null, issue: null, phone: "21987654321", method: "code", started: true, phoneChecked: true };

type Setup = { screen: Screen; facts: Facts; stage: ConfirmStage; error: string | null; reconnect: boolean; preview: PresenceGuidePreview };

function setupFor(screen: Screen, sim: Sim | null, device: GuideDevice): Setup {
  const facts: Facts = { ...BASE_FACTS, method: device === "desktop" ? "qr" : "code" };
  let stage: ConfirmStage = "connect";
  let error: string | null = null;
  let reconnect = false;
  const preview: PresenceGuidePreview = {};
  const step = (s: GuideStep) => { preview.step = s; };
  const connected = () => { step("esperando"); facts.ready = true; facts.phase = "ready"; };
  switch (screen) {
    case "boasvindas": step("boasvindas"); facts.started = false; facts.code = null; break;
    case "numero": step("numero"); facts.phone = ""; facts.code = null; break;
    case "codigo": step("codigo"); break;
    case "codigo-copiado": step("codigo"); preview.copied = true; break;
    case "telainicial": step("telainicial"); break;
    case "caminho": step("caminho"); break;
    case "esperando": step("esperando"); break;
    case "conectado": connected(); break;
    case "confirmar": connected(); stage = "confirm"; break;
    case "pronto": connected(); stage = "done"; break;
    default:
  }
  switch (sim) {
    case "carregando": step("codigo"); facts.code = null; facts.generating = true; break;
    case "expirado": step("codigo"); facts.code = null; facts.expired = true; break;
    case "espera": step("codigo"); facts.code = null; facts.cooldownSeconds = 24; break;
    case "falhou": step("codigo"); facts.code = null; facts.issue = "O WhatsApp demorou para liberar o código."; break;
    case "recusado": step("esperando"); facts.phase = "error"; break;
    case "demorando": step("esperando"); facts.phase = "pairing"; facts.stalled = true; break;
    case "naoabriu": step("caminho"); preview.local = "notOpened"; break;
    case "copia": step("codigo"); preview.local = "copyBlocked"; break;
    case "instavel": step("esperando"); facts.connectivity = "unreachable"; break;
    case "desconectou": step("boasvindas"); facts.started = false; facts.code = null; reconnect = true; break;
    case "atrasado": connected(); stage = "error"; error = SELF_CONFIRM_LATE_MESSAGE; break;
    case "confirmar-erro": connected(); stage = "error"; error = "Não consegui confirmar agora. Tente de novo."; break;
    default:
  }
  return { screen, facts, stage, error, reconnect, preview };
}

function readParams() {
  return typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

export function RoteiroPresencaPreview() {
  const [device, setDevice] = React.useState<GuideDevice>("mobile");
  const [mode, setMode] = React.useState<Mode>("online");
  // "conectar": o roteiro aberto pelo botão do WhatsApp no topo (sem a presença).
  const [guideMode, setGuideMode] = React.useState<"presence" | "connect">("presence");
  const [bare, setBare] = React.useState(false);
  const [assume, setAssume] = React.useState(true);
  const [sim, setSim] = React.useState<Sim | null>(null);
  const [setup, setSetup] = React.useState<Setup>(() => setupFor("cartao", null, "mobile"));
  const [mount, setMount] = React.useState(0);
  const [facts, setFacts] = React.useState<Facts>(setup.facts);
  const [stage, setStage] = React.useState<ConfirmStage>(setup.stage);
  const [confirmedAt, setConfirmedAt] = React.useState<string | null>(null);
  const opens = React.useRef(0);
  const timers = React.useRef<number[]>([]);

  const later = React.useCallback((ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  const apply = React.useCallback((screen: Screen, nextSim: Sim | null, nextDevice: GuideDevice) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const next = setupFor(screen, nextSim, nextDevice);
    opens.current = 0;
    setSim(nextSim);
    setSetup(next);
    setFacts(next.facts);
    setStage(next.stage);
    setConfirmedAt(next.stage === "done" ? DUTY.confirmedAt : null);
    setMount((m) => m + 1);
  }, []);

  React.useEffect(() => {
    const p = readParams();
    const nextDevice: GuideDevice = p.get("aparelho") === "computador" ? "desktop" : "mobile";
    /* eslint-disable react-hooks/set-state-in-effect -- lê a URL uma vez, só no protótipo */
    setDevice(nextDevice);
    if (p.get("modo") === "presencial") setMode("presencial");
    if (p.get("roteiro") === "conectar") setGuideMode("connect");
    if (p.get("limpo") === "1") setBare(true);
    if (p.get("suposicoes") === "0") setAssume(false);
    const erro = p.get("erro") as Sim | null;
    apply((p.get("passo") as Screen | null) ?? "cartao", erro && SIMS.some((s) => s.id === erro) ? erro : null, nextDevice);
    // Extras para prints: cena do caminho, tipo de celular e folha aberta.
    const cena = Number(p.get("cena") ?? "0");
    const folha = p.get("folha");
    setSetup((current) => ({
      ...current,
      preview: {
        ...current.preview,
        scene: cena >= 0 && cena <= 3 ? cena : 0,
        platform: p.get("plataforma") === "iphone" ? "iphone" : "android",
        sheet: folha === "ajuda" || folha === "sair" || folha === "abrir" ? folha : null,
      },
    }));
    // Remonta o roteiro com os extras (ele lê a prévia só ao montar).
    setMount((m) => m + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [apply]);

  // Contagem do "muitos pedidos".
  React.useEffect(() => {
    if (facts.cooldownSeconds <= 0) return;
    const t = window.setTimeout(() => setFacts((f) => ({ ...f, cooldownSeconds: Math.max(0, f.cooldownSeconds - 1) })), 1_000);
    return () => window.clearTimeout(t);
  }, [facts.cooldownSeconds]);

  const connect = React.useCallback(() => {
    setFacts((f) => ({ ...f, ready: true, phase: "ready" }));
    later(1_600, () => setStage("confirm"));
  }, [later]);

  const generate = React.useCallback(() => {
    setFacts((f) => ({ ...f, code: null, generating: true, expired: false, issue: null, stalled: false, phase: "qr" }));
    later(900, () => setFacts((f) => ({ ...f, generating: false, code: f.code === CODE_A ? CODE_B : CODE_A })));
  }, [later]);

  const connection: PresenceGuideConnection = {
    ...facts,
    qrCode: facts.method === "qr" ? FAKE_QR : null,
    phoneValid: /^\d{10,11}$/.test(facts.phone),
    onMethodChange: (method) => setFacts((f) => ({ ...f, method })),
    onStart: () => {
      setFacts((f) => ({ ...f, started: true, code: null, generating: f.method === "code" }));
      if (device === "mobile") later(900, () => setFacts((f) => ({ ...f, generating: false, code: CODE_A })));
      else later(6_000, connect);
    },
    onPhoneChange: (phone) => setFacts((f) => ({ ...f, phone })),
    onGenerate: generate,
  };

  const guide = (
    <PresenceGuide
      key={`${mount}-${guideMode}`}
      mode={guideMode}
      device={device}
      connection={connection}
      duty={{ key: "prototipo", scheduleName: DUTY.name, branchName: DUTY.branch, mode, until: DUTY.until }}
      presence={{
        stage,
        error: setup.error,
        confirmedAt,
        reconnect: setup.reconnect,
        onConfirm: () => {
          setStage("sending");
          later(800, () => { setConfirmedAt(DUTY.confirmedAt); setStage(mode === "presencial" ? "waiting" : "done"); });
        },
        onFinish: () => apply("fim", null, device),
      }}
      onClose={() => apply("retomar", null, device)}
      // Simulação: o WhatsApp abre no fim do tutorial e conecta depois de 4 s.
      openWhatsApp={() => { opens.current += 1; later(4_000, connect); }}
      preview={setup.preview}
    />
  );
  const showHome = setup.screen === "cartao" || setup.screen === "retomar" || setup.screen === "fim";
  const content = showHome ? <Home screen={setup.screen} mode={mode} onOpen={() => apply(setup.screen === "retomar" ? "codigo" : "boasvindas", null, device)} /> : guide;

  const frame = device === "desktop" ? (
    <div className={bare ? styles.bareDesktop : styles.desktopFrame}>
      {bare ? null : <div className={styles.desktopBar}><span className={styles.desktopDot} /><span className={styles.desktopDot} /><span className={styles.desktopDot} /><span className={styles.desktopUrl}>crm.ancorasaude.cloud/plantoes/agora</span></div>}
      <div className={styles.desktopBody} style={bare ? { position: "absolute", inset: 0 } : undefined}>
        <DesktopBackdrop />
        {showHome ? null : <div className={styles.desktopScrim} />}
        <div className={styles.desktopPanel} style={showHome ? { background: "transparent", boxShadow: "none" } : undefined}>{content}</div>
      </div>
    </div>
  ) : (
    <div className={bare ? styles.bare : styles.phoneFrame}><div className={styles.phoneScreen}>{content}</div></div>
  );

  return (
    <div className={cn("arc-venancor", styles.root, !assume && styles.assumeHidden)}>
      {bare ? frame : (
        <div className={styles.page}>
          <aside className={styles.panel} aria-label="Controles do protótipo">
            <div>
              <div className={styles.panelTitle}>Roteiro de presença · protótipo</div>
              <p className={styles.panelHint}>Mesmo componente do app, com a conexão simulada. No fluxo, &quot;Abrir o WhatsApp&quot; conecta depois de 4 s (no computador, 6 s depois de começar).</p>
            </div>
            <Group label="Aparelho">
              <Chip on={device === "mobile"} onClick={() => { setDevice("mobile"); apply(setup.screen, sim, "mobile"); }}>Celular</Chip>
              <Chip on={device === "desktop"} onClick={() => { setDevice("desktop"); apply(setup.screen, sim, "desktop"); }}>Computador</Chip>
            </Group>
            <Group label="Aberto por">
              <Chip on={guideMode === "presence"} onClick={() => setGuideMode("presence")}>Confirmar presença</Chip>
              <Chip on={guideMode === "connect"} onClick={() => setGuideMode("connect")}>Botão do WhatsApp no topo</Chip>
            </Group>
            <Group label="Plantão">
              <Chip on={mode === "online"} onClick={() => setMode("online")}>Online</Chip>
              <Chip on={mode === "presencial"} onClick={() => setMode("presencial")}>Presencial</Chip>
            </Group>
            <Group label="Etapa">{SCREENS.map((s) => <Chip key={s.id} on={setup.screen === s.id && !sim} onClick={() => apply(s.id, null, device)}>{s.label}</Chip>)}</Group>
            <Group label="Erros">{SIMS.map((s) => <Chip key={s.id} on={sim === s.id} onClick={() => apply("codigo", s.id, device)}>{s.label}</Chip>)}</Group>
            <Group label="Simular">
              <Chip on={false} onClick={connect}>WhatsApp conectou</Chip>
              <Chip on={assume} onClick={() => setAssume((v) => !v)}>{assume ? "Suposições: mostrando" : "Suposições: escondidas"}</Chip>
            </Group>
            <div style={{ display: "grid", gap: 6 }}>
              <span className={styles.assume}>P1: visual Lite do corretor</span>
              <span className={styles.assume}>P2: comemoração sem confete, mola leve</span>
              <span className={styles.assume}>P3: ilustração com o verde do WhatsApp</span>
              <span className={styles.assume}>P6: no computador abre no QR Code</span>
              <span className={styles.assume}>P7: confirmar presença é um toque</span>
              <span className={styles.assume}>P8: sem relógio de validade do código</span>
              <span className={styles.assume}>A verificar no aparelho: link que só abre o app</span>
            </div>
          </aside>
          <div className={styles.stage}>{frame}</div>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.panelGroup}><span className={styles.panelLabel}>{label}</span><div className={styles.chips}>{children}</div></div>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={styles.chip} aria-pressed={on} onClick={onClick}>{children}</button>;
}

function Home({ screen, mode, onOpen }: { screen: Screen; mode: Mode; onOpen: () => void }) {
  const done = screen === "fim";
  return (
    <div className={styles.home}>
      <div className={styles.homeHello}>Olá, Ana</div>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <AssistantAvatar shape="onigiri" hue={28} size={44} state={done ? "idle" : "waiting"} />
          <div style={{ display: "grid", gap: 4 }}>
            <span className={styles.dutyPill}>{mode === "presencial" ? "Plantão presencial" : "Plantão online"} · até {DUTY.until}</span>
            <span className={styles.cardTitle}>{done ? "Presença confirmada" : "Confirme sua presença"}</span>
            <span className={styles.cardText}>{done ? "Pronto. Você já pode receber leads deste plantão." : screen === "retomar" ? "Falta conectar o seu WhatsApp. Toque abaixo e eu te guio passo a passo." : `${DUTY.name}. Um toque e você começa a receber leads.`}</span>
          </div>
        </div>
        {done ? <span className={styles.copied} style={{ justifySelf: "center" }}>Confirmado às {DUTY.confirmedAt}</span>
          : <button type="button" className={styles.cta} onClick={onOpen}>{screen === "retomar" ? "Continuar de onde parei" : "Confirmar presença"}</button>}
      </div>
      {[0, 1, 2].map((i) => <div key={i} style={{ height: 56, borderRadius: 9999, background: "var(--surface)", opacity: 0.7 - i * 0.15 }} />)}
    </div>
  );
}

function DesktopBackdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "360px 1fr", background: "var(--background)" }} aria-hidden="true">
      <div style={{ background: "var(--surface-muted)", padding: 20, display: "grid", gap: 10, alignContent: "start" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ height: 48, borderRadius: 9999, background: "var(--surface)", opacity: 0.8 }} />)}
      </div>
      <div style={{ padding: 40 }}><div style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em" }}>Bom dia, Ana</div></div>
    </div>
  );
}

function fakeQrSvg() {
  const n = 25;
  let rects = "";
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
    const finder = (fx: number, fy: number) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7 && (x === fx || x === fx + 6 || y === fy || y === fy + 6 || (x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4));
    const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    const on = inFinder ? finder(0, 0) || finder(n - 7, 0) || finder(0, n - 7) : ((x * 7 + y * 13 + x * y) % 5) < 2;
    if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><g fill="#0b0b12">${rects}</g></svg>`;
}
