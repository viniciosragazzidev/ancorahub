"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  { label: "Sem interesse", status: "lost", lossReason: "Sem interesse" },
];

export function LightFeedbackView({ leadId, leadName, phone, currentStatus }: FeedbackViewProps) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [pending, startTransition] = useTransition();

  const waUrl = buildWhatsAppUrl(phone);

  function handleSelectOption(opt: typeof FEEDBACK_OPTIONS[number]) {
    if (pending || submitted) return;

    setSelectedLabel(opt.label);
    const formData = new FormData();
    formData.append("leadId", leadId);
    formData.append("newStatus", opt.status);
    formData.append("status", opt.status);
    if (opt.lossReason) {
      formData.append("motivoPerda", opt.lossReason);
      formData.append("lossReason", opt.lossReason);
    }

    startTransition(async () => {
      try {
        const res = await changeLeadStatusAction({}, formData);
        if (!res.success) {
          toast.error(res.error ?? "Não foi possível registrar a atualização.");
          return;
        }
        setSubmitted(true);
        toast.success("Atualização registrada.");
      } catch {
        toast.error("Não foi possível registrar no momento.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-8 text-center">
      <Card variant="subtle" className="p-6 bg-card/95 shadow-md space-y-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Atualização Rápida</span>
          <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">{leadName}</h1>
        </div>

        {submitted ? (
          /* Confirmation Screen after feedback */
          <div className="space-y-4 py-3 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">✓ Atualização registrada</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Obrigado. O atendimento foi atualizado para <strong>{selectedLabel}</strong>.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center rounded-lg shadow-sm"
                >
                  <WhatsappLogo className="size-4" />
                  VOLTAR PARA O WHATSAPP
                </a>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                render={<Link href="/minha-fila" />}
                className="w-full text-xs font-semibold"
              >
                VER MEUS LEADS
              </Button>
            </div>
          </div>
        ) : (
          /* Feedback Buttons Screen */
          <div className="space-y-3 pt-1">
            <p className="text-sm font-semibold text-foreground">Como ficou esse atendimento?</p>
            
            <div className="grid gap-2">
              {FEEDBACK_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleSelectOption(opt)}
                  className="h-11 justify-between px-4 text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <span>{opt.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
