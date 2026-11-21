"use client";

import Link from "next/link";

import { SidebarProvider } from "@/components/ui/sidebar";
import { CommandCenter } from "@/features/dashboard/components/command-center";
import { UnitManagerLinks } from "@/features/dashboard/components/allowed-link";
import { AUTO_RULE_KEYS, defaultAutoRuleSettings } from "@/features/post-sale-audit/auto-rules";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/shared/auth/permissions";
import { visibleNavAreas, type NavAccessUser } from "@/shared/navigation/nav-registry";
import { PostSaleWorkspace } from "@/app/(dashboard)/equipe/pos-venda/post-sale-workspace";

import { buildCommandCenter, emptyCommandCenter, NOW_ISO } from "../diretor-dashboard-preview/_components/data";

export type Case = "matriz" | "niteroi" | "sem-unidade";
export type Screen = "painel" | "pos-venda";

const CASES: Record<Case, { label: string; unit: "centro" | "barra" | null; brokers: string[] }> = {
  matriz: { label: "Gestor da Matriz", unit: "centro", brokers: ["Ana Lima", "Bruno Reis", "Carla Souza"] },
  niteroi: { label: "Gestor de Niterói", unit: "barra", brokers: ["Diego Alves", "Elisa Prado"] },
  "sem-unidade": { label: "Gestor sem unidade", unit: null, brokers: [] },
};

const MANAGER: NavAccessUser = {
  roleKey: "manager",
  jobTitle: "manager",
  permissions: (Object.keys(PERMISSIONS) as PermissionKey[]).filter((key) => hasPermission("manager", key)),
  negotiationsEnabled: true,
  postSaleAuditEnabled: true,
  relationshipCenterEnabled: true,
};

type WorkspaceData = Parameters<typeof PostSaleWorkspace>[0]["initialData"];

function postSaleData(brokers: string[]): WorkspaceData {
  return {
    brokers: brokers.map((name, index) => ({ id: `b${index}`, name })),
    queues: [{ id: "q1", name: "Fila da unidade" }],
    branches: [],
    campaigns: [],
    responses: [],
    report: brokers.map((name, index) => ({ brokerId: `b${index}`, brokerName: name, sent: 6 - index, responded: 3, attendancePercent: 67, attendanceAnswered: 3, attended: 2, averageRating: 4.5, ratingCount: 2, ratingTotal: 9, closePercent: null, closeAnswered: 0, closed: 0, noContact: 1, openAlerts: index === 0 ? 1 : 0, customerReturned: 0 })),
    alerts: [],
    periodDays: 30,
    // O gestor vê a régua e a regra R0, mas só o diretor edita (getPostSaleWorkspaceAction devolve canEdit falso).
    r0: { enabled: false, queueIds: [], canEdit: false },
    ruleFilter: "all",
    autoRules: { ready: true, canEdit: false, rules: AUTO_RULE_KEYS.map((key) => defaultAutoRuleSettings(key)) },
  } as WorkspaceData;
}

/** Prévia de dev do modo gestor (20/11): menu, Painel e Pós-venda com os componentes reais e dados de exemplo. */
export function ManagerPreview({ caseId, screen }: { caseId: Case; screen: Screen }) {
  const item = CASES[caseId];
  const now = new Date(NOW_ISO);
  // Mesma regra do layout do painel: sem unidade, a aba Pós-venda não aparece.
  const areas = visibleNavAreas({ ...MANAGER, postSaleAuditEnabled: Boolean(item.unit) });
  return (
    <SidebarProvider>
    <div className="flex min-h-screen w-full bg-background">
      <aside aria-label="Menu do gestor" className="w-56 shrink-0 border-r border-border p-4 text-sm">
        <p className="mb-3 font-semibold">{item.label}</p>
        {areas.map(({ area, tabs }) => (
          <div key={area.id} className="mb-3">
            <p className="text-xs text-muted-foreground">{area.label}</p>
            <ul>{tabs.map((tab) => <li key={tab.id} className="py-0.5">{tab.label}</li>)}</ul>
          </div>
        ))}
        <nav aria-label="Casos" className="mt-6 grid gap-1 border-t border-border pt-3 text-xs">
          {(Object.keys(CASES) as Case[]).map((id) => (
            <Link key={id} href={`?caso=${id}&tela=${screen}`} className={id === caseId ? "font-semibold" : "text-muted-foreground"}>{CASES[id].label}</Link>
          ))}
          <Link href={`?caso=${caseId}&tela=painel`} className="mt-2">Painel</Link>
          <Link href={`?caso=${caseId}&tela=pos-venda`}>Pós-venda</Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        {screen === "painel" ? (
          <CommandCenter data={item.unit ? buildCommandCenter("today", item.unit, now) : emptyCommandCenter(now)} canManage unitManager />
        ) : item.unit ? (
          <UnitManagerLinks active>
            <PostSaleWorkspace initialTab="visao-geral" initialData={postSaleData(item.brokers)} />
          </UnitManagerLinks>
        ) : (
          <p className="text-sm text-muted-foreground">Sem unidade definida, o Pós-venda vai para Acesso negado (page.tsx confere a unidade da sessão).</p>
        )}
      </main>
    </div>
    </SidebarProvider>
  );
}
