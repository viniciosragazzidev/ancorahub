"use client";

import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import { RegisterSalePanel } from "@/app/(dashboard)/leads/[id]/register-sale-panel";

import { LeadActionBar } from "./action-bar";
import { DeclineSheet } from "./decline-sheet";
import { DetailsZone } from "./details-panel";
import { ClientInfoCard, IdentityHeader } from "./identity-zone";
import { LeadNotices } from "./lead-notices";
import { PeopleDataSection } from "./people-data-section";
import { SaleDocSheet } from "./sale-doc-sheet";
import { SaleSection } from "./sale-section";
import { StepSheet } from "./step-sheet";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "./types";
import { UnavailableLeadView } from "./unavailable-view";
import { useLeadDetail } from "./use-lead-detail";

export type { LightLeadDetailData, LiteRequirement } from "./types";

/**
 * Lead screen of the broker app. The back button and the title come from the app
 * header; the actions live in a fixed bar at the bottom; decline, stage and sale
 * documents open as bottom sheets. There are no empty tabs: sections follow each other.
 */
export function LightLeadDetail({
  lead,
  requirements = [],
  documents = [],
  carriers = [],
  availabilityStatus = "available",
}: {
  lead: LightLeadDetailData;
  /** Kept for the page contract; the responsible broker is no longer printed on this screen. */
  brokerName?: string;
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
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-[calc(112px+var(--mobile-safe-bottom))] pt-2 sm:px-6">
        <LeadNotices lead={lead} />
        <IdentityHeader lead={lead} c={c} />
        <ClientInfoCard lead={lead} c={c} />
        <SaleSection c={c} />
        <DetailsZone lead={lead} c={c} />
        <PeopleDataSection lead={lead} c={c} />
      </div>

      <LeadActionBar lead={lead} c={c} />
      <DeclineSheet lead={lead} c={c} />
      <StepSheet c={c} />
      <SaleDocSheet lead={lead} c={c} requirements={requirements} />
      <RegisterSalePanel
        leadId={lead.id}
        documents={documents}
        carriers={carriers}
        open={c.showSaleConfirm}
        onOpenChange={c.setShowSaleConfirm}
      />
      {c.successOverlay}
    </div>
  );
}
