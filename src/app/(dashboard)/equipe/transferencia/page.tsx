import { redirect } from "next/navigation";

import { getBrokerTransferCandidatesAction } from "@/features/supervisor-workspace/transfer-actions";
import { TransferRequestForm } from "@/features/supervisor-workspace/transfer-request-form";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function SupervisorTransferPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || (await getLiteAudience(context)) !== "supervisor") redirect("/access-denied");
  const candidates = await getBrokerTransferCandidatesAction();

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6" aria-labelledby="transfer-page-title">
      <header>
        <p className="text-sm text-[var(--text-muted)]">Minha equipe</p>
        <h1 id="transfer-page-title" className="mt-1 text-2xl font-semibold">Pedir corretor de outra equipe</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">A transferência só acontece depois da aprovação da gestão da unidade.</p>
      </header>
      <TransferRequestForm candidates={candidates} />
    </section>
  );
}
