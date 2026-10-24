"use client";

/** Aba "Visão da operação" no visual Lite: painel essencial (plantões, leads por fila, WhatsApp dos corretores). */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { DirectorLiteChrome, type DashboardBranch } from "./director-lite-chrome";
import styles from "./director-lite.module.css";
import { EssentialView } from "./essential-view";

export type { DashboardBranch };

export function DirectorLiteDashboard({ data, period, branchId, branches, now }: {
  data: EssentialDashboard;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  now: Date;
}) {
  return (
    <DirectorLiteChrome now={now} tab="overview" period={period} branchId={branchId} branches={branches} firstName={data.firstName}>
      <p className={styles.hint}>O período muda só os leads por fila. Plantões e WhatsApp mostram agora.</p>
      <EssentialView data={data} />
    </DirectorLiteChrome>
  );
}
