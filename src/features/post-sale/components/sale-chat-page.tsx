"use client";

import { useMemo } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatScript } from "@/components/chat/types";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";

import { registerConversationSaleAction } from "../actions";
import type { SaleCatalog, SaleContractFile } from "../conversation-sale-core";
import { readSaleContractAction } from "../sale-contract-actions";
import { SaleChat, type SaleChatLead, type SaleChatServices } from "./sale-chat";

const services: SaleChatServices = {
  // A IA lê e o arquivo é guardado ao mesmo tempo; se guardar falhar, a leitura continua valendo (venda sem anexo).
  readContract: async ({ leadId, file }) => {
    const form = new FormData();
    form.set("leadId", leadId);
    form.set("file", file);
    const upload = new FormData();
    upload.set("leadId", leadId);
    upload.set("file", file);
    const [read, stored] = await Promise.all([
      readSaleContractAction(form),
      fetch("/api/documents/upload", { method: "POST", body: upload })
        .then(async (response): Promise<SaleContractFile | null> => {
          const payload = await response.json().catch(() => null) as (Partial<SaleContractFile> & { error?: string }) | null;
          if (!response.ok || !payload?.fileUrl || !payload.filename) return null;
          return { filename: payload.filename, fileUrl: payload.fileUrl, storageKey: payload.storageKey, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes, checksumSha256: payload.checksumSha256 };
        })
        .catch(() => null),
    ]);
    return read.ok ? { ...read, file: stored } : read;
  },
  register: (input) => registerConversationSaleAction(input),
};

/** A rota /leads/[id]/registrar-venda com as ações reais do servidor. */
export function SaleChatPage({ lead, catalog }: { lead: SaleChatLead; catalog: SaleCatalog }) {
  const back = `/leads/${encodeURIComponent(lead.id)}`;
  return <SaleChat lead={lead} catalog={catalog} services={services} backHref={back} doneHref={back} />;
}

/** Quando a venda não pode ser registrada por aqui: o motivo e um toque de volta, sem formulário. */
export function SaleChatBlocked({ leadId, title, text }: { leadId: string | null; title: string; text: string }) {
  const definition = ASSISTANTS.ancora;
  const script = useMemo<ChatScript>(() => ({
    status: { label: "Esperando você", tone: "idle" },
    blocks: [
      { type: "assistant", id: "a-blocked", text: `${title} ${text}` },
      {
        type: "question",
        id: "q-blocked",
        prompt: "O que você quer fazer?",
        choices: [
          ...(leadId ? [{ id: "lead", label: "Abrir o lead", action: { kind: "href" as const, href: `/leads/${encodeURIComponent(leadId)}` } }] : []),
          { id: "home", label: "Voltar ao Início", action: { kind: "href" as const, href: "/dashboard" } },
        ],
      },
    ],
  }), [leadId, text, title]);
  return (
    <div className="arc-venancor">
      <ChatScreen identity={{ name: definition.name, shape: definition.shape, hue: definition.hue }} backHref={leadId ? `/leads/${encodeURIComponent(leadId)}` : "/dashboard"} script={script} composerDisabled placeholder="Escolha uma opção acima" />
    </div>
  );
}
