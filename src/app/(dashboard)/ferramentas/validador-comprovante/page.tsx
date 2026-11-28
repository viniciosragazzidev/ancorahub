import { DashboardHeader } from "@/components/dashboard-header";
import { PaymentProofValidator } from "@/features/payment-proof-validator/components/payment-proof-validator";
import { PaymentProofValidatorLite } from "@/features/payment-proof-validator/components/payment-proof-validator-lite";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function ValidadorComprovantePage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_ferramentas");

  if (await isDirectorLitePageOnServer(context, "/ferramentas/validador-comprovante")) {
    // Lite (28/11/2026, artifact "Comercial"): a mesma moldura da área, com as abas de Comercial.
    return (
      <ComercialPage title="Validador de comprovante" summary="Confere o comprovante contra a proposta e o boleto.">
        <PaymentProofValidatorLite />
      </ComercialPage>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Validador de Comprovante" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <PaymentProofValidator />
      </main>
    </>
  );
}
