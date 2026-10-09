"use client";

import { ClipboardList, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/arc/button/button";

import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

const linkBase = "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold";
const linkPrimary = `${linkBase} bg-(--accent) text-(--accent-foreground)`;
const linkSecondary = `${linkBase} bg-(--surface-muted) text-(--foreground)`;

/**
 * Fixed action pill at the bottom of the lead screen, where the thumb is.
 * New lead: Recusar and Aceitar lead. After accepting: WhatsApp (the one primary
 * action), Ligar and Etapa. The phone only exists after acceptance.
 */
export function LeadActionBar({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const {
    isDistributed,
    leadStatus,
    accepting,
    handleAccept,
    setShowDeclineModal,
    externalWhatsAppUrl,
    handleOpenUpdateModal,
    setWhatsappOpenedAt,
  } = c;

  if (!isDistributed && (leadStatus === "converted" || leadStatus === "lost")) return null;

  return (
    <nav
      aria-label="Ações do lead"
      className="arc-venancor fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40 md:left-[calc(72px+1rem)]"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-(--surface)/86 p-2 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150">
        {isDistributed ? (
          <>
            <Button variant="secondary" disabled={accepting} onClick={() => setShowDeclineModal(true)}>
              Recusar
            </Button>
            <Button className="flex-1" loading={accepting} disabled={accepting} onClick={handleAccept}>
              Aceitar lead
            </Button>
          </>
        ) : (
          <>
            {externalWhatsAppUrl ? (
              <a
                href={externalWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className={linkPrimary}
                onClick={() =>
                  setWhatsappOpenedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
                }
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            ) : (
              <Button className="flex-1" disabled>
                WhatsApp indisponível
              </Button>
            )}
            {lead.telefone ? (
              <a href={`tel:${lead.telefone}`} className={linkSecondary}>
                <Phone className="size-4" aria-hidden="true" />
                Ligar
              </a>
            ) : null}
            <Button variant="secondary" className="flex-1" onClick={handleOpenUpdateModal}>
              <ClipboardList className="size-4" aria-hidden="true" />
              Etapa
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
