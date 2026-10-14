"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowsClockwise, CheckCircle, Copy, LockKey, Phone, WarningCircle, WhatsappLogo } from "@/components/huge-icons";
import { CopyCheckIcon } from "@/components/motion/copy-check-icon";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/core/cn";
import type { PairingPhase } from "@/features/waha-cadence/pairing-phase";
import {
  PAIRING_CODE_CAPTIONS,
  PAIRING_COPY,
  PAIRING_QR_CAPTIONS,
  type PairingMethod,
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

const STEPS: Record<PairingMethod, readonly string[]> = {
  qr: ["Preparar", "Escanear", "Conectar"],
  code: ["Preparar", "Digitar código", "Conectar"],
};

function stepIndexFor(phase: PairingPhase): { active: number; done: number } {
  switch (phase) {
    case "starting": return { active: 0, done: 0 };
    case "qr": return { active: 1, done: 1 };
    case "pairing": return { active: 2, done: 2 };
    case "ready": return { active: -1, done: 3 };
    default: return { active: -1, done: 0 };
  }
}

export function PairingStepper({ phase, method = "qr" }: { phase: PairingPhase; method?: PairingMethod }) {
  const { active, done } = stepIndexFor(phase);
  const steps = STEPS[method];
  return (
    <ol className="flex flex-wrap items-center gap-ds-8" aria-label="Progresso da conexão">
      {steps.map((label, index) => {
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
            {index < steps.length - 1 && (
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
  /** Pareamento por QR (padrão) ou por código digitado no WhatsApp. */
  method?: PairingMethod;
  /** Um código de pareamento está na tela. */
  hasCode?: boolean;
};

const ICONS: Record<PairingIcon, (props: { className?: string }) => React.ReactNode> = {
  lock: (p) => <LockKey aria-hidden {...p} />,
  spinner: (p) => <ArrowsClockwise aria-hidden {...p} className={cn(p.className, "animate-spin motion-reduce:animate-none")} />,
  phone: (p) => <Phone aria-hidden {...p} />,
  check: (p) => <CheckCircle aria-hidden {...p} />,
  warning: (p) => <WarningCircle aria-hidden {...p} />,
};

function guideKeyFor({ phase, stalled, renewing, method, hasCode }: Pick<PairingGuideProps, "phase" | "stalled" | "renewing" | "method" | "hasCode">): PairingCopyKey {
  if (method === "code") {
    if (phase === "error") return "codeError";
    if (phase === "idle" || phase === "starting" || phase === "qr") return hasCode ? "code" : "codeIntro";
  }
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

export function PairingGuide({ phase, phoneSuffix, stalled, connectivity, renewing, method = "qr", hasCode = false }: PairingGuideProps) {
  const copyKey = guideKeyFor({ phase, stalled, renewing, method, hasCode });
  return (
    <div className="space-y-ds-8">
      <FadeSwap swapKey={copyKey}>
        <PairingCopyCallout copyKey={copyKey} phoneSuffix={phoneSuffix} />
      </FadeSwap>
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

// ── Transições ────────────────────────────────────────────────────────

const EASE_OUT = [0.25, 1, 0.5, 1] as const;

/**
 * Troca animada de conteúdo (fade + leve deslocamento + desfoque). Sem
 * animação quando o usuário desligou o movimento da interface.
 */
export function FadeSwap({ swapKey, children, className }: { swapKey: string; children: React.ReactNode; className?: string }) {
  const enabled = useInterfaceMotionEnabled();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={swapKey}
        className={className}
        initial={enabled ? { opacity: 0, y: 8, filter: "blur(4px)" } : false}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={enabled ? { opacity: 0, y: -6, filter: "blur(4px)" } : { opacity: 0 }}
        transition={{ duration: enabled ? 0.22 : 0, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Painel do código de pareamento ────────────────────────────────────

/** "21999998888" → "(21) 99999-8888". */
export function formatPairingPhone(national: string) {
  const digits = national.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

export type PairingCodePanelProps = {
  phase: PairingPhase;
  /** DDD + número (sem o 55). Vazio quando o cadastro não tem telefone. */
  phone: string;
  onPhoneChange: (phone: string) => void;
  /** Código atual ("ABCD-1234"), ou null antes de gerar. */
  code: string | null;
  generating: boolean;
  /** Segundos até poder pedir outro código (limite do WhatsApp). */
  cooldownSeconds: number;
  /** O código anterior morreu (sessão renovada): pedir outro. */
  expired: boolean;
  onGenerate: () => void;
  onOpenWhatsApp: () => void;
};

export function PairingCodePanel({
  phase,
  phone,
  onPhoneChange,
  code,
  generating,
  cooldownSeconds,
  expired,
  onGenerate,
  onOpenWhatsApp,
}: PairingCodePanelProps) {
  const [editing, setEditing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const phoneValid = /^\d{10,11}$/.test(phone);
  const showEditor = editing || !phoneValid;
  const stage = code ? "code" : generating ? "generating" : "phone";

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.replace(/[^A-Z0-9]/gi, ""));
      setCopied(true);
    } catch {
      // Sem permissão de área de transferência: o código continua visível para digitar.
    }
  }

  return (
    <div
      className="flex min-h-64 flex-col justify-center rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-16"
      data-phase={phase}
      data-stage={stage}
    >
      <FadeSwap swapKey={stage} className="space-y-ds-16">
        {stage === "code" && code ? (
          <>
            <div className="space-y-ds-8 text-center">
              <p className="text-ds-caption font-medium text-ds-fog">Seu código</p>
              <PairingCodeDigits code={code} />
              <p className="text-ds-caption text-ds-fog">
                para <span className="font-medium tabular-nums text-ds-charcoal">+55 {formatPairingPhone(phone)}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-ds-8">
              <Button variant="outline" size="sm" onClick={copy} aria-label={copied ? PAIRING_CODE_CAPTIONS.copied : PAIRING_CODE_CAPTIONS.copy}>
                <CopyCheckIcon copied={copied}><Copy className="size-4" aria-hidden /></CopyCheckIcon>
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenWhatsApp}>
                <WhatsappLogo className="size-4" aria-hidden /> {PAIRING_CODE_CAPTIONS.openWhatsApp}
              </Button>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={cooldownSeconds > 0 || generating}
              className="mx-auto flex items-center gap-ds-4 text-ds-caption font-medium text-ds-electric-blue underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-ds-fog disabled:no-underline"
            >
              <ArrowsClockwise className="size-3" aria-hidden />
              <span className="tabular-nums">{cooldownSeconds > 0 ? `${PAIRING_CODE_CAPTIONS.regenerate} em ${cooldownSeconds}s` : PAIRING_CODE_CAPTIONS.regenerate}</span>
            </button>
          </>
        ) : stage === "generating" ? (
          <div className="space-y-ds-12 text-center">
            <PairingCodeSkeleton />
            <p className="text-ds-body font-medium">
              <span className="ct-shimmer-text" data-text={PAIRING_CODE_CAPTIONS.generating}>{PAIRING_CODE_CAPTIONS.generating}</span>
            </p>
          </div>
        ) : (
          <>
            {expired && (
              <p className="rounded-ds-inputs border border-ds-amber-ink bg-ds-amber-wash px-ds-12 py-ds-8 text-ds-caption text-ds-charcoal" role="status">
                {PAIRING_CODE_CAPTIONS.expired}
              </p>
            )}
            <div className="space-y-ds-8">
              <div className="flex items-center justify-between gap-ds-8">
                <label htmlFor="pairing-phone" className="text-ds-caption font-medium text-ds-fog">{PAIRING_CODE_CAPTIONS.phoneLabel}</label>
                {phoneValid && !editing && (
                  <button type="button" onClick={() => setEditing(true)} className="text-ds-caption font-medium text-ds-electric-blue underline-offset-4 hover:underline">
                    {PAIRING_CODE_CAPTIONS.change}
                  </button>
                )}
              </div>
              <FadeSwap swapKey={showEditor ? "edit" : "view"}>
                {showEditor ? (
                  <div className="flex items-center gap-ds-8">
                    <span className="shrink-0 text-ds-body font-medium tabular-nums text-ds-charcoal">+55</span>
                    <Input
                      id="pairing-phone"
                      name="pairing-phone"
                      format="none"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      autoFocus={editing}
                      placeholder="(21) 99999-8888"
                      value={formatPairingPhone(phone)}
                      onChange={(event) => onPhoneChange(event.target.value.replace(/\D/g, "").slice(0, 11))}
                      aria-invalid={phone.length > 0 && !phoneValid ? true : undefined}
                      className="h-10 rounded-ds-inputs border-black bg-ds-canvas-white px-ds-12 text-ds-body tabular-nums dark:border-border"
                      onBlur={() => { if (phoneValid) setEditing(false); }}
                    />
                  </div>
                ) : (
                  <p className="rounded-ds-inputs border border-ds-ash bg-ds-paper-mist px-ds-12 py-ds-8 text-ds-body font-medium tabular-nums text-ds-charcoal">
                    +55 {formatPairingPhone(phone)}
                  </p>
                )}
              </FadeSwap>
              {!phoneValid && <p className="text-ds-caption text-ds-fog">{PAIRING_CODE_CAPTIONS.phoneMissing}</p>}
            </div>
            <Button className="w-full" disabled={!phoneValid || cooldownSeconds > 0} onClick={() => { setEditing(false); onGenerate(); }}>
              <span className="tabular-nums">{cooldownSeconds > 0 ? `${PAIRING_CODE_CAPTIONS.generate} em ${cooldownSeconds}s` : PAIRING_CODE_CAPTIONS.generate}</span>
            </Button>
          </>
        )}
      </FadeSwap>
    </div>
  );
}

/** Os 8 caracteres em dois blocos de 4, entrando um a um. */
function PairingCodeDigits({ code }: { code: string }) {
  const enabled = useInterfaceMotionEnabled();
  const chars = code.replace(/[^A-Z0-9]/gi, "").toUpperCase().split("");
  const groups = [chars.slice(0, 4), chars.slice(4)];
  return (
    <div className="flex items-center justify-center gap-ds-8" role="img" aria-label={`Código ${chars.join(" ")}`}>
      {groups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <span aria-hidden className="h-0.5 w-2 rounded-full bg-ds-silver" />}
          <div className="flex gap-ds-4">
            {group.map((char, index) => {
              const order = groupIndex * 4 + index;
              return (
                <motion.span
                  key={`${code}-${order}`}
                  aria-hidden
                  className="flex h-11 w-7 items-center justify-center rounded-ds-inputs border border-ds-ash bg-ds-paper-mist font-ds-mono text-lg font-semibold text-ds-charcoal"
                  initial={enabled ? { opacity: 0, y: 10, scale: 0.9, filter: "blur(3px)" } : false}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{ duration: enabled ? 0.28 : 0, delay: enabled ? order * 0.045 : 0, ease: EASE_OUT }}
                >
                  {char}
                </motion.span>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function PairingCodeSkeleton() {
  return (
    <div className="flex items-center justify-center gap-ds-8" aria-hidden>
      {[0, 1].map((group) => (
        <React.Fragment key={group}>
          {group > 0 && <span className="h-0.5 w-2 rounded-full bg-ds-ash" />}
          <div className="flex gap-ds-4">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="h-11 w-7 animate-pulse rounded-ds-inputs bg-ds-paper-mist motion-reduce:animate-none" />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
