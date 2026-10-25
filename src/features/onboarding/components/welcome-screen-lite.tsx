"use client";

/**
 * /welcome no visual Lite (Onda 8): a mesma saudação (calculada no servidor, no fuso de São Paulo), o mesmo texto do
 * papel, um único botão principal (continuar a configuração ou ir para o painel), o progresso real e o mesmo
 * "Explorar o sistema agora" (mesma action). Sem gradiente, sem partículas, sem animação infinita.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Compass, Lock } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { dismissTenantOnboarding } from "@/features/onboarding/actions/dismiss-tenant-onboarding";
import type { TenantOnboarding, TenantOnboardingStep } from "@/features/onboarding/types/onboarding.types";
import type { TenantRole } from "@/shared/db/schema";
import { roleConfig } from "./welcome-screen";
import styles from "./welcome-screen-lite.module.css";

function StepIcon({ status }: { status: TenantOnboardingStep["status"] }) {
  if (status === "completed") return <CheckCircle2 aria-label="Concluída" size={18} className={styles.iconDone} />;
  if (status === "pending") return <CircleDashed aria-label="Pendente" size={18} className={styles.iconPending} />;
  return <Lock aria-label="Indisponível" size={18} className={styles.iconLocked} />;
}

export function WelcomeScreenLite({ userName, role, tenantName, onboarding, greeting }: {
  userName: string;
  role: TenantRole;
  tenantName: string;
  onboarding: TenantOnboarding | null;
  /** "Bom dia", "Boa tarde" ou "Boa noite", calculado no servidor (fuso de São Paulo). */
  greeting: string;
}) {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) window.location.replace("/dashboard");
  }, []);
  const router = useRouter();
  const [dismissing, startTransition] = useTransition();
  const config = roleConfig[role];
  const firstName = userName.split(" ")[0];

  const steps = onboarding?.steps ?? [];
  const progressPct = onboarding?.progressPercentage ?? 0;
  const completedSteps = onboarding?.completedSteps ?? 0;
  const availableSteps = onboarding?.availableSteps ?? 0;
  const hasPendingEssential = steps.filter((step) => step.essential).some((step) => step.status === "pending");
  const firstPending = steps.find((step) => step.status === "pending" && step.href !== null);

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissTenantOnboarding();
      if (result.success) router.push(config.ctaHref);
      else toast.error(result.error ?? "Erro ao dispensar onboarding.");
    });
  };

  return (
    <div className={styles.column}>
      <section className={page.card} aria-labelledby="welcome-title">
        <div className={styles.headRow}>
          <span className={page.cellSub}>{tenantName}</span>
          <span className={page.badge}>{config.label}</span>
        </div>
        <div className={page.cardHead}>
          <span className={page.muted}>{greeting}</span>
          <h2 id="welcome-title" className={styles.name}>{firstName}</h2>
          <p className={page.cardDescription}>{config.message}</p>
        </div>
        <ul className={styles.features}>
          {config.features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
        <div className={styles.ctaRow}>
          {hasPendingEssential && firstPending ? (
            <button type="button" className={page.primaryButton} onClick={() => router.push(firstPending.href!)}>
              Continuar configuração <ArrowRight aria-hidden="true" size={16} />
            </button>
          ) : (
            <Link href={config.ctaHref} className={page.primaryButton}>
              {config.cta} <ArrowRight aria-hidden="true" size={16} />
            </Link>
          )}
          <button type="button" className={page.button} onClick={handleDismiss} disabled={dismissing}>
            <Compass aria-hidden="true" size={16} /> Explorar o sistema agora
          </button>
        </div>
        {availableSteps > 0 ? (
          <div className={styles.progress}>
            <span className={styles.progressLine}>
              <span className={page.muted}>Configuração inicial</span>
              <span className={page.numeric}>{completedSteps} de {availableSteps}</span>
            </span>
            <span className={styles.track} role="progressbar" aria-label="Progresso da configuração inicial" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
              <span className={styles.bar} style={{ width: `${progressPct}%` }} />
            </span>
          </div>
        ) : null}
      </section>

      {steps.length > 0 && steps.some((step) => step.status !== "unavailable") ? (
        <section className={page.card} aria-labelledby="welcome-steps-title">
          <h2 id="welcome-steps-title" className={page.cardTitle}>Configuração inicial</h2>
          <ul className={styles.steps}>
            {steps.map((step) => (
              <li key={step.id} className={styles.step} data-unavailable={step.status === "unavailable" ? "true" : undefined}>
                <StepIcon status={step.status} />
                <span className={styles.stepText}>
                  <span className={page.cellTitle}>{step.title}</span>
                  <span className={page.cellSub}>{step.description}</span>
                </span>
                {step.status === "pending" && step.href ? (
                  <button type="button" className={page.button} onClick={() => router.push(step.href!)}>{step.actionLabel ?? "Ir"}</button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className={page.cellSub}>CorreTop · CRM para corretoras de planos de saúde</p>
    </div>
  );
}
