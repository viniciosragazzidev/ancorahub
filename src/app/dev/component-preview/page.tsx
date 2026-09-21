"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import {
  Link2,
  BarChart3,
  Users,
  LayoutDashboard,
  Settings,
  Inbox,
} from "lucide-react";

import { DsFilledDarkCta } from "@/components/ui/ds-filled-dark-cta";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { DsGhostNavButton } from "@/components/ui/ds-ghost-nav-button";
import { DsOutlinedNavButton } from "@/components/ui/ds-outlined-nav-button";
import { DsDashboardCard } from "@/components/ui/ds-dashboard-card";
import { DsElevatedFeatureCard } from "@/components/ui/ds-elevated-feature-card";
import { DsInputField } from "@/components/ui/ds-input-field";
import { DsPillFeatureTag } from "@/components/ui/ds-pill-feature-tag";
import { DsPillBadge } from "@/components/ui/ds-pill-badge";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import { DsSidebarNavItem } from "@/components/ui/ds-sidebar-nav-item";
import { DsPageHeader } from "@/components/ui/ds-page-header";
import { DsStatTile } from "@/components/ui/ds-stat-tile";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import {
  DsDialog,
  DsDialogTrigger,
  DsDialogPopup,
  DsDialogHeader,
  DsDialogTitle,
  DsDialogDescription,
  DsDialogFooter,
} from "@/components/ui/ds-dialog";
import { DsTrendStatCard } from "@/components/ui/ds-trend-stat-card";
import { DsDonutChart } from "@/components/ui/ds-donut-chart";
import { DsBarChart } from "@/components/ui/ds-bar-chart";

/**
 * Isolated preview of the docs/design-system.md foundation components.
 * Not linked from any product nav; blocked outside development so it never
 * ships in production.
 */
export default function ComponentPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [dark, setDark] = useState(false);

  // Toggles the same `.dark` class the real app applies to <html> (see
  // app/layout.tsx) — not a locally-scoped class — so portaled content
  // (Dialog, dropdowns) inherits it correctly too, exactly like production.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [dark]);

  return (
    <div className="h-screen overflow-y-auto bg-ds-canvas-white px-ds-24 py-ds-48 font-ds-inter text-ds-charcoal">
      <div className="mx-auto flex max-w-[var(--ds-layout-page-max-width)] flex-col gap-ds-64">
        <header className="flex items-start justify-between gap-ds-16">
          <div>
            <h1 className="font-ds-satoshi text-ds-display font-medium tracking-ds-satoshi text-ds-charcoal">
              Component Preview
            </h1>
            <p className="mt-ds-8 text-ds-body-lg text-ds-fog">
              Fundação isolada de docs/design-system.md — não integrada a nenhuma rota do produto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="shrink-0 rounded-ds-buttons border border-ds-ash bg-ds-canvas-white px-ds-16 py-ds-8 font-ds-inter text-ds-body text-ds-charcoal hover:bg-ds-paper-mist"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <Section title="Filled Dark CTA">
          <Row>
            <DsFilledDarkCta>Sign up</DsFilledDarkCta>
            <DsFilledDarkCta disabled>Sign up</DsFilledDarkCta>
            <DsFilledDarkCta loading>Sign up</DsFilledDarkCta>
          </Row>
        </Section>

        <Section title="Outlined Action Button">
          <Row>
            <DsOutlinedActionButton>View invoices</DsOutlinedActionButton>
            <DsOutlinedActionButton disabled>View invoices</DsOutlinedActionButton>
            <DsOutlinedActionButton loading>View invoices</DsOutlinedActionButton>
          </Row>
        </Section>

        <Section title="Ghost Nav Button & Outlined Nav Button">
          <Row>
            <DsGhostNavButton>Product</DsGhostNavButton>
            <DsGhostNavButton disabled>Solutions</DsGhostNavButton>
            <DsOutlinedNavButton>Log in</DsOutlinedNavButton>
            <DsOutlinedNavButton disabled>Log in</DsOutlinedNavButton>
          </Row>
        </Section>

        <Section title="Dashboard Card">
          <Row>
            <DsDashboardCard className="w-64">
              <p className="text-ds-body font-medium">Total de leads</p>
              <p className="mt-ds-4 text-ds-heading-sm font-medium">1.284</p>
            </DsDashboardCard>
            <DsDashboardCard className="w-64 opacity-50">
              <p className="text-ds-body font-medium">Total de leads</p>
              <p className="mt-ds-4 text-ds-heading-sm font-medium">1.284</p>
            </DsDashboardCard>
          </Row>
        </Section>

        <Section title="Elevated Feature Card">
          <Row>
            <DsElevatedFeatureCard className="w-64">
              <p className="text-ds-body-lg font-medium">Product mockup</p>
              <p className="mt-ds-4 text-ds-body text-ds-fog">Ring shadow, sem borda.</p>
            </DsElevatedFeatureCard>
          </Row>
        </Section>

        <Section title="Input Field">
          <Row>
            <DsInputField placeholder="you@company.com" className="w-64" />
            <DsInputField placeholder="Disabled" disabled className="w-64" />
          </Row>
        </Section>

        <Section title="Pill Feature Tag">
          <Row>
            <DsPillFeatureTag icon={<Link2 size={16} />} accent="tangerine">
              Short Links
            </DsPillFeatureTag>
            <DsPillFeatureTag icon={<BarChart3 size={16} />} accent="lavender">
              Conversion Analytics
            </DsPillFeatureTag>
            <DsPillFeatureTag icon={<Users size={16} />} accent="vivid-green">
              Affiliate Programs
            </DsPillFeatureTag>
          </Row>
        </Section>

        <Section title="Pill Badge">
          <Row>
            <DsPillBadge>v2.4.0</DsPillBadge>
            <DsPillBadge>Beta</DsPillBadge>
          </Row>
        </Section>

        <Section title="Status Badge (variantes semânticas)">
          <Row>
            <DsStatusBadge status="pending" />
            <DsStatusBadge status="completed" />
            <DsStatusBadge status="success" />
            <DsStatusBadge status="warning" />
            <DsStatusBadge status="info" />
            <DsStatusBadge status="secondary" />
            <DsStatusBadge status="destructive" />
          </Row>
        </Section>

        <Section title="Page Header">
          <DsDashboardCard className="!p-0 overflow-hidden">
            <DsPageHeader
              title="Central de distribuição"
              breadcrumb="Operação comercial / Distribuição"
              description="Configure entradas, filas e plantões; acompanhe a operação no mesmo espaço."
              context={<DsStatusBadge status="success" label="Motor operacional" />}
              actions={<DsOutlinedActionButton>Relatórios</DsOutlinedActionButton>}
            />
          </DsDashboardCard>
        </Section>

        <Section title="Stat / KPI Tile">
          <DsDashboardCard className="w-full max-w-2xl">
            <div className="grid grid-cols-2 gap-ds-24 sm:grid-cols-4">
              <DsStatTile label="Disponíveis" value={12} icon={<Users size={14} />} />
              <DsStatTile label="Aguardando" value={4} tone="warning" icon={<Inbox size={14} />} />
              <DsStatTile label="Exceções" value={0} tone="success" />
              <DsStatTile label="Próximo passo" hint="Motor tentará distribuir" />
            </div>
          </DsDashboardCard>
        </Section>

        <Section title="Trend Stat Card">
          <Row>
            <DsTrendStatCard
              label="My Balance"
              value="$125,430"
              trendValue="12.5%"
              trendDirection="up"
              caption="compared to last month"
              className="w-64"
            />
            <DsTrendStatCard
              label="Expenses"
              value="$26,450"
              trendValue="5.5%"
              trendDirection="down"
              caption="compared to last month"
              className="w-64"
            />
            <DsTrendStatCard
              label="Leads novos"
              value="184"
              caption="Sem comparação disponível"
              className="w-64"
            />
            <DsTrendStatCard
              label="Pending Invoices"
              value="$3,200"
              caption="3 overdue invoices"
              className="w-64"
              chart={
                <DsBarChart
                  data={[
                    { d: "1", v: 4 }, { d: "2", v: 7 }, { d: "3", v: 3 }, { d: "4", v: 8 },
                    { d: "5", v: 5 }, { d: "6", v: 9 }, { d: "7", v: 6 }, { d: "8", v: 4 },
                  ]}
                  xKey="d"
                  series={[{ key: "v", label: "Valor" }]}
                  height={40}
                  compact
                />
              }
            />
          </Row>
        </Section>

        <Section title="Donut Chart">
          <DsDashboardCard className="w-80 p-ds-16">
            <DsDonutChart
              data={[
                { key: "hot", label: "Quente", value: 12 },
                { key: "warm", label: "Morno", value: 20 },
                { key: "cold", label: "Frio", value: 8 },
                { key: "qualified", label: "Qualificado", value: 15 },
              ]}
              centerValue={55}
              centerLabel="total"
              size={160}
            />
          </DsDashboardCard>
        </Section>

        <Section title="Dialog / Modal">
          <Row>
            <DsDialog>
              <DsDialogTrigger className="inline-flex items-center justify-center rounded-ds-buttons border border-ds-ash bg-ds-canvas-white px-ds-16 py-ds-12 font-ds-inter text-ds-body font-medium text-ds-charcoal hover:bg-ds-paper-mist">
                Abrir dialog
              </DsDialogTrigger>
              <DsDialogPopup>
                <DsDialogHeader>
                  <DsDialogTitle>Confirmar ação</DsDialogTitle>
                  <DsDialogDescription>
                    Isso é um teste do DsDialog re-skinnado sobre a engine @base-ui/react/dialog.
                  </DsDialogDescription>
                </DsDialogHeader>
                <DsDialogFooter>
                  <DsOutlinedActionButton>Cancelar</DsOutlinedActionButton>
                  <DsFilledDarkCta>Confirmar</DsFilledDarkCta>
                </DsDialogFooter>
              </DsDialogPopup>
            </DsDialog>
          </Row>
        </Section>

        <Section title="Empty State">
          <Row>
            <DsEmptyState
              icon={<Inbox size={20} />}
              title="Ainda não há eventos"
              description="Quando a equipe rotear ou atribuir leads, a explicação aparecerá aqui."
              className="w-96"
            />
            <DsDashboardCard className="w-96 !p-0">
              <DsEmptyState
                icon={<Inbox size={20} />}
                title="Nenhuma exceção"
                description="Aninhado num card — sem borda dupla."
                bordered={false}
              />
            </DsDashboardCard>
          </Row>
        </Section>

        <Section title="Sidebar Nav Item">
          <DsDashboardCard className="w-64 !p-ds-8">
            <nav className="flex flex-col gap-ds-4">
              <DsSidebarNavItem
                href="#"
                active
                icon={<LayoutDashboard size={16} />}
              >
                Dashboard
              </DsSidebarNavItem>
              <DsSidebarNavItem href="#" icon={<Users size={16} />}>
                Leads
              </DsSidebarNavItem>
              <DsSidebarNavItem href="#" icon={<Settings size={16} />}>
                Configurações
              </DsSidebarNavItem>
            </nav>
          </DsDashboardCard>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-ds-16">
      <h2 className="text-ds-heading-sm font-medium text-ds-charcoal">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-ds-16">{children}</div>;
}
