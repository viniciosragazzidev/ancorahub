"use client";

/**
 * Laboratório: hover card do lead (20/11/2026). Usa a tabela real da carteira (`LeadsDataTable`) com leads de exemplo.
 * Passe o mouse no nome (ou foque com Tab) para ver a prévia; clicar no nome ou na linha "abre o drawer" (aqui, só avisa).
 * No toque, a prévia não existe e o nome segue abrindo o drawer.
 */
import { useState } from "react";

import { LeadsDataTable } from "@/app/(dashboard)/leads/leads-data-table";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function lead(partial: Partial<LeadWorkspaceItem> & Pick<LeadWorkspaceItem, "id" | "nome" | "telefone" | "status">): LeadWorkspaceItem {
  return {
    qualificationStatus: "qualified",
    origem: "meta",
    sourceCampaign: null,
    tipo: "pme",
    createdAt: hoursAgo(30),
    assignedAt: hoursAgo(28),
    stageEnteredAt: null,
    serviceStartedAt: null,
    firstContactAt: null,
    corretorId: "u1",
    corretorNome: "Vinicios Ragazzi",
    branchId: "b1",
    branchName: "Unidade Centro",
    ...partial,
  };
}

export const LAB_HOVER_LEADS: LeadWorkspaceItem[] = [
  lead({ id: "lab-hover-1", nome: "Carla Mendes", telefone: "5521998836148", status: "negotiation", monthlyValue: 1890.5, livesCount: 6, stageEnteredAt: hoursAgo(2), queueName: "PME Rio" }),
  lead({ id: "lab-hover-2", nome: "Pedro Lima", telefone: "21987654321", status: "quote_sent", monthlyValue: "642.00", livesCount: 2, firstContactAt: hoursAgo(26) }),
  lead({ id: "lab-hover-3", nome: "Ana Souza", telefone: "11912345678", status: "new", corretorId: null, corretorNome: null, assignedAt: null, createdAt: hoursAgo(0.2) }),
  lead({ id: "lab-hover-4", nome: "Roberto Faria", telefone: "", status: "lost", monthlyValue: null, stageEnteredAt: hoursAgo(24 * 9) }),
];

export function LeadHoverLab() {
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-ds-16 p-ds-24 font-ds-inter">
      <header className="flex flex-col gap-ds-4">
        <h1 className="text-ds-subheading font-semibold text-ds-charcoal">Hover card do lead</h1>
        <p className="text-ds-body text-ds-steel">
          Passe o mouse no nome ou foque com Tab. Esc fecha. No toque, o nome abre o drawer como antes.
        </p>
      </header>
      <LeadsDataTable leads={LAB_HOVER_LEADS} contextRole="broker" onRowClick={(item) => setOpened(item.nome)} />
      <p role="status" className="text-ds-caption text-ds-fog">
        {opened ? `Drawer aberto: ${opened}` : "Nenhum drawer aberto."}
      </p>
    </main>
  );
}
