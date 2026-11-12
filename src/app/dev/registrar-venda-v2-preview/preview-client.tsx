"use client";

import { useState } from "react";
import { RegisterSaleWizard } from "@/app/(dashboard)/leads/[id]/register-sale-wizard";
import { Button } from "@/components/ui/button";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";

export function RegisterSaleV2PreviewClient({
  lead,
  documents,
  requirements,
  carriers,
  previewMessage,
}: {
  lead: LightLeadDetailData;
  documents: ConfirmationDocument[];
  requirements: LiteRequirement[];
  carriers: CarrierOption[];
  previewMessage: string | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {!open ? (
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Prévia de dados sintéticos, sem gravar no banco.</p>
          <Button className="mt-3 min-h-11" onClick={() => setOpen(true)}>Abrir o registro de venda</Button>
        </div>
      ) : null}
      <RegisterSaleWizard
        lead={lead}
        documents={documents}
        requirements={requirements}
        carriers={carriers}
        open={open}
        onOpenChange={setOpen}
        previewMode
        previewMessage={previewMessage}
      />
    </>
  );
}
