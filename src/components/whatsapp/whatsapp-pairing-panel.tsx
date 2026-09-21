"use client";

import * as React from "react";
import { ArrowsClockwise, CheckCircle, LockKey, Phone, WarningCircle } from "@/components/huge-icons";
import { cn } from "@/utils/core/cn";
import type { PairingPhase } from "@/features/waha-cadence/pairing-phase";
import {
  PAIRING_COPY,
  PAIRING_QR_CAPTIONS,
  resolvePairingCopyBody,
  type PairingCopyKey,
  type PairingIcon,
  type PairingTone,
} from "@/features/waha-cadence/pairing-copy";

/**
 * Peças visuais do pareamento do WhatsApp (modo Lite). Sem estado e sem
 * chamadas de servidor: recebem a fase já derivada e apenas a apresentam,
 * o que permite revisar cada fase isoladamente (ver /dev/whatsapp-connect).
 *
 * Design system: bordas 1px Ash definem contêineres, cards 12px, tags 9999px,
 * Electric Blue como único destaque cromático durante o fluxo. Verde (sucesso)
 * e vermelho (erro) aparecem só quando a fase é de fato terminal.
 */

// ── Stepper ───────────────────────────────────────────────────────────

const STEPS = ["Preparar", "Escanear", "Conectar"] as const;

function stepIndexFor(phase: PairingPhase): { active: number; done: number } {
  switch (phase) {
    case "starting": return { active: 0, done: 0 };
    case "qr": return { active: 1, done: 1 };
    case "pairing": return { active: 2, done: 2 };
    case "ready": return { active: -1, done: 3 };
    default: return { active: -1, done: 0 };
  }
}

export function PairingStepper({ phase }: { phase: PairingPhase }) {
  const { active, done } = stepIndexFor(phase);
  return (
    <ol className="flex items-center gap-ds-8" aria-label="Progresso da conexão">
      {STEPS.map((label, index) => {
        const isDone = index < done;
        const isActive = index === active;
        return (
          <li key={label} className="flex items-center gap-ds-8" aria-current={isActive ? "step" : undefined}>
            <span
              className={cn(
                "relative flex size-5 items-center justify-center rounded-full text-ds-caption font-semibold transition-colors duration-300",
                isDone && "bg-ds-electric-blue text-ds-canvas-white",
                isActive && "bg-ds-canvas-white text-ds-electric-blue ring-2 ring-ds-electric-blue",
                !isDone && !isActive && "bg-ds-paper-mist text-ds-fog",
              )}
            >
              {isActive && <span aria-hidden className="ct-pulse-ring absolute inset-0 rounded-full ring-2 ring-ds-electric-blue" />}
              {isDone ? <CheckCircle className="size-3" aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                "text-ds-caption font-medium transition-colors duration-300",
                isDone || isActive ? "text-ds-charcoal" : "text-ds-fog",
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn("h-px w-ds-16 transition-colors duration-300", index < done ? "bg-ds-electric-blue" : "bg-ds-ash")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Callout ───────────────────────────────────────────────────────────

const TONE_CLASS: Record<PairingTone, string> = {
  neutral: "border-ds-ash bg-ds-paper-mist",
  info: "border-ds-electric-blue bg-ds-powder-blue",
  success: "border-ds-vivid-green bg-ds-soft-mint",
  warning: "border-ds-amber-ink bg-ds-amber-wash",
  destructive: "border-ds-rose-ink bg-ds-rose-wash",
};

const TONE_ICON_CLASS: Record<PairingTone, string> = {
  neutral: "text-ds-fog",
  info: "text-ds-electric-blue",
  success: "text-ds-vivid-green",
  warning: "text-ds-amber-ink",
  destructive: "text-ds-rose-ink",
};

/** Callout — docs/design-system.md § Callout / Alert panel. Texto sempre Charcoal. */
export function PairingCallout({
  tone,
  title,
  icon,
  children,
  className,
}: {
  tone: PairingTone;
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-ds-cards border p-ds-16 text-ds-charcoal transition-colors duration-300", TONE_CLASS[tone], className)}
    >
      <div className="flex items-start gap-ds-12">
        {icon && <span className={cn("mt-0.5 shrink-0", TONE_ICON_CLASS[tone])}>{icon}</span>}
        <div className="min-w-0">
          <p className="text-ds-body font-semibold">{title}</p>
          {children && <div className="mt-ds-4 space-y-ds-4 text-ds-body text-ds-charcoal">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Guia por fase ─────────────────────────────────────────────────────

export type PairingGuideProps = {
  phase: PairingPhase;
  /** Últimos dígitos do número conectado, quando o WAHA informa. */
  phoneSuffix?: string | null;
  /** Pós-scan parado além do esperado. */
  stalled?: boolean;
  /** O servidor WhatsApp não respondeu nas últimas consultas. */
  connectivity?: "unreachable" | "unauthorized" | null;
  /** Renovação automática em andamento (QR expirou sem leitura). */
  renewing?: boolean;
};

const ICONS: Record<PairingIcon, (props: { className?: string }) => React.ReactNode> = {
  lock: (p) => <LockKey aria-hidden {...p} />,
  spinner: (p) => <ArrowsClockwise aria-hidden {...p} className={cn(p.className, "animate-spin motion-reduce:animate-none")} />,
  phone: (p) => <Phone aria-hidden {...p} />,
  check: (p) => <CheckCircle aria-hidden {...p} />,
  warning: (p) => <WarningCircle aria-hidden {...p} />,
};

function guideKeyFor({ phase, stalled, renewing }: Pick<PairingGuideProps, "phase" | "stalled" | "renewing">): PairingCopyKey {
  if (phase === "starting" && renewing) return "renewing";
  if (phase === "pairing" && stalled) return "stalled";
  return phase;
}

/** Callout de uma chave do mapa de textos (src/features/waha-cadence/pairing-copy.ts). */
export function PairingCopyCallout({ copyKey, phoneSuffix, className }: { copyKey: PairingCopyKey; phoneSuffix?: string | null; className?: string }) {
  const copy = PAIRING_COPY[copyKey];
  const Icon = ICONS[copy.icon];
  const body = resolvePairingCopyBody(copy.body, phoneSuffix);
  return (
    <PairingCallout tone={copy.tone} title={copy.title} icon={<Icon className="size-4" />} className={className}>
      {body && <p>{body}</p>}
      {copy.steps && (
        <ol className="list-decimal space-y-ds-4 pl-ds-16">
          {copy.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
      {copy.hint && <p className="text-ds-caption text-ds-steel">{copy.hint}</p>}
    </PairingCallout>
  );
}

export function PairingGuide({ phase, phoneSuffix, stalled, connectivity, renewing }: PairingGuideProps) {
  return (
    <div className="space-y-ds-8">
      <PairingCopyCallout copyKey={guideKeyFor({ phase, stalled, renewing })} phoneSuffix={phoneSuffix} />
      {connectivity && phase !== "ready" && <PairingCopyCallout copyKey={connectivity} />}
    </div>
  );
}

// ── Painel do QR ──────────────────────────────────────────────────────

export type PairingQrPanelProps = {
  phase: PairingPhase;
  qrCode: string | null;
  /** Segundos restantes de validade estimada do QR exibido. */
  secondsLeft: number;
  /** Validade total usada para a barra (60s no primeiro QR, 20s nos seguintes). */
  lifetime: number;
  /** Muda a cada QR novo: reinicia a animação de entrada. */
  qrKey: number;
};

export function PairingQrPanel({ phase, qrCode, secondsLeft, lifetime, qrKey }: PairingQrPanelProps) {
  const showQr = phase === "qr" && Boolean(qrCode);
  const expired = showQr && secondsLeft <= 0;
  const ratio = Math.min(Math.max(secondsLeft / Math.max(lifetime, 1), 0), 1);

  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-ds-12 rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-16"
      data-phase={phase}
    >
      {showQr ? (
        <>
          <div className="relative">
            {/* A validade é uma estimativa (o WAHA decide quando rotaciona): o QR
                nunca é escondido, para não impedir a leitura de um código ainda válido. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- QR dinâmico em base64 */}
            <img
              key={qrKey}
              alt="QR Code para conectar o WhatsApp"
              className="ct-qr-enter size-48 rounded-lg bg-white"
              src={qrCode!.startsWith("data:") ? qrCode! : `data:image/png;base64,${qrCode}`}
            />
          </div>
          <div className="w-full max-w-48 space-y-ds-4">
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-ds-paper-mist"
              role="progressbar"
              aria-label="Validade do QR Code"
              aria-valuemin={0}
              aria-valuemax={lifetime}
              aria-valuenow={Math.max(secondsLeft, 0)}
            >
              <div
                className="h-full rounded-full bg-ds-electric-blue transition-[width] duration-300 ease-linear motion-reduce:transition-none"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            {/* div (não p): o ícone animado renderiza um <div> interno. */}
            <div className="flex items-center justify-center gap-ds-4 text-center text-ds-caption tabular-nums text-ds-fog">
              {expired && <ArrowsClockwise className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />}
              <span>{expired ? PAIRING_QR_CAPTIONS.qrRefreshing : `Novo código em ${Math.max(secondsLeft, 0)}s`}</span>
            </div>
          </div>
        </>
      ) : phase === "pairing" ? (
        <div className="text-center">
          <span className="relative mx-auto flex size-14 items-center justify-center rounded-full bg-ds-powder-blue text-ds-electric-blue">
            <span aria-hidden className="ct-pulse-ring absolute inset-0 rounded-full ring-2 ring-ds-electric-blue" />
            <Phone className="size-6" aria-hidden />
          </span>
          <p className="mt-ds-12 text-ds-body font-medium text-ds-charcoal">{PAIRING_QR_CAPTIONS.pairing.title}</p>
          <p className="text-ds-caption text-ds-fog">{PAIRING_QR_CAPTIONS.pairing.hint}</p>
        </div>
      ) : phase === "ready" ? (
        <div className="text-center">
          <span className="ct-connect-success mx-auto flex size-14 items-center justify-center rounded-full bg-ds-soft-mint text-ds-vivid-green">
            <CheckCircle className="size-7" aria-hidden />
          </span>
          <p className="ct-qr-enter mt-ds-12 text-ds-body font-medium text-ds-charcoal">{PAIRING_QR_CAPTIONS.ready}</p>
        </div>
      ) : phase === "error" ? (
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ds-rose-wash text-ds-rose-ink">
            <WarningCircle className="size-7" aria-hidden />
          </span>
          <p className="mt-ds-12 text-ds-body font-medium text-ds-charcoal">{PAIRING_QR_CAPTIONS.error}</p>
        </div>
      ) : (
        <div className="text-center">
          {phase === "starting" ? (
            <div className="mx-auto size-48 animate-pulse rounded-lg bg-ds-paper-mist motion-reduce:animate-none" aria-hidden />
          ) : (
            <LockKey className="mx-auto size-7 text-ds-silver" aria-hidden />
          )}
          <p className="mt-ds-12 text-ds-body font-medium text-ds-charcoal">
            {phase === "starting" ? (
              <span className="ct-shimmer-text" data-text={PAIRING_QR_CAPTIONS.starting}>{PAIRING_QR_CAPTIONS.starting}</span>
            ) : (
              PAIRING_QR_CAPTIONS.idle
            )}
          </p>
        </div>
      )}
    </div>
  );
}
