"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/sonner";
import { CheckCircle, WhatsappLogo } from "@/components/huge-icons";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import "@/components/arc/venancor-scope.css";

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

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "1.5rem",
  boxShadow: "var(--shadow-resting)",
};

const OPTION_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  minHeight: "3rem",
  justifyContent: "space-between",
  width: "100%",
  fontWeight: 600,
};

export function LightFeedbackView({ leadId, leadName, phone, currentStatus }: FeedbackViewProps) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  const waUrl = buildWhatsAppUrl(phone);

  async function handleSelectOption(opt: typeof FEEDBACK_OPTIONS[number]) {
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
    toast.success("Atualização registrada.");
  }

  return (
    <div
      className="arc-venancor min-h-full flex flex-col"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <div className="mx-auto w-full max-w-md space-y-5 px-4 pt-8 pb-[max(120px,var(--mobile-safe-bottom,0px))]">
        {/* Screen title */}
        <header className="text-center">
          <h1
            className="text-[30px] leading-tight font-bold"
            style={{ letterSpacing: "-0.03em" }}
          >
            {leadName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Como foi o contato?
          </p>
        </header>

        {submitted ? (
          /* Final state after the feedback is registered */
          <div style={CARD_STYLE}>
            <EmptyState
              label="Confirmação de atualização registrada"
              icon={
                <CheckCircle
                  width={24}
                  height={24}
                  strokeWidth={1.5}
                  style={{ color: "var(--success)" }}
                />
              }
              title="Atualização registrada"
              description={`Obrigado. O atendimento foi atualizado para ${selectedLabel}.`}
              action={
                <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--foreground)" }}
                    >
                      <WhatsappLogo className="size-4" />
                      VOLTAR PARA O WHATSAPP
                    </a>
                  ) : null}
                  <Link
                    href="/minha-fila"
                    className="inline-flex h-11 items-center justify-center rounded-full px-5 text-xs font-semibold transition-colors"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                  >
                    VER MEUS LEADS
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
          /* Feedback option buttons */
          <div className="space-y-3 p-5" style={CARD_STYLE}>
            <p className="text-sm font-semibold">Como ficou esse atendimento?</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
