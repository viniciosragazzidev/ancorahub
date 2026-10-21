"use client";

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";

import { toast } from "@/components/ui/sonner";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { cn } from "@/lib/utils";

import { updateAiStageModeAction } from "../actions";
import type { AiStageMode } from "../stage-mode";

const OPTIONS: Array<{ value: AiStageMode; title: string; description: string }> = [
  {
    value: "auto",
    title: "Automático",
    description: "A IA lê a conversa e avança a etapa sozinha quando tem certeza. O corretor pode desfazer em até 24h. Perdido e voltar etapa ficam como sugestão.",
  },
  {
    value: "suggest",
    title: "Só sugerir",
    description: "A IA mostra \"Mover para\" no lead e o corretor decide se aceita ou recusa.",
  },
  {
    value: "off",
    title: "Desligado",
    description: "A IA não muda nem sugere etapa. O diagnóstico da conversa continua aparecendo no lead.",
  },
];

/** Director's choice: what the IA does with the lead stage after reading the WhatsApp conversation. */
export function AiStageModeCard({ initialMode }: { initialMode: AiStageMode }) {
  const [mode, setMode] = useState(initialMode);
  const [isPending, startTransition] = useTransition();

  const choose = (next: AiStageMode) => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await updateAiStageModeAction(next);
      if (result.success) toast.success("Configuração salva.");
      else {
        setMode(previous);
        toast.error(result.error ?? "Não foi possível salvar.");
      }
    });
  };

  return (
    <Card variant="overview">
      <SectionCardHeader
        icon={<Sparkle />}
        title="Etapa do lead pela IA"
        description="A IA lê a conversa de WhatsApp entre o cliente e o corretor e identifica em que etapa o atendimento está."
      />
      <CardContent className="p-4">
        <div role="radiogroup" aria-label="Etapa do lead pela IA" className="grid gap-2">
          {OPTIONS.map((option) => {
            const selected = option.value === mode;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  isPending && "pointer-events-none opacity-70",
                )}
              >
                <input
                  type="radio"
                  name="ai-stage-mode"
                  value={option.value}
                  checked={selected}
                  onChange={() => choose(option.value)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
