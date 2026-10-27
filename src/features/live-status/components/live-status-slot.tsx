import "server-only";

import { Suspense } from "react";

import type { TenantContext } from "@/shared/auth/types";

import { getLiveStatuses } from "../service";
import { LiveStatusHost } from "./live-status-host";
import styles from "./live-status-slot.module.css";

function statusStripClassName(role: TenantContext["role"], className?: string) {
  const roleClass = role === "director" || role === "manager" ? styles.managementStrip : styles.personalStrip;
  return [roleClass, className].filter(Boolean).join(" ");
}

/** A faixa é um Server Component suspensível: o resto da página pode pintar antes das consultas agregadas. */
export async function LiveStatusSlot({ context, className }: { context: TenantContext; className?: string }) {
  const payload = await getLiveStatuses(context).catch((error) => {
    console.warn("[live-status] strip unavailable", { message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return null;
  });
  if (!payload || (!payload.statuses.length && !payload.seals.length)) return null;
  return <LiveStatusHost initial={payload} className={statusStripClassName(context.role, className)} />;
}

/** Reserva o mesmo conjunto de cartões enquanto a faixa carrega. */
export function LiveStatusFallback({ role, className }: { role: TenantContext["role"]; className?: string }) {
  const hasSeal = role === "director" || role === "manager";
  const count = hasSeal ? 8 : 3;
  return (
    <section className={[styles.strip, statusStripClassName(role, className)].filter(Boolean).join(" ")} aria-hidden="true" data-live-status-fallback="">
      <header className={styles.stripHead}>
        <span className={styles.titleSkeleton} />
        {hasSeal ? <span className={styles.sealSkeleton} /> : null}
      </header>
      <div className={styles.grid}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={[styles.card, styles.cardSkeleton].join(" ")}>
            <span className={styles.lineSkeleton} />
            <span className={styles.valueSkeleton} />
            <span className={styles.lineSkeleton} />
            <span className={styles.copySkeleton} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Use somente depois de a tela Lite confirmar a chave. Desligada, não emite nenhum elemento no HTML. */
export function LiveStatusBoundary({ context, enabled, className }: { context: TenantContext; enabled: boolean; className?: string }) {
  if (!enabled) return null;
  return (
    <Suspense fallback={<LiveStatusFallback role={context.role} className={className} />}>
      <LiveStatusSlot context={context} className={className} />
    </Suspense>
  );
}
