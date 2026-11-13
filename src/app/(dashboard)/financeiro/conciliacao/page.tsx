import { ISSUE_GROUP_KEYS, ISSUE_GROUPS, getReconciliation, type ReconciliationGroup } from "@/features/erp/reconciliation";
import { ReconciliationList } from "@/features/erp/components/reconciliation-list";
import { PAGE_SIZE, pageSchema } from "@/features/erp/shared";
import { ErpPage } from "@/features/erp/ui/erp-page";

function parseGroup(value: string | undefined): ReconciliationGroup | "all" {
  const keys: readonly string[] = ISSUE_GROUP_KEYS;
  return value && keys.includes(value) ? (value as ReconciliationGroup) : "all";
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ grupo?: string; page?: string }> }) {
  const raw = await searchParams;
  const data = await getReconciliation();
  const group = parseGroup(raw.grupo);
  const parsedPage = pageSchema.safeParse(raw.page);
  const page = parsedPage.success ? parsedPage.data : 1;
  const filtered = group === "all" ? data.issues : data.issues.filter((issue) => issue.group === group);
  const groups = ISSUE_GROUP_KEYS.map((key) => ({ key, label: ISSUE_GROUPS[key], count: data.issues.filter((issue) => issue.group === key).length }));
  return <ErpPage pathname="/financeiro/conciliacao" breadcrumb="Financeiro" title="Conciliação">
    <ReconciliationList issues={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} groups={groups} group={group} page={page}
      total={filtered.length} pageSize={PAGE_SIZE} truncated={data.truncated} calculatedAt={data.calculatedAt} />
  </ErpPage>;
}
