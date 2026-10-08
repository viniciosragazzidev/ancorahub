"use client";

import { Card } from "@/components/ui/card";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import { RegisterSalePanel } from "@/app/(dashboard)/leads/[id]/register-sale-panel";

import { DeclineDialog } from "./decline-dialog";
import { DetailsZone } from "./details-panel";
import { IdentityZone } from "./identity-zone";
import { LeadTopSection } from "./lead-top-section";
import { PeopleDataSection } from "./people-data-section";
import { PrimaryActionsZone } from "./primary-actions";
import { SaleDocDialog } from "./sale-doc-dialog";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "./types";
import { UnavailableLeadView } from "./unavailable-view";
import { UpdateStepDialog } from "./update-step-dialog";
import { useLeadDetail } from "./use-lead-detail";

export type { LightLeadDetailData, LiteRequirement } from "./types";

export function LightLeadDetail({
  lead,
  brokerName,
  requirements = [],
  documents = [],
  carriers = [],
  availabilityStatus = "available",
}: {
  lead: LightLeadDetailData;
  brokerName: string;
  requirements?: LiteRequirement[];
  documents?: ConfirmationDocument[];
  carriers?: CarrierOption[];
  availabilityStatus?: "available" | "paused" | "offline";
}) {
  const c = useLeadDetail({ lead, requirements, documents });

  // Lead already taken by someone else (or finished): nothing to act on.
  if (!lead.isCurrentBroker && c.isDistributed === false) {
    return <UnavailableLeadView availabilityStatus={availabilityStatus} />;
  }

  return (
    <div className="min-h-full bg-background text-foreground flex flex-col">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 pb-[max(1.5rem,var(--mobile-safe-bottom))] sm:px-6 sm:py-6 flex-1">
        <LeadTopSection lead={lead} c={c} brokerName={brokerName} />

        <Card variant="subtle" className="p-5 bg-card/95 shadow-xs space-y-4">
          <IdentityZone lead={lead} c={c} />
          <PrimaryActionsZone lead={lead} c={c} />
          <DetailsZone lead={lead} c={c} />
        </Card>

        <PeopleDataSection lead={lead} c={c} />
        <DeclineDialog lead={lead} c={c} />
        <UpdateStepDialog lead={lead} c={c} />
        <SaleDocDialog lead={lead} c={c} requirements={requirements} />

        <RegisterSalePanel
          leadId={lead.id}
          documents={documents}
          carriers={carriers}
          open={c.showSaleConfirm}
          onOpenChange={c.setShowSaleConfirm}
        />
      </div>
      {c.successOverlay}
    </div>
  );
}
