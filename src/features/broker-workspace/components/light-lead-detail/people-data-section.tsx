"use client";

import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";
import { type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function PeopleDataSection({ lead, c, showRecordDetails = true }: { lead: LightLeadDetailData; c: LeadDetailController; showRecordDetails?: boolean }) {
  const { isDistributed } = c;
  return (
    <>
        {/* ── Pessoas da Contratação + Dados Organizados ──────────────────── */}
        {!isDistributed && (
          <div className="space-y-4" data-form-density="compact">
            {/* Titular e dependentes só para leitura: adicionar e confirmar ficam no registro da venda (26/11/2026). */}
            <PeopleReadOnly lead={lead} />
            {showRecordDetails ? <PersonRecordDetails
              kind="lead"
              hideRegistrationDate
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
            /> : null}
          </div>
        )}
    </>
  );
}

const RELATIONSHIP_LABELS: Record<string, string> = { conjuge: "Cônjuge", filho: "Filho(a)", outro: "Outro" };

function birthDateLabel(value: string | null) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

/** Pessoas da contratação só para leitura: a gestão vê o mesmo que o corretor, sem editar o lead dele (16/11/2026). */
export function PeopleReadOnly({ lead }: { lead: LightLeadDetailData }) {
  const people = lead.beneficiaries ?? [];
  if (!people.length) return null;
  return (
    <section aria-labelledby="people-readonly-heading" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <h2 id="people-readonly-heading" className="text-base font-semibold text-(--foreground)">Pessoas da contratação</h2>
      <ul className="mt-3 grid gap-3" aria-label="Pessoas da contratação">
        {people.map((person) => (
          <li key={person.id} className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-(--foreground)">{person.name}</span>
            <span className="text-xs text-(--text-secondary)">
              {[person.isHolder ? "Titular" : RELATIONSHIP_LABELS[person.relationship] ?? person.relationship, birthDateLabel(person.birthDate), person.age != null ? `${person.age} anos` : null, person.hasCpf ? "CPF cadastrado" : null].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
