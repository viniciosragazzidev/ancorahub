import { headers } from "next/headers";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { listTrackingLinks } from "@/features/tracking-links/service";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { TrackingLinksLite } from "./_components/tracking-links-lite";

export const dynamic = "force-dynamic";

async function publicBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "crm.ancorasaude.cloud";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Marketing > Links rastreáveis (26/11/2026). Diretor e a função marketing, empresa toda. Antes da migration 0245,
 * a tela mostra que ainda não está ligada, sem quebrar o resto da área.
 */
export default async function MarketingLinksPage() {
  const context = await requireCapability(await getRequiredTenantContext(), "acessar_campanhas_meta");
  const [data, baseUrl] = await Promise.all([listTrackingLinks(context.tenantId), publicBaseUrl()]);

  if (!data.ready) {
    return (
      <>
        <DashboardHeader breadcrumb="Marketing" title="Links rastreáveis" summary="Ainda não ligado" />
        <main className={litePage.stack}>
          <section className={litePage.empty}>
            <p className={litePage.emptyTitle}>Links rastreáveis ainda não ligados</p>
            <p className={litePage.emptyText}>Falta uma atualização do banco nesta empresa. Assim que ela entrar, você cria os links aqui.</p>
          </section>
        </main>
      </>
    );
  }

  const leads = data.links.reduce((sum, link) => sum + link.leads, 0);
  const summary = [
    `${data.links.length.toLocaleString("pt-BR")} ${data.links.length === 1 ? "link" : "links"}`,
    `${leads.toLocaleString("pt-BR")} ${leads === 1 ? "lead" : "leads"}`,
  ].join(" · ");

  return (
    <>
      <DashboardHeader breadcrumb="Marketing" title="Links rastreáveis" summary={summary} />
      <main className={litePage.stack}>
        <TrackingLinksLite initialLinks={data.links} numbers={data.numbers} baseUrl={baseUrl} />
      </main>
    </>
  );
}
