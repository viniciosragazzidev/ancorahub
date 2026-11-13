import { ZodError } from "zod";
import { ErpError } from "@/features/erp/contracts";
import { getPayout, getPayoutCandidates, getPayouts } from "@/features/erp/payouts";
import { PayoutsList } from "@/features/erp/components/payout-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";

type Search = { status?: string; competence?: string; page?: string; repasse?: string; preparar?: string };

/** The drawer's payout: a missing or out-of-scope id shows a note in the drawer instead of breaking the list. */
async function openPayout(id: string | undefined) {
  if (!id) return { detail: null, missing: false };
  try {
    return { detail: await getPayout(id), missing: false };
  } catch (error) {
    if (error instanceof ErpError || error instanceof ZodError) return { detail: null, missing: true };
    throw error;
  }
}

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const competence = raw.competence || undefined;
  const data = await getPayouts({ status: raw.status, competence, page: raw.page });
  // Candidates compute a balance per entry: load them only while the preparation drawer is open.
  const [candidates, opened] = await Promise.all([
    data.canPrepare && raw.preparar ? getPayoutCandidates({ competence }) : Promise.resolve(null),
    openPayout(raw.repasse),
  ]);
  return <ErpPage pathname="/financeiro/repasses" breadcrumb="Financeiro" title={data.agency ? "Repasses" : "Meus repasses"}>
    <PayoutsList data={data} candidates={candidates} detail={opened.detail} detailMissing={opened.missing} />
  </ErpPage>;
}
