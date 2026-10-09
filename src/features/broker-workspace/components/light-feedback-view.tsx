"use client";

import { useState } from "react";
import Link from "next/link";

import { ActionButton } from "@/components/arc/action-button/action-button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { toast } from "@/components/ui/sonner";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

type FeedbackViewProps = {
  leadId: string;
  leadName: string;
  phone: string | null;
  currentStatus: string;
};

const FEEDBACK_OPTIONS = [
  { label: "Tentando contato", status: "in_contact" },
  { label: "Cliente respondeu", status: "in_contact" },
  { label: "Cotação enviada", status: "quote_sent" },
  { label: "Em negociação", status: "negotiation" },
  { label: "Venda realizada", status: "converted" },
  { label: "Sem interesse", status: "lost", lossReason: "sem_interesse" },
];

const OPTION_STYLE: React.CSSProperties = {
  minHeight: "3rem",
  justifyContent: "space-between",
  width: "100%",
};

const resultAction =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold";

/**
 * Quick status update opened from a WhatsApp link. It also renders outside the app chrome
 * (/l/[id]/feedback), so it keeps its own canvas and the lead name as the screen title.
 */
export function LightFeedbackView({ leadId, leadName, phone }: FeedbackViewProps) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  // The server sends the phone only after the broker accepted the lead.
  const waUrl = buildWhatsAppUrl(phone);

  async function handleSelectOption(opt: (typeof FEEDBACK_OPTIONS)[number]) {
    if (submitted) return;
    setSelectedLabel(opt.label);

    const formData = new FormData();
    formData.append("leadId", leadId);
    formData.append("newStatus", opt.status);
    formData.append("status", opt.status);
    if (opt.lossReason) {
      formData.append("motivoPerda", opt.lossReason);
      formData.append("lossReason", opt.lossReason);
    }

    let res;
    try {
      res = await changeLeadStatusAction({}, formData);
    } catch {
      toast.error("Não foi possível registrar no momento.");
      throw new Error("feedback-action-failed");
    }

    if (!res.success) {
      toast.error(res.error ?? "Não foi possível registrar a atualização.");
      throw new Error("feedback-action-failed");
    }

    setSubmitted(true);
  }

  return (
    <div className="arc-venancor light-canvas flex min-h-full flex-col" style={{ color: "var(--foreground)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-6 pt-4">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-(--foreground)">{leadName}</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">Como foi o contato?</p>
        </header>

        {submitted ? (
          <div className="rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
            <EmptyState
              label="Atualização registrada"
              title="Atualização registrada"
              description={`O atendimento foi atualizado para ${selectedLabel}.`}
              action={
                <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${resultAction} bg-(--accent) text-(--accent-foreground)`}
                    >
                      Voltar para o WhatsApp
                    </a>
                  ) : null}
                  <Link href="/minha-fila" className={`${resultAction} bg-(--surface-muted) text-(--foreground)`}>
                    Ver minha fila
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
          <section aria-labelledby="feedback-heading" className="flex flex-col gap-3 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
            <h2 id="feedback-heading" className="text-base font-semibold text-(--foreground)">Como ficou esse atendimento?</h2>
            <div className="grid gap-2">
              {FEEDBACK_OPTIONS.map((opt) => (
                <ActionButton
                  key={opt.label}
                  label={opt.label}
                  pendingLabel="Registrando..."
                  successLabel="Registrado"
                  onAction={() => handleSelectOption(opt)}
                  onActionError={() => {
                    /* the error was already toasted in handleSelectOption */
                  }}
                  className="w-full"
                  style={OPTION_STYLE}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
