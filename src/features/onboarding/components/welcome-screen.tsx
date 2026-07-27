"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  CircleDashed,
  Compass,
  LockKey,
  Target,
  Users,
} from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dismissTenantOnboarding } from "@/features/onboarding/actions/dismiss-tenant-onboarding";
import type { TenantOnboarding, TenantOnboardingStep } from "@/features/onboarding/types/onboarding.types";

// ─── Types ──────────────────────────────────────────────────────────────────

type WelcomeScreenProps = {
  userName: string;
  role: "director" | "manager" | "broker";
  tenantName: string;
  onboarding: TenantOnboarding | null;
};

// ─── Time-based greeting ────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Bom dia", emoji: "☀️" };
  if (hour >= 12 && hour < 18) return { text: "Boa tarde", emoji: "🌤️" };
  return { text: "Boa noite", emoji: "🌙" };
}

// ─── Role configuration ─────────────────────────────────────────────────────

const roleConfig = {
  director: {
    label: "Diretor",
    icon: ChartLineUp,
    warning: "from-violet-500 to-purple-600",
    warningLight: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    borderGlow: "shadow-violet-500/20",
    message:
      "Configure sua corretora, organize filiais, convide sua equipe e acompanhe os resultados do negócio em tempo real.",
    features: [
      "Gerencie filiais e equipes",
      "Acompanhe metas e comissões",
      "Visualize dashboards executivos",
    ],
    cta: "Ir para o dashboard",
    ctaHref: "/dashboard",
  },
  manager: {
    label: "Gestor",
    icon: Users,
    warning: "from-blue-500 to-cyan-600",
    warningLight: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    borderGlow: "shadow-blue-500/20",
    message:
      "Acompanhe o desempenho da sua filial, distribua leads para a equipe e garanta que nada passe despercebido.",
    features: [
      "Distribua leads para corretores",
      "Acompanhe métricas da filial",
      "Valide documentos e aprovações",
    ],
    cta: "Ir para o dashboard",
    ctaHref: "/dashboard",
  },
  broker: {
    label: "Corretor",
    icon: Target,
    warning: "from-emerald-500 to-teal-600",
    warningLight: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    borderGlow: "shadow-emerald-500/20",
    message:
      "Organize seus leads, atenda clientes pelo WhatsApp, acompanhe suas metas e feche mais negócios.",
    features: [
      "Atenda leads pelo chat interno",
      "Acompanhe sua fila de atendimento",
      "Veja seu progresso em metas",
    ],
    cta: "Ir para minha fila",
    ctaHref: "/minha-fila",
  },
};

// ─── Floating particles ─────────────────────────────────────────────────────

function FloatingDots() {
  const positions = [
    { x: 15, y: 20, size: 3 },
    { x: 75, y: 15, size: 2 },
    { x: 85, y: 70, size: 2.5 },
    { x: 10, y: 80, size: 2 },
    { x: 45, y: 10, size: 3 },
    { x: 60, y: 85, size: 2 },
    { x: 25, y: 55, size: 2.5 },
    { x: 90, y: 40, size: 2 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {positions.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/10 dark:bg-primary/20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -15 + (i % 3) * 5, 0],
            opacity: [0.2, 0.7, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4 + (i % 3) * 2,
            delay: i * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Gradient decoration ─────────────────────────────────────────────────────

function WarningShapes({ warning }: { warning: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className={`absolute -right-32 -top-32 size-80 rounded-full bg-gradient-to-br ${warning} opacity-[0.03] dark:opacity-[0.06]`}
        animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute -bottom-40 -left-40 size-96 rounded-full bg-gradient-to-tr ${warning} opacity-[0.02] dark:opacity-[0.04]`}
        animate={{ scale: [1, 1.08, 1], rotate: [0, -5, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute left-1/4 top-1/3 size-2 rounded-full bg-gradient-to-r ${warning} opacity-20`}
        animate={{ y: [0, -8, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute right-1/3 top-2/3 size-1.5 rounded-full bg-gradient-to-r ${warning} opacity-20`}
        animate={{ y: [0, 6, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
    </div>
  );
}

// ─── Step indicator dots ────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i < current
              ? "bg-foreground w-1.5"
              : i === current
                ? "bg-foreground w-6"
                : "bg-foreground/10 w-1.5"
            }`}
          animate={i === current ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
        />
      ))}
    </div>
  );
}

// ─── Feature items ──────────────────────────────────────────────────────────

function FeatureItem({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1], delay }}
      className="flex items-center gap-2.5"
    >
      <div className="flex size-5 items-center justify-center rounded-full bg-primary/10">
        <div className="size-1.5 rounded-full bg-primary" />
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </motion.div>
  );
}

// ─── Step status icon ───────────────────────────────────────────────────────

function StepIcon({ status }: { status: TenantOnboardingStep["status"] }) {
  if (status === "completed")
    return <CheckCircle className="size-4 text-emerald-500" weight="fill" />;
  if (status === "pending")
    return <CircleDashed className="size-4 text-amber-500" />;
  return <LockKey className="size-4 text-muted-foreground/40" />;
}

// ─── Onboarding steps list ─────────────────────────────────────────────────

function OnboardingStepsCard({
  steps,
  onNavigate,
}: {
  steps: TenantOnboardingStep[];
  onNavigate: (href: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.6, ease: [0, 0, 0.2, 1] }}
      className="rounded-xl border border-border/60 bg-muted/20 p-4"
    >
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Configuração inicial
      </h3>
      <div className="mt-3 space-y-1.5">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.2,
              delay: 0.7 + i * 0.06,
              ease: [0, 0, 0.2, 1],
            }}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/50"
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${step.status === "unavailable"
                    ? "text-muted-foreground/50"
                    : "text-foreground"
                  }`}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {step.description}
              </p>
            </div>
            {step.status === "pending" && step.href && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs"
                onClick={() => onNavigate(step.href!)}
              >
                {step.actionLabel ?? "Ir"}
              </Button>
            )}
            {step.status === "completed" && (
              <CheckCircle
                className="size-4 shrink-0 text-emerald-500"
                weight="fill"
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WelcomeScreen({
  userName,
  role,
  tenantName,
  onboarding,
}: WelcomeScreenProps) {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      window.location.replace("/dashboard");
    }
  }, []);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const greeting = getGreeting();
  const config = roleConfig[role];
  const firstName = userName.split(" ")[0];

  const steps = onboarding?.steps ?? [];
  const progressPct = onboarding?.progressPercentage ?? 0;
  const completedSteps = onboarding?.completedSteps ?? 0;
  const availableSteps = onboarding?.availableSteps ?? 0;
  const hasPendingEssential = steps
    .filter((s) => s.essential)
    .some((s) => s.status === "pending");
  const firstPending = steps.find(
    (s) => s.status === "pending" && s.href !== null,
  );

  const handleDismiss = async () => {
    startTransition(async () => {
      const result = await dismissTenantOnboarding();
      if (result.success) {
        router.push(config.ctaHref);
      } else {
        toast.error(result.error ?? "Erro ao dispensar onboarding.");
      }
    });
  };

  const handleStepNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-4">
      {/* Background decorative elements */}
      <WarningShapes warning={config.warning} />
      <FloatingDots />

      {/* Main content container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
        className="relative z-10 mx-auto w-full max-w-lg"
      >
        {/* Card */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ${config.borderGlow} shadow-black/5`}
        >
          {/* warning top bar */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${config.warning}`} />

          <div className="p-8 sm:p-10">
            {/* Brand + Role */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease: [0, 0, 0.2, 1] }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground shadow-sm">
                  C
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  {tenantName}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`gap-1.5 rounded-full border-0 px-3 py-1 text-xs font-medium ${config.warningLight}`}
              >
                <svg className="size-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.1 2.3a.9.9 0 0 1 1.8 0l.8 3.6a4.8 4.8 0 0 0 3.8 3.8l3.6.8a.9.9 0 0 1 0 1.8l-3.6.8a4.8 4.8 0 0 0-3.8 3.8l-.8 3.6a.9.9 0 0 1-1.8 0l-.8-3.6a4.8 4.8 0 0 0-3.8-3.8l-3.6-.8a.9.9 0 0 1 0-1.8l3.6-.8a4.8 4.8 0 0 0 3.8-3.8l.8-3.6Z" />
                </svg>
                {config.label}
              </Badge>
            </motion.div>

            {/* Greeting */}
            <div className="mt-8 space-y-1">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: [0, 0, 0.2, 1] }}
                className="text-sm font-medium text-muted-foreground"
              >
                {greeting.text} <span className="inline-block">{greeting.emoji}</span>
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3, ease: [0, 0, 0.2, 1] }}
                className="text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </motion.h1>
            </div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4, ease: [0, 0, 0.2, 1] }}
              className="mt-4 text-sm leading-relaxed text-muted-foreground"
            >
              {config.message}
            </motion.p>

            {/* Features list */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="mt-6 space-y-2.5"
            >
              {config.features.map((feature, i) => (
                <FeatureItem key={feature} text={feature} delay={0.5 + i * 0.12} />
              ))}
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, delay: 0.7, ease: [0, 0, 0.2, 1] }}
              className="my-6 h-px origin-left bg-border"
            />

            {/* CTA + Progress */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8, ease: [0, 0, 0.2, 1] }}
              className="flex flex-col gap-4"
            >
              {/* Main call to action */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {hasPendingEssential && firstPending ? (
                  <Button
                    size="lg"
                    className={`group relative overflow-hidden bg-gradient-to-r ${config.warning} px-6 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
                    onClick={() => handleStepNavigate(firstPending.href!)}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Continuar configuração
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-300 group-hover:translate-x-0" />
                  </Button>
                ) : (
                  <Link href={config.ctaHref}>
                    <Button
                      size="lg"
                      className={`group relative overflow-hidden bg-gradient-to-r ${config.warning} px-6 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {config.cta}
                        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </span>
                      <div className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-300 group-hover:translate-x-0" />
                    </Button>
                  </Link>
                )}

                {/* Step dots with real progress */}
                {availableSteps > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {completedSteps}/{availableSteps}
                    </span>
                    <StepDots current={completedSteps} total={availableSteps} />
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {availableSteps > 0 && (
                <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${config.warning}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
                  />
                </div>
              )}
            </motion.div>

            {/* Skip / dismiss link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.9 }}
              className="mt-4 flex items-center justify-between"
            >
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <Compass className="size-3" />
                Explorar o sistema agora
              </button>
            </motion.div>
          </div>
        </div>

        {/* Onboarding Steps Card */}
        {steps.length > 0 && steps.some((s) => s.status !== "unavailable") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1, ease: [0, 0, 0.2, 1] }}
          >
            <OnboardingStepsCard steps={steps} onNavigate={handleStepNavigate} />
          </motion.div>
        )}

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.1 }}
          className="mt-6 text-center text-[11px] text-muted-foreground/40"
        >
          CorreTop · CRM para corretoras de planos de saúde
        </motion.p>
      </motion.div>
    </div>
  );
}
