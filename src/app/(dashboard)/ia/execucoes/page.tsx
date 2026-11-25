import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { summarizeAiRuns } from "@/features/ai-qualification/ai-runs-copy";
import { getAiRunsSummary, listAiRuns } from "@/features/ai-qualification/ai-runs-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { RunsWorkspace } from "./_components/runs-workspace";

export const dynamic = "force-dynamic";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Últimas execuções da IA (25/11/2026, "Execuções" do DeskComm): responde "por que a IA não respondeu?" com cada
 * chamada gravada, a falha explicada e o texto técnico recolhido. Só da empresa do usuário.
 */
export default async function AiRunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getRequiredTenantContext();
  const params = await searchParams;
  const onlyFailures = single(params.falhas) === "1";
  const requestedPage = Number.parseInt(single(params.pagina) ?? "1", 10);
  const [list, summary] = await Promise.all([
    listAiRuns(context.tenantId, { onlyFailures, page: Number.isFinite(requestedPage) ? requestedPage : 1 }),
    getAiRunsSummary(context.tenantId),
  ]);
  const summaryText = summarizeAiRuns(summary.total, summary.failed);

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento IA" title="Execuções" summary={summaryText} />
      <main className={page.stack}>
        <RunsWorkspace
          rows={list.rows}
          onlyFailures={onlyFailures}
          page={list.page}
          totalPages={list.totalPages}
          totalItems={list.totalItems}
          pageSize={list.pageSize}
          summaryText={summaryText}
          failed24h={summary.failed}
        />
      </main>
    </>
  );
}
