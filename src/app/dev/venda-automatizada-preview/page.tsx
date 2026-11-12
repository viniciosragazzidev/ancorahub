import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import litePage from "@/components/lite/page/lite-page.module.css";
import { autoSaleOverviewFixture, dealDetailFixture, eligibleLeadsFixture } from "@/features/auto-sale/fixtures";

import { AutoSaleWorkspace } from "../../(dashboard)/vendas/automatizada/_components/auto-sale-workspace";

/**
 * Prévia de desenvolvimento da Venda Automatizada (DEC-182), com dados fictícios e sem banco.
 * ?visual=normal mostra o visual normal; ?painel=negociacao abre o detalhe; ?painel=escolher abre a escolha.
 */
export default async function AutoSalePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const lite = params.visual !== "normal";
  const user = {
    name: "Diretora de Demonstração", role: "Diretor", roleKey: "director" as const, jobTitle: "director", branchId: null,
    permissions: ["acessar_dashboard", "acessar_vendas", "ver_dashboard_equipe", "acessar_leads"], redirectLogout: "/login", isPlatformAdmin: false, relationshipCenterEnabled: false,
  };
  return (
    <AppShell
      directorLiteEnabled={lite}
      autoSaleEnabled
      user={{ name: user.name, email: "demo@exemplo.test", role: "director", jobTitle: "director", isPlatformAdmin: false }}
      initialSidebarUser={user}
      initialSidebarPathname="/vendas/automatizada"
      initialSidebarOnDuty={false}
      branding={{ tenantName: "Âncora Saúde", brandColor: null, logoUrl: null }}
    >
      <main className={lite ? litePage.stack : "flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6"}>
        <AutoSaleWorkspace
          overview={autoSaleOverviewFixture()}
          lite={lite}
          isDirector
          preview={{ leads: eligibleLeadsFixture(), detail: dealDetailFixture(), openDeal: params.painel === "negociacao" ? "deal-1" : undefined, picking: params.painel === "escolher" }}
        />
      </main>
    </AppShell>
  );
}
