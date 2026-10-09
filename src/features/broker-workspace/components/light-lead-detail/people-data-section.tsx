"use client";

import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";
import { type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function PeopleDataSection({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { isDistributed } = c;
  return (
    <>
        {/* ── Pessoas da Contratação + Dados Organizados ──────────────────── */}
        {!isDistributed && (
          <div className="space-y-5">
            <BeneficiariesSection
              leadId={lead.id}
              contactName={lead.nome}
              initialBeneficiaries={lead.beneficiaries || []}
            />
            <PersonRecordDetails
              kind="lead"
              createdAt={new Date(lead.createdAt)}
              consentimentoLgpd={lead.consentimentoLgpd ?? false}
              dependents={(lead.beneficiaries || []).map((b) => ({
                id: b.id,
                name: b.name,
                birthDate: b.birthDate,
                relationship: b.relationship,
                isHolder: b.isHolder,
              }))}
              documentCount={0}
              formData={
                lead.formData
                  ? {
                      dependentes: lead.formData.dependentes,
                      mediaIdades: lead.formData.mediaIdades,
                      razaoSocial: lead.formData.razaoSocial,
                      cnpj: lead.formData.cnpj,
                      funcionarios: lead.formData.funcionarios,
                    }
                  : undefined
              }
            />
          </div>
        )}
    </>
  );
}
