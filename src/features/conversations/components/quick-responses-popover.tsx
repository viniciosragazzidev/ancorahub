"use client";

import { useState } from "react";
import { Sparkles, FileText, Calendar, ShieldCheck, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type QuickResponse = {
  id: string;
  title: string;
  category: string;
  text: string;
  icon?: typeof Sparkles;
};

export const DEFAULT_QUICK_RESPONSES: QuickResponse[] = [
  {
    id: "welcome",
    title: "Boas-vindas & Apresentação",
    category: "Atendimento",
    text: "Olá! Seja muito bem-vindo(a). Sou o especialista responsável pelo seu atendimento. Como posso te ajudar hoje a encontrar a melhor opção de plano?",
    icon: HeartHandshake,
  },
  {
    id: "docs_request",
    title: "Solicitação de Documentos",
    category: "Contratação",
    text: "Para darmos andamento na elaboração da proposta, por favor envie fotos legíveis do seu RG/CNH e comprovante de residência atualizado.",
    icon: FileText,
  },
  {
    id: "quote_ready",
    title: "Estudo / Cotação Pronta",
    category: "Vendas",
    text: "Montei uma simulação personalizada com as melhores condições e rede credenciada para o seu perfil. Posso te apresentar os detalhes agora?",
    icon: ShieldCheck,
  },
  {
    id: "schedule_call",
    title: "Agendamento de Reunião/Ligação",
    category: "Atendimento",
    text: "Podemos agendar uma breve conversa de 5 a 10 minutos por telefone para tirar todas as dúvidas sobre carências e valores?",
    icon: Calendar,
  },
];

export function QuickResponsesPopover({
  onSelectResponse,
}: {
  onSelectResponse: (text: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" title="Respostas Rápidas (Snippets)" />}>
        <Sparkles className="size-4 text-amber-500 animate-pulse" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 space-y-1 p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-2 py-1">
          <span>Respostas Rápidas</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">Dica: digite /</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DEFAULT_QUICK_RESPONSES.map((item) => {
          const Icon = item.icon ?? Sparkles;
          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onSelectResponse(item.text)}
              className="flex flex-col items-start gap-1 p-2 cursor-pointer focus:bg-accent rounded-md"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground w-full">
                <Icon className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{item.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed pl-5">
                {item.text}
              </p>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
