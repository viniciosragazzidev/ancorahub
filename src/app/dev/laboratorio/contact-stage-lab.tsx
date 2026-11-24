"use client";

/**
 * Etapa "Entrei em contato" (24/11/2026) no laboratório: a ficha real do corretor, com o lead em atendimento.
 * Toque em "Etapa", escolha "Contato feito" e conte como foi. O servidor é simulado com as mesmas regras do real
 * (relato obrigatório, texto da linha do tempo), e a linha do tempo simulada aparece embaixo da ficha.
 */
import type { StatusChangeState } from "@/app/(dashboard)/leads/status-actions";
import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";
import { cleanObservation, MISSING_CONTACT_OBSERVATION, missingContactObservation, stageChangeTimelineText } from "@/features/leads/contact-observation";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

export type LabTimelineEntry = { id: string; at: Date; text: string };

const LAB_CONTACT_LEAD = {
  id: "lab-contato",
  nome: "Marina Alves Couto",
  telefone: "(21) 98765-1020",
  email: "marina.couto@exemplo.com",
  status: "in_contact",
  createdAt: new Date(Date.now() - 3 * 3_600_000),
  assignedAt: new Date(Date.now() - 2 * 3_600_000),
  isCurrentBroker: true,
  tipo: "Familiar",
  livesCount: 3,
  city: "Niterói",
  summary: "Família de 3 vidas, hoje sem plano. Quer rede boa em Niterói.",
  clientInfo: [
    { key: "vidas", label: "Vidas", value: "3" },
    { key: "idades", label: "Idades", value: "38, 36 e 9" },
  ],
};

/** Servidor simulado do registro de etapa: mesmas regras de changeLeadStatus para o relato do contato. */
export function createLabLeadStatus(input: {
  delay: number;
  fail: boolean;
  current: { status: string };
  onRecord: (entry: LabTimelineEntry) => void;
}) {
  return async (formData: FormData): Promise<StatusChangeState> => {
    await new Promise((resolve) => setTimeout(resolve, input.delay));
    const newStatus = String(formData.get("newStatus") ?? "");
    const observation = cleanObservation(formData.get("observacao") as string | null);
    if (missingContactObservation({ newStatus, observation, bySystem: false })) return { error: MISSING_CONTACT_OBSERVATION };
    if (input.fail) return { error: "Não foi possível alterar o status do lead." };
    const previousStatus = input.current.status;
    const text = newStatus === "lost"
      ? `Status alterado: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → Perdido.`
      : stageChangeTimelineText({ previousStatus, newStatus, observation });
    input.current.status = newStatus;
    input.onRecord({ id: `${Date.now()}`, at: new Date(), text });
    return { success: true, newStatus, changedLeadIds: [LAB_CONTACT_LEAD.id] };
  };
}

export function ContactStageLab({ run, timeline }: { run: number; timeline: LabTimelineEntry[] }) {
  return (
    <div className="arc-venancor min-h-[100dvh] bg-(--background) text-(--foreground)">
      <LightLeadDetail key={run} lead={LAB_CONTACT_LEAD} requirements={[]} documents={[]} carriers={[]} />
      <section aria-label="Linha do tempo simulada" className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 pb-24">
        <h2 className="text-sm font-medium text-(--foreground)">Linha do tempo (simulada)</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-(--text-secondary)">Nenhuma etapa registrada ainda. Toque em Etapa e escolha Contato feito.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {timeline.map((entry) => (
              <li key={entry.id} className="rounded-2xl bg-(--surface) px-4 py-3 text-sm shadow-(--shadow-resting)">
                <span className="block text-xs text-(--text-secondary)">{entry.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {entry.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
