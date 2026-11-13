"use client";

import { ClipboardList, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import page from "@/components/lite/page/lite-page.module.css";

import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

const linkBase = "inline-flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2";
const linkPrimary = `${linkBase} bg-(--primary) text-(--primary-foreground)`;
const linkSecondary = `${linkBase} bg-(--surface-muted) text-(--foreground)`;

/**
 * Fixed action pill at the bottom of the lead screen, where the thumb is.
 * New lead: Recusar and Aceitar e chamar no WhatsApp (one tap). After accepting: WhatsApp (the one primary
 * action), Ligar and Etapa. The phone only exists after acceptance.
 */
export function LeadActionBar({ lead, c, inline = false, compact = false }: { lead: LightLeadDetailData; c: LeadDetailController; inline?: boolean; compact?: boolean }) {
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
      data-tour="micro-lead-actions"
      aria-label="Ações do lead"
      className={inline ? "arc-venancor" : "arc-venancor fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40 md:left-[calc(72px+1rem)]"}
    >
      <div className={inline ? "flex w-full flex-wrap items-center gap-2" : "mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-(--surface)/86 p-2 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150"}>
        {isDistributed ? (
          <>
            <Button variant="secondary" disabled={accepting} onClick={() => setShowDeclineModal(true)}>
              Recusar
            </Button>
            <Button className="flex-1" loading={accepting} disabled={accepting} onClick={handleAccept}>
              Aceitar e chamar no WhatsApp
            </Button>
          </>
        ) : (
          <>
            {externalWhatsAppUrl ? (
              <a
                href={externalWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className={compact ? page.iconButton : linkPrimary}
                data-tone={compact ? "primary" : undefined}
                aria-label={compact ? "Abrir WhatsApp do cliente" : undefined}
                title={compact ? "WhatsApp" : undefined}
                onClick={() =>
                  setWhatsappOpenedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
                }
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                {compact ? null : "WhatsApp"}
              </a>
            ) : (
              <Button variant={compact ? "ghost" : "primary"} className={compact ? page.iconButton : "flex-1"} disabled aria-label={compact ? "WhatsApp indisponível: telefone não cadastrado" : undefined} title={compact ? "Telefone não cadastrado" : undefined}>
                {compact ? <MessageCircle className="size-4" aria-hidden="true" /> : "Sem WhatsApp no cadastro"}
              </Button>
            )}
            {lead.telefone ? (
              <a href={`tel:${lead.telefone}`} className={compact ? page.iconButton : linkSecondary} aria-label={compact ? "Ligar para o cliente" : undefined} title={compact ? "Ligar" : undefined}>
                <Phone className="size-4" aria-hidden="true" />
                {compact ? null : "Ligar"}
              </a>
            ) : null}
            <Button size={compact ? "sm" : "md"} variant={compact ? "ghost" : "secondary"} className={compact ? page.iconButton : "flex-1"} aria-label={compact ? "Alterar etapa do lead" : undefined} title={compact ? "Etapa" : undefined} onClick={handleOpenUpdateModal}>
              <ClipboardList className="size-4" aria-hidden="true" />
              {compact ? null : "Etapa"}
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
