"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";

import { WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { PairingGuide, PairingQrPanel, PairingStepper } from "@/components/whatsapp/whatsapp-pairing-panel";
import { PAIRING_BADGE_LABELS } from "@/features/waha-cadence/pairing-copy";
import {
  FIRST_QR_LIFETIME_SECONDS,
  ROTATED_QR_LIFETIME_SECONDS,
  type PairingPhase,
} from "@/features/waha-cadence/pairing-phase";

/**
 * Revisão visual do pareamento do WhatsApp — só em desenvolvimento.
 * Usa os mesmos componentes do dialog real (whatsapp-pairing-panel) com dados
 * simulados, então nenhuma chamada ao WAHA/Fastify é feita aqui.
 */

const PHASES: PairingPhase[] = ["idle", "starting", "qr", "pairing", "ready", "error"];

const BADGE_STATUS: Record<PairingPhase, DsStatusBadgeStatus> = {
  idle: "secondary",
  starting: "info",
  qr: "info",
  pairing: "info",
  ready: "success",
  error: "destructive",
};

/** QR de mentira, determinístico por semente, só para visualizar a rotação. */
function fakeQr(seed: number) {
  const size = 25;
  let state = seed * 9301 + 49297;
  const rand = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    if (inBox(0, 0) || inBox(size - 7, 0) || inBox(0, size - 7)) {
      const ox = x < 7 ? 0 : size - 7;
      const oy = y < 7 ? 0 : size - 7;
      const dx = x - ox;
      const dy = y - oy;
      const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      return ring || core;
    }
    return null;
  };
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      if (f === true || (f === null && rand() > 0.55)) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${size + 2}" height="${size + 2}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function PhaseCard({
  phase,
  secondsLeft = 14,
  lifetime = ROTATED_QR_LIFETIME_SECONDS,
  qrSeed = 1,
  stalled = false,
  renewing = false,
  connectivity = null,
}: {
  phase: PairingPhase;
  secondsLeft?: number;
  lifetime?: number;
  qrSeed?: number;
  stalled?: boolean;
  renewing?: boolean;
  connectivity?: "unreachable" | "unauthorized" | null;
}) {
  const qr = useMemo(() => (phase === "qr" ? fakeQr(qrSeed) : null), [phase, qrSeed]);
  return (
    <div className="rounded-ds-large-cards border border-ds-ash bg-ds-canvas-white p-ds-24 shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-ds-16">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-ds-body-lg font-semibold text-ds-charcoal">
            <WhatsappLogo className="text-success" /> WhatsApp
          </p>
          <p className="mt-2 text-ds-body text-ds-steel">Vincule o WhatsApp do seu celular para atender seus leads por aqui.</p>
          <div className="mt-ds-12">
            <PairingStepper phase={phase} />
          </div>
        </div>
        <DsStatusBadge status={BADGE_STATUS[phase]} label={PAIRING_BADGE_LABELS[phase]} className="shrink-0" />
      </div>

      <div className="mt-ds-16 grid gap-ds-16 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-ds-12">
          <PairingGuide phase={phase} phoneSuffix="4821" stalled={stalled} renewing={renewing} connectivity={connectivity} />
          <div className="flex flex-wrap gap-ds-8">
            {phase === "idle" && <Button>Conectar WhatsApp</Button>}
            {phase === "error" && <Button>Gerar novo QR</Button>}
            {(phase === "qr" || phase === "pairing" || phase === "starting") && <Button variant="outline">Gerar novo QR</Button>}
            {phase === "ready" && (
              <>
                <Button variant="outline" size="sm">Desativar chat</Button>
                <Button variant="outline" size="sm">Desconectar</Button>
              </>
            )}
          </div>
          <Button size="sm" variant="outline"><WhatsappLogo className="size-4" /> Abrir WhatsApp Web ou app</Button>
        </div>
        <PairingQrPanel phase={phase} qrCode={qr} secondsLeft={secondsLeft} lifetime={lifetime} qrKey={qrSeed} />
      </div>
    </div>
  );
}

/** Roda o fluxo completo: preparar → QR (com rotação) → pareando → conectado. */
function useSimulation() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PairingPhase>("idle");
  const [seed, setSeed] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(FIRST_QR_LIFETIME_SECONDS);
  const [lifetime, setLifetime] = useState(FIRST_QR_LIFETIME_SECONDS);
  const timers = useRef<number[]>([]);

  function clear() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  useEffect(() => clear, []);

  function start() {
    clear();
    setRunning(true);
    setPhase("starting");
    setSeed(1);
    setLifetime(FIRST_QR_LIFETIME_SECONDS);
    setSecondsLeft(FIRST_QR_LIFETIME_SECONDS);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(2_000, () => setPhase("qr"));
    // Rotação do QR aos 8s (o simulador usa ciclos curtos para revisão).
    at(10_000, () => { setSeed(2); setLifetime(ROTATED_QR_LIFETIME_SECONDS); setSecondsLeft(ROTATED_QR_LIFETIME_SECONDS); });
    at(14_000, () => setPhase("pairing"));
    at(18_000, () => { setPhase("ready"); setRunning(false); });
  }

  useEffect(() => {
    if (phase !== "qr") return;
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1_000);
    return () => window.clearInterval(timer);
  }, [phase, seed]);

  return { running, phase, seed, secondsLeft, lifetime, start };
}

export default function WhatsappConnectPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const sim = useSimulation();

  return (
    <main className="mx-auto max-w-5xl space-y-ds-32 p-ds-24 font-ds-inter text-ds-charcoal">
      <header className="space-y-ds-8">
        <h1 className="text-ds-heading-sm font-semibold">Pareamento do WhatsApp — revisão visual</h1>
        <p className="text-ds-body text-ds-steel">
          Mesmos componentes do dialog real, com dados simulados. Nenhuma chamada ao WAHA.
        </p>
      </header>

      <section className="space-y-ds-12">
        <div className="flex items-center gap-ds-12">
          <h2 className="text-ds-body-lg font-semibold">Fluxo completo (simulação)</h2>
          <Button size="sm" onClick={sim.start} disabled={sim.running}>
            {sim.running ? "Simulando…" : "▶ Simular conexão"}
          </Button>
        </div>
        <PhaseCard phase={sim.phase} secondsLeft={sim.secondsLeft} lifetime={sim.lifetime} qrSeed={sim.seed} />
      </section>

      <section className="space-y-ds-12">
        <h2 className="text-ds-body-lg font-semibold">Todas as fases</h2>
        <div className="grid gap-ds-24 lg:grid-cols-1">
          {PHASES.map((phase) => (
            <div key={phase} className="space-y-ds-8">
              <p className="font-mono text-ds-caption text-ds-fog">phase = {phase}</p>
              <PhaseCard phase={phase} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-ds-12">
        <h2 className="text-ds-body-lg font-semibold">Variações</h2>
        <div className="space-y-ds-24">
          <div className="space-y-ds-8">
            <p className="font-mono text-ds-caption text-ds-fog">qr · validade zerada (aguardando rotação)</p>
            <PhaseCard phase="qr" secondsLeft={0} qrSeed={3} />
          </div>
          <div className="space-y-ds-8">
            <p className="font-mono text-ds-caption text-ds-fog">starting · renovação automática</p>
            <PhaseCard phase="starting" renewing />
          </div>
          <div className="space-y-ds-8">
            <p className="font-mono text-ds-caption text-ds-fog">pairing · demorando além de 90s</p>
            <PhaseCard phase="pairing" stalled />
          </div>
          <div className="space-y-ds-8">
            <p className="font-mono text-ds-caption text-ds-fog">qr · servidor sem resposta</p>
            <PhaseCard phase="qr" qrSeed={4} connectivity="unreachable" />
          </div>
        </div>
      </section>
    </main>
  );
}
