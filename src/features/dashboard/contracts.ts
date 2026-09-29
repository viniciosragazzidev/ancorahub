import type { TenantContext } from "@/shared/auth/types";

export type DashboardMetricTone = "default" | "success" | "warning" | "danger";

export type DashboardMetric = {
  id: string;
  label: string;
  value: string | number;
  description?: string;
  tone?: DashboardMetricTone;
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  tone: "info" | "warning" | "danger";
};

export type DashboardSection = {
  id: string;
  title: string;
  description?: string;
  emptyMessage?: string;
};

export type DashboardViewModel = {
  header: { title: string; description: string };
  metrics: readonly DashboardMetric[];
  attention: readonly DashboardAttentionItem[];
  primary: DashboardSection;
  secondary?: DashboardSection;
};

export type DashboardProfile = "director" | "manager" | "supervisor" | "broker";

export type DashboardResolution = {
  profile: DashboardProfile;
  primarySectionId: string;
  attentionTitle: string;
  maxMetrics: 4;
};

export function resolveDashboardProfile(context: Pick<TenantContext, "role">): DashboardResolution {
  switch (context.role) {
    case "broker":
      return { profile: "broker", primarySectionId: "next-work", attentionTitle: "O que precisa da sua atenção agora", maxMetrics: 4 };
    case "supervisor":
      return { profile: "supervisor", primarySectionId: "team-priorities", attentionTitle: "Quem precisa de atenção", maxMetrics: 4 };
    case "manager":
      return { profile: "manager", primarySectionId: "unit-health", attentionTitle: "Atenção agora na unidade", maxMetrics: 4 };
    default:
      return { profile: "director", primarySectionId: "unit-health", attentionTitle: "Atenção agora na operação", maxMetrics: 4 };
  }
}
