"use client";

import Link from "next/link";
import { ChatCircleText } from "@/components/huge-icons";

export function LeadChat({ leadId }: { leadId?: string; phone?: string | null }) {
  if (!leadId) return null;

  return (
    <Link
      href={`/conversas?leadId=${leadId}`}
      aria-label="Abrir central de conversas"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-transform hover:-translate-y-0.5 active:translate-y-px max-[559px]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-[559px]:right-3"
    >
      <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15">
        <ChatCircleText size={18} />
      </span>
      <span className="hidden sm:inline">Conversas & Atendimento</span>
    </Link>
  );
}
