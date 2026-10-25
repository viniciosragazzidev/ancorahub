import { DashboardHeader } from "@/components/dashboard-header";
import { PaymentProofValidator } from "@/features/payment-proof-validator/components/payment-proof-validator";
import { PaymentProofValidatorLite } from "@/features/payment-proof-validator/components/payment-proof-validator-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function ValidadorComprovantePage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_ferramentas");

  if (await isDirectorLitePageOnServer(context, "/ferramentas/validador-comprovante")) {
    return (
      <>
        <DashboardHeader breadcrumb="Ferramentas" title="Validador de comprovante" />
        <main className={litePage.stack}>
          <PaymentProofValidatorLite />
        </main>
      </>
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
