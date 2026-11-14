"use client";

import { useState, type ReactNode } from "react";

import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import { LeadHeaderBar, NextStepCard } from "@/features/broker-workspace/chat/lead-screen-parts";
import { arrivalView, nextStepFor } from "@/features/broker-workspace/chat/lead-arrival";
import { LeadSocialLayout } from "@/features/broker-workspace/chat/lead-social-layout";
import { RegisterSalePanel } from "@/app/(dashboard)/leads/[id]/register-sale-panel";
import { RegisterSaleWizard } from "@/app/(dashboard)/leads/[id]/register-sale-wizard";
import { LeadQuotesSection } from "@/features/leads/components/lead-quotes-section";

import { LeadActionBar } from "./action-bar";
import { AdOriginCard } from "./ad-origin-card";
import { DeclineSheet } from "./decline-sheet";
import { DetailsZone } from "./details-panel";
import { stageLabel } from "./format";
import { ClosingOutcomeCard } from "./closing-outcome-card";
import { ClientInfoCard, IdentityHeader } from "./identity-zone";
import { LeadNotices } from "./lead-notices";
import { PeopleDataSection } from "./people-data-section";
import { useQuickSaleAutoOpen } from "./quick-sale-auto-open";
import { SaleDocSheet } from "./sale-doc-sheet";
import { SaleSection } from "./sale-section";
import { StepSheet } from "./step-sheet";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "./types";
import { UnavailableLeadView } from "./unavailable-view";
import { useLeadDetail } from "./use-lead-detail";
import { WhatsAppHandoff, handoffLeadFrom } from "@/features/broker-workspace/whatsapp-handoff/whatsapp-handoff";

export type { LightLeadDetailData, LiteRequirement } from "./types";

/** What the conversation says about the lead, read on the server (see the lead page). */
export type LeadActivity = { lastClientAt: Date | null; lastBrokerAt: Date | null; nextAction: string | null; now: Date };

/**
 * Lead screen of the broker app.
 * page: the old single-column screen (fixed action bar, sheets).
 * panel: the whole lead in one screen beside its conversation: arrival, next step, client data, actions (2026-10-17).
 * details: the client's data alone, for the supervisor and the gestor, whose chat is read-only.
 */
export function LightLeadDetail({
  lead,
  requirements = [],
  documents = [],
  carriers = [],
  availabilityStatus = "available",
  mode = "broker",
  variant = "page",
  activity,
  conversation,
  commercialValuesEnabled = false,
  quotePlans = [],
  saleRegistrationV2Enabled = false,
  openSaleOnLoad = false,
}: {
  lead: LightLeadDetailData;
  /** Kept for the page contract; the responsible broker is no longer printed on this screen. */
  brokerName?: string;
  requirements?: LiteRequirement[];
  documents?: ConfirmationDocument[];
  carriers?: CarrierOption[];
  availabilityStatus?: "available" | "paused" | "offline";
  mode?: "broker" | "management";
  variant?: "page" | "panel" | "details";
  activity?: LeadActivity;
  /** The chat, shown beside the profile in the panel. */
  conversation?: ReactNode;
  commercialValuesEnabled?: boolean;
  quotePlans?: Array<{ id: string; name: string }>;
  saleRegistrationV2Enabled?: boolean;
  /** Registrar venda em dois toques: a página recebeu `?registrar-venda=1` com a chave ligada. */
  openSaleOnLoad?: boolean;
}) {
  const isManagement = mode === "management";
  const c = useLeadDetail({ lead, requirements, documents, initialDetailsExpanded: isManagement });
  useQuickSaleAutoOpen({ enabled: openSaleOnLoad && !isManagement && variant !== "details", lead, c, registrationV2Enabled: saleRegistrationV2Enabled });
  // Confirmação no próprio lugar: depois do registro, "Etapa atual" mostra o check que se desenha.
  const [saleRegistered, setSaleRegistered] = useState(false);
  const onSaleRegistered = () => {
    c.markConverted();
    setSaleRegistered(true);
  };

  // Lead already taken by someone else (or finished): nothing to act on. The panel keeps the history visible.
  if (variant === "page" && !isManagement && !lead.isCurrentBroker && c.isDistributed === false) {
    return <UnavailableLeadView availabilityStatus={availabilityStatus} />;
  }

  if (variant === "details") {
    return (
      <div className="arc-venancor flex w-full flex-col gap-4 text-foreground">
        <ClientInfoCard lead={lead} c={c} mode="management" />
        <SaleSection c={c} mode="management" />
        {commercialValuesEnabled && isManagement ? <LeadQuotesSection key={lead.id} leadId={lead.id} leadName={lead.nome} leadPhone={lead.telefone} beneficiaryCount={lead.livesCount} plans={quotePlans} monthlyValue={lead.monthlyValue} livesCount={lead.livesCount} commercialValueSource={lead.commercialValueSource} canDeleteQuotes={isManagement} /> : null}
        <DetailsZone lead={lead} c={c} showAiInsight={false} />
      </div>
    );
  }

  if (variant === "panel") {
    const now = activity?.now ?? new Date();
    const closed = c.leadStatus === "converted" || c.leadStatus === "lost";
    // Distribution to this broker (assignedAt), never the moment the lead entered the brokerage.
    const arrival = lead.assignedAt ? arrivalView({ arrivedAt: new Date(lead.assignedAt), now, dutyName: lead.dutyName }) : null;
    const step = nextStepFor({
      owned: lead.isCurrentBroker,
      accepted: !c.isDistributed,
      closed,
      lastClientAt: activity?.lastClientAt ?? null,
      lastBrokerAt: activity?.lastBrokerAt ?? null,
      nextAction: activity?.nextAction ?? null,
      now,
    });
    const statusTone = c.isDistributed ? "info" : c.leadStatus === "converted" ? "success" : "neutral";
    return (
      <>
        <LeadSocialLayout
          backHref="/leads?tab=minha-fila"
          detailOverlayActive={c.showSaleConfirm || c.showUpdateSheet || c.showDeclineModal}
          actions={<LeadActionBar lead={lead} c={c} inline compact />}
          header={<LeadHeaderBar name={lead.nome} statusLabel={stageLabel(c.leadStatus)} statusTone={statusTone} arrival={arrival} compact />}
          // One card: what to do now and its buttons (Aceitar, WhatsApp, Etapa) right under it.
          next={<NextStepCard step={step} />}
          details={
            <div className="flex flex-col gap-4">
              <LeadHeaderBar name={lead.nome} statusLabel={stageLabel(c.leadStatus)} statusTone={statusTone} arrival={arrival} />
              <ClosingOutcomeCard lead={lead} c={c} />
              {/* O plano anunciado antes dos dados: evita oferecer um plano mais caro do que o anúncio (10/11). */}
              <AdOriginCard ad={lead.adContext} />
              <ClientInfoCard lead={lead} c={c} withSummary />
              <PeopleDataSection lead={lead} c={c} showRecordDetails={false} />
              <SaleSection c={c} aiSalePrompt={lead.aiSalePrompt ?? null} registrationV2Enabled={saleRegistrationV2Enabled} hasActiveSale={lead.hasActiveSale} justRegistered={saleRegistered} />
            </div>
          }
          conversation={conversation}
        />
        <DeclineSheet lead={lead} c={c} />
        <StepSheet c={c} />
        {saleRegistrationV2Enabled ? <RegisterSaleWizard key={lead.id} lead={lead} documents={documents} requirements={requirements} carriers={carriers} open={c.showSaleConfirm} onOpenChange={c.setShowSaleConfirm} onRegistered={onSaleRegistered} successOverlay={false} /> : <>
          <SaleDocSheet lead={lead} c={c} requirements={requirements} />
          <RegisterSalePanel leadId={lead.id} documents={documents} carriers={carriers} open={c.showSaleConfirm} onOpenChange={c.setShowSaleConfirm} onRegistered={onSaleRegistered} />
        </>}
        {c.successOverlay}
      {!isManagement && c.handoffUrl ? <WhatsAppHandoff key={c.handoffUrl} lead={handoffLeadFrom(lead)} whatsappUrl={c.handoffUrl} onClose={c.closeHandoff} /> : null}
      </>
    );
  }

  if (isManagement) {
    return (
      <div className="arc-venancor flex w-full flex-col text-foreground">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-2 sm:px-6">
          <LeadNotices lead={lead} />
          <IdentityHeader lead={lead} c={c} mode="management" />
          <ClientInfoCard lead={lead} c={c} mode="management" />
          <SaleSection c={c} mode="management" />
          {commercialValuesEnabled ? <LeadQuotesSection key={lead.id} leadId={lead.id} leadName={lead.nome} leadPhone={lead.telefone} beneficiaryCount={lead.livesCount} plans={quotePlans} monthlyValue={lead.monthlyValue} livesCount={lead.livesCount} commercialValueSource={lead.commercialValueSource} canDeleteQuotes={isManagement} /> : null}
          <DetailsZone lead={lead} c={c} showAiInsight={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-[calc(112px+var(--mobile-safe-bottom))] pt-2 sm:px-6">
        <LeadNotices lead={lead} />
        <IdentityHeader lead={lead} c={c} />
        <ClosingOutcomeCard lead={lead} c={c} />
        <AdOriginCard ad={lead.adContext} />
        <ClientInfoCard lead={lead} c={c} />
        <SaleSection c={c} aiSalePrompt={lead.aiSalePrompt ?? null} registrationV2Enabled={saleRegistrationV2Enabled} hasActiveSale={lead.hasActiveSale} justRegistered={saleRegistered} />
        <DetailsZone lead={lead} c={c} />
        <PeopleDataSection lead={lead} c={c} />
      </div>

      <LeadActionBar lead={lead} c={c} />
      <DeclineSheet lead={lead} c={c} />
      <StepSheet c={c} />
      {saleRegistrationV2Enabled ? <RegisterSaleWizard key={lead.id} lead={lead} documents={documents} requirements={requirements} carriers={carriers} open={c.showSaleConfirm} onOpenChange={c.setShowSaleConfirm} onRegistered={onSaleRegistered} successOverlay={false} /> : <>
        <SaleDocSheet lead={lead} c={c} requirements={requirements} />
        <RegisterSalePanel leadId={lead.id} documents={documents} carriers={carriers} open={c.showSaleConfirm} onOpenChange={c.setShowSaleConfirm} onRegistered={onSaleRegistered} />
      </>}
      {c.successOverlay}
      {!isManagement && c.handoffUrl ? <WhatsAppHandoff key={c.handoffUrl} lead={handoffLeadFrom(lead)} whatsappUrl={c.handoffUrl} onClose={c.closeHandoff} /> : null}
    </div>
  );
}
